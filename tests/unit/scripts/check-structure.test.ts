import { afterEach, describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  BASELINE_FILE,
  compareMeasure,
  findLanguageBranches,
  findStateWriters,
  isPolicyFile,
  isSourcePath,
  measure,
  measurePolicyContract,
  parseBaseline,
  run,
  StructureError,
  toBaseline
} from '../../../scripts/check-structure.mjs';
import type { SourceFile, StructureBaseline } from '../../../scripts/check-structure.mjs';

// ---------------------------------------------------------------------------
// A miniature codebase with every construct the rules care about
// ---------------------------------------------------------------------------

const MODELS = `
export enum DebugLanguage { PYTHON = 'python', RUBY = 'ruby', MOCK = 'mock' }
export enum SessionState { CREATED = 'created', RUNNING = 'running', PAUSED = 'paused', STOPPED = 'stopped' }
`;

const BEHAVIOR = `
export interface ClientBehavior {
  childRouting?: boolean;
  timeout?: number;
}
`;

const CONTRACT = `
import type { ClientBehavior } from './behavior.js';
export interface AdapterPolicy {
  name: string;
  supportsLogPoints?: boolean;
  quirk?(): void;
  /** A value with a shape: counts once, as the method. */
  describe(): { type: string };
  /** A descriptor: every member optional, so each is a switch. */
  getInitBehavior(): { deferConfig?: boolean; sendEarly?: boolean; filters?: { all?: string[] } };
  /** A descriptor through a named interface. */
  getClientBehavior(): ClientBehavior;
  /** Takes a parameter: a computation, counts once. */
  format(text: string): { short?: string };
}
export const DefaultAdapterPolicy = {
  name: 'default',
  describe: () => ({ type: 'default' }),
  getInitBehavior: () => ({}),
  getClientBehavior: () => ({}),
  format: () => ({})
} satisfies AdapterPolicy;
`;

const SHARED_HELPER = `
import type { ClientBehavior } from './behavior.js';
export function sharedClient(): ClientBehavior {
  return { timeout: 5000, childRouting: undefined };
}
`;

const ALPHA = `
import type { AdapterPolicy } from './adapter-policy.js';
import { sharedClient } from './common-policy-shared.js';
export const AlphaAdapterPolicy = {
  name: 'alpha',
  supportsLogPoints: true,
  quirk: () => {
    // a policy file may branch on a language: it is where differences live
    if (process.env.X === 'python') return;
  },
  describe: () => ({ type: 'alpha' }),
  getInitBehavior: () => ({ deferConfig: true, sendEarly: false, filters: { all: ['x'] } }),
  getClientBehavior: sharedClient,
  format: (text: string) => ({ short: text })
} satisfies AdapterPolicy;
`;

const BETA = `
import type { AdapterPolicy } from './adapter-policy.js';
import { sharedClient } from './common-policy-shared.js';
export const BetaAdapterPolicy: AdapterPolicy = {
  name: 'beta',
  supportsLogPoints: true,
  describe() {
    return { type: 'beta' };
  },
  getInitBehavior: () => {
    const behavior = { sendEarly: true, deferConfig: null };
    return behavior;
  },
  getClientBehavior: () => sharedClient(),
  format: () => ({})
};
`;

/** The mock implements quirk too: it must not turn quirk into a shared member. */
const MOCK = `
import type { AdapterPolicy } from './adapter-policy.js';
export const MockAdapterPolicy = {
  name: 'mock',
  quirk: () => undefined,
  describe: () => ({ type: 'mock' }),
  getInitBehavior: () => ({ deferConfig: true }),
  getClientBehavior: () => ({ childRouting: true }),
  format: () => ({})
} satisfies AdapterPolicy;
`;

const CORE = `
import { SessionState } from '../models.js';
export class SessionManagerCore {
  protected _updateSessionState(session: { id: string }, newState: SessionState): void {
    // The gate's own body: its call to the store is the writer itself.
    this.sessionStore.updateState(session.id, newState);
    this.sessionStore.update(session.id, { lifecycle: 'active' });
  }
  protected operations() {
    return { updateState: (session: { id: string }, next: SessionState) => this._updateSessionState(session, next) };
  }
  onStopped(session: { id: string }): void {
    this._updateSessionState(session, SessionState.PAUSED);
  }
}
export class SessionStore {
  updateState(id: string, newState: SessionState): void {
    const session = this.get(id);
    session.state = newState;
  }
}
`;

const CONTROLLER = `
import { SessionState } from '../models.js';
export class Controller {
  step(session: { id: string }) {
    this.ctx.updateState(session, SessionState.RUNNING);
  }
}
`;

const BRANCHES = `
import { DebugLanguage } from '../models.js';
export function describeRun(session: { language: string }, lang: DebugLanguage) {
  if (session.language === 'python') return 1;
  switch (lang) {
    case DebugLanguage.RUBY:
      return 2;
    default:
      return 0;
  }
}
`;

type Tree = Record<string, string>;

const BASE: Tree = {
  'packages/shared/src/models.ts': MODELS,
  'packages/shared/src/interfaces/behavior.ts': BEHAVIOR,
  'packages/shared/src/interfaces/adapter-policy.ts': CONTRACT,
  'packages/shared/src/interfaces/common-policy-shared.ts': SHARED_HELPER,
  'packages/shared/src/interfaces/adapter-policy-alpha.ts': ALPHA,
  'packages/shared/src/interfaces/adapter-policy-beta.ts': BETA,
  'packages/shared/src/interfaces/adapter-policy-mock.ts': MOCK,
  'src/session/core.ts': CORE,
  'src/session/controller.ts': CONTROLLER,
  'src/session/branches.ts': BRANCHES
};

function sources(tree: Tree): SourceFile[] {
  return Object.entries(tree).map(([file, text]) => ({ path: file, text }));
}

/** The tree with one file replaced or added. */
function withFile(file: string, text: string, tree: Tree = BASE): Tree {
  return { ...tree, [file]: text };
}

/** The tree with one file's text edited. */
function edit(file: string, from: string, to: string, tree: Tree = BASE): Tree {
  const text = tree[file];
  if (!text.includes(from)) throw new Error(`fixture edit: '${from}' not in ${file}`);
  return { ...tree, [file]: text.replace(from, to) };
}

function writers(tree: Tree) {
  return findStateWriters(sources(tree));
}

function contract(tree: Tree) {
  return measurePolicyContract(sources(tree));
}

function branches(tree: Tree) {
  return findLanguageBranches(sources(tree), contract(tree).policies);
}

// ---------------------------------------------------------------------------
// Scope
// ---------------------------------------------------------------------------

describe('source scope', () => {
  it.each([
    ['src/session/core.ts', true],
    ['packages/shared/src/interfaces/adapter-policy.ts', true],
    ['src/session/core.d.ts', false],
    ['src/session/core.js', false],
    ['src/session/core.test.ts', false],
    ['src/session/tests/helper.ts', false],
    ['packages/adapter-python/src/python-debug-adapter.ts', false],
    ['tests/unit/session/core.test.ts', false],
    ['dist/index.ts', false]
  ])('%s is read: %s', (file, expected) => {
    expect(isSourcePath(file)).toBe(expected);
  });

  it.each([
    ['packages/shared/src/interfaces/adapter-policy-python.ts', true],
    ['packages/shared/src/interfaces/adapter-policy-map.ts', true],
    ['packages/shared/src/interfaces/lldb-policy-shared.ts', true],
    ['packages/shared/src/interfaces/adapter-policy.ts', false],
    ['src/session/run-facts.ts', false]
  ])('%s is a policy file: %s', (file, expected) => {
    expect(isPolicyFile(file)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// Rule 1 and 2: writers and direct writes
// ---------------------------------------------------------------------------

describe('session-state writers', () => {
  it('counts gate and alias calls, not the writer implementations themselves', () => {
    const found = writers(BASE);
    expect(found.writers.map(w => `${w.file}:${w.where}`)).toEqual([
      'src/session/core.ts:SessionManagerCore.onStopped',
      'src/session/controller.ts:Controller.step'
    ]);
    expect(found.direct).toEqual([]);
  });

  it('counts a second call to the gate', () => {
    const tree = edit('src/session/core.ts', '    this._updateSessionState(session, SessionState.PAUSED);',
      '    this._updateSessionState(session, SessionState.PAUSED);\n    this._updateSessionState(session, SessionState.STOPPED);');
    expect(writers(tree).writers).toHaveLength(3);
  });

  it.each([
    ['an assignment to a session', 'session.state = SessionState.PAUSED;'],
    ['an assignment of a variable to a session', 'session.state = nextState;'],
    ['an assignment to this of a SessionState', 'this.state = SessionState.STOPPED;'],
    ['a partial update carrying state', 'this.ctx.updateSession(session.id, { state: SessionState.RUNNING });'],
    ["a call to the store's raw setter", 'this.sessionStore.updateState(session.id, SessionState.STOPPED);']
  ])('counts %s as a direct write', (_name, statement) => {
    const tree = edit('src/session/controller.ts', '    this.ctx.updateState(session, SessionState.RUNNING);',
      `    this.ctx.updateState(session, SessionState.RUNNING);\n    ${statement}`);
    const found = writers(tree);
    expect(found.writers).toHaveLength(3);
    expect(found.direct).toHaveLength(1);
    expect(found.direct[0]).toMatchObject({ file: 'src/session/controller.ts', where: 'Controller.step', direct: true });
  });

  it.each([
    ['a comment', '// this._updateSessionState(session, SessionState.PAUSED); session.state = SessionState.PAUSED'],
    ['a block comment', '/* this.ctx.updateState(session, SessionState.ERROR) */'],
    ['a string', "const s = 'this._updateSessionState(session, SessionState.PAUSED)';"],
    ['a template literal', 'const t = `session.state = ${String(SessionState.PAUSED)} via ctx.updateState(x)`;'],
    ["another object's own state", 'this.state = ProxyState.READY;'],
    ['an answer that reports a state', 'const answer = { success: true, state: SessionState.STOPPED };'],
    ['a comparison of state', 'if (session.state === SessionState.PAUSED) return;'],
    ['a partial update without state', 'this.ctx.updateSession(session.id, { lifecycle: 1 });']
  ])('does not count %s', (_name, statement) => {
    const tree = edit('src/session/controller.ts', '    this.ctx.updateState(session, SessionState.RUNNING);',
      `    this.ctx.updateState(session, SessionState.RUNNING);\n    ${statement}`);
    const found = writers(tree);
    expect(found.writers).toHaveLength(2);
    expect(found.direct).toHaveLength(0);
  });

  it('refuses to run when the gate is gone (a rename would hide every writer)', () => {
    const tree = edit('src/session/core.ts', 'protected _updateSessionState(', 'protected _setSessionState(');
    expect(() => writers(tree)).toThrow(StructureError);
    expect(() => writers(tree)).toThrow(/No method named _updateSessionState/);
  });
});

// ---------------------------------------------------------------------------
// Rule 3 and 4: the contract and its one-adapter members
// ---------------------------------------------------------------------------

describe('AdapterPolicy members', () => {
  it("counts the interface's members and each switch of its descriptor getters", () => {
    expect(contract(BASE).members).toEqual([
      'name',
      'supportsLogPoints',
      'quirk',
      'describe',
      'getInitBehavior',
      'getInitBehavior().deferConfig',
      'getInitBehavior().sendEarly',
      'getInitBehavior().filters',
      'getClientBehavior',
      'getClientBehavior().childRouting',
      'getClientBehavior().timeout',
      'format'
    ]);
    expect(contract(BASE).getters).toEqual(['getInitBehavior', 'getClientBehavior']);
  });

  it('counts a new member, and a new switch in a descriptor', () => {
    const tree = edit('packages/shared/src/interfaces/adapter-policy.ts', '  quirk?(): void;', '  quirk?(): void;\n  another?: boolean;');
    expect(contract(tree).members).toContain('another');
    const grown = edit('packages/shared/src/interfaces/behavior.ts', '  timeout?: number;', '  timeout?: number;\n  extra?: string;');
    expect(contract(grown).members).toContain('getClientBehavior().extra');
  });

  it('a returned object with a required member is a value, not a descriptor', () => {
    const tree = edit('packages/shared/src/interfaces/adapter-policy.ts', '{ deferConfig?: boolean;', '{ deferConfig: boolean;');
    expect(contract(tree).getters).toEqual(['getClientBehavior']);
    expect(contract(tree).members.filter(m => m.startsWith('getInitBehavior'))).toEqual(['getInitBehavior']);
  });

  it('a comment or a line break in the interface changes nothing', () => {
    const reformatted = edit('packages/shared/src/interfaces/adapter-policy.ts', '  supportsLogPoints?: boolean;',
      '  // getFake(): { a?: boolean } is not a member\n  supportsLogPoints?:\n    boolean;');
    expect(contract(reformatted).members).toEqual(contract(BASE).members);
  });

  it('refuses to run on an interface that extends another type', () => {
    const tree = edit('packages/shared/src/interfaces/adapter-policy.ts', 'export interface AdapterPolicy {',
      'export interface AdapterPolicy extends Base {');
    expect(() => contract(tree)).toThrow(/extends another type/);
  });
});

describe('members used by one adapter', () => {
  it('names the one engine policy that uses each, ignoring the mock and no-use values', () => {
    const found = contract(BASE);
    expect(found.oneAdapter).toEqual([
      { member: 'quirk', policy: 'alpha' },
      { member: 'getInitBehavior().deferConfig', policy: 'alpha' },
      { member: 'getInitBehavior().sendEarly', policy: 'beta' },
      { member: 'getInitBehavior().filters', policy: 'alpha' }
    ]);
    // childRouting is set only by the mock (and to undefined by the shared helper).
    expect(found.unused).toEqual(['getClientBehavior().childRouting']);
    expect(found.policies.map(p => p.name)).toEqual(['alpha', 'beta']);
  });

  it('follows a getter into a helper function, so a shared switch is not one-adapter', () => {
    const found = contract(BASE);
    expect(found.usersOf.get('getClientBehavior().timeout')).toEqual(['alpha', 'beta']);
  });

  it.each(['false', 'undefined', 'null'])('a switch set to %s is not a use', value => {
    const tree = edit('packages/shared/src/interfaces/adapter-policy-beta.ts', 'sendEarly: true', `sendEarly: ${value}`);
    expect(contract(tree).usersOf.get('getInitBehavior().sendEarly')).toEqual([]);
  });

  it('a member a second engine starts using is no longer one-adapter', () => {
    const tree = edit('packages/shared/src/interfaces/adapter-policy-beta.ts', "  name: 'beta',", "  name: 'beta',\n  quirk: () => {},");
    expect(contract(tree).oneAdapter.map(entry => entry.member)).not.toContain('quirk');
  });

  it('refuses to guess at a getter it cannot read', () => {
    const tree = edit('packages/shared/src/interfaces/adapter-policy-beta.ts', '  getClientBehavior: () => sharedClient(),',
      '  getClientBehavior: () => importedFromElsewhere(),');
    expect(() => contract(tree)).toThrow(/cannot tell which members/);
  });
});

// ---------------------------------------------------------------------------
// Rule 5: language branches
// ---------------------------------------------------------------------------

describe('language branches outside the policy files', () => {
  it('counts a quoted comparison and an enum case, and nothing in a policy file', () => {
    expect(branches(BASE).map(b => `${b.file}:${b.line} ${b.form} ${b.language}`)).toEqual([
      "src/session/branches.ts:4 comparison python",
      'src/session/branches.ts:6 case DebugLanguage.RUBY'
    ]);
  });

  it.each([
    ['a !== comparison', "if (lang !== 'ruby') return;"],
    ['an enum comparison', 'if (lang === DebugLanguage.PYTHON) return;'],
    ['a comparison with the literal first', "if ('mock' == session.language) return;"],
    ["a policy's name", "if (policy.name === 'alpha') return;"],
    ['a comparison inside a template expression', 'const t = `${session.language === \'python\'}`;']
  ])('counts %s', (_name, statement) => {
    const tree = edit('src/session/branches.ts', "  if (session.language === 'python') return 1;",
      `  if (session.language === 'python') return 1;\n  ${statement}`);
    expect(branches(tree)).toHaveLength(3);
  });

  it.each([
    ['a comment', "// if (language === 'python') { … }"],
    ['a string', "const s = \"language === 'python'\";"],
    ['a template literal', "const t = `language === 'python'`;"],
    ['a literal that is not a language id', "if (ext === '.py' || mode === 'pythonic') return;"],
    ['the default policy name', "if (policy.name === 'default') return;"]
  ])('does not count %s', (_name, statement) => {
    const tree = edit('src/session/branches.ts', "  if (session.language === 'python') return 1;",
      `  if (session.language === 'python') return 1;\n  ${statement}`);
    expect(branches(tree)).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Formatting never moves a count
// ---------------------------------------------------------------------------

describe('reformatting', () => {
  it('leaves every count unchanged', () => {
    const reformatted: Tree = {};
    for (const [file, text] of Object.entries(BASE)) {
      reformatted[file] = `// header comment that mentions _updateSessionState( and language === 'python'\n${text
        .split('\n')
        .map(line => `  ${line}`)
        .join('\n\n')}\n`;
    }
    expect(toBaseline(measure(sources(reformatted)))).toEqual(toBaseline(measure(sources(BASE))));
  });
});

// ---------------------------------------------------------------------------
// Comparison and baseline validation
// ---------------------------------------------------------------------------

describe('compareMeasure', () => {
  it('per-file counts fail in both directions, on the file that moved', () => {
    const one = { f: 1 };
    expect(compareMeasure('files', { 'src/a.ts': { f: 1, g: 1 } }, { 'src/a.ts': one })).toEqual({ regressed: ['src/a.ts'], improved: [] });
    expect(compareMeasure('files', {}, { 'src/a.ts': one })).toEqual({ regressed: [], improved: ['src/a.ts'] });
    expect(compareMeasure('files', { 'src/b.ts': one }, { 'src/a.ts': one })).toEqual({ regressed: ['src/b.ts'], improved: ['src/a.ts'] });
    expect(compareMeasure('files', { 'src/a.ts': one }, { 'src/a.ts': one })).toEqual({ regressed: [], improved: [] });
  });

  it('a move or rename between functions of one file is not a change: the gate counts files', () => {
    expect(compareMeasure('files', { 'src/a.ts': { renamed: 2 } }, { 'src/a.ts': { f: 1, g: 1 } })).toEqual({ regressed: [], improved: [] });
  });

  it('member names: new is regressed, gone is improved', () => {
    expect(compareMeasure('names', ['a', 'c'], ['a', 'b'])).toEqual({ regressed: ['c'], improved: ['b'] });
  });

  it('one-adapter members: a new one or a changed owner is regressed', () => {
    expect(compareMeasure('owners', { m: 'alpha', n: 'beta' }, { m: 'alpha' })).toEqual({ regressed: ['n'], improved: [] });
    expect(compareMeasure('owners', { m: 'beta' }, { m: 'alpha' })).toEqual({ regressed: ['m'], improved: [] });
    expect(compareMeasure('owners', {}, { m: 'alpha' })).toEqual({ regressed: [], improved: ['m'] });
  });
});

describe('parseBaseline', () => {
  const good = (): StructureBaseline => toBaseline(measure(sources(BASE)));

  it('accepts what toBaseline writes', () => {
    expect(parseBaseline(JSON.stringify(good()))).toEqual(good());
  });

  it.each<[string, string, RegExp]>([
    ['invalid JSON', '{ nope', /not valid JSON/],
    ['an array', '[]', /must be a JSON object, got an array/],
    ['a missing measure', JSON.stringify({ ...good(), languageBranches: undefined }), /missing languageBranches/],
    ['an unknown measure', JSON.stringify({ ...good(), extra: {} }), /unknown extra/],
    ['a negative count', JSON.stringify({ ...good(), sessionStateWriters: { 'src/session/core.ts': { f: -1 } } }), /positive integer/],
    ['a bare count where functions belong', JSON.stringify({ ...good(), sessionStateWriters: { 'src/session/core.ts': 2 } }), /map functions to counts/],
    ['a path the count never reads', JSON.stringify({ ...good(), languageBranches: { 'tests/a.test.ts': { f: 1 } } }), /not a source file/],
    ['members that are not names', JSON.stringify({ ...good(), policyMembers: [1] }), /member names/],
    ['an owner that is not a policy name', JSON.stringify({ ...good(), oneAdapterMembers: { quirk: 3 } }), /one policy/]
  ])('refuses %s, and says how to re-record', (_name, text, message) => {
    expect(() => parseBaseline(text)).toThrow(StructureError);
    expect(() => parseBaseline(text)).toThrow(message);
    expect(() => parseBaseline(text)).toThrow(/pnpm run structure:update/);
  });
});

// ---------------------------------------------------------------------------
// The gate, end to end on a temporary tree
// ---------------------------------------------------------------------------

describe('run', () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
  });

  function tree(files: Tree): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'check-structure-'));
    roots.push(root);
    fs.mkdirSync(path.join(root, 'tests'), { recursive: true });
    write(root, files);
    return root;
  }

  function write(root: string, files: Tree): void {
    for (const [file, text] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
      fs.writeFileSync(path.join(root, file), text);
    }
  }

  /** A tree with a recorded baseline, then edited. */
  function recordedThen(files: Tree): string {
    const root = tree(BASE);
    expect(run(root, ['--update']).code).toBe(0);
    write(root, files);
    return root;
  }

  it('records a baseline, then passes with one line per measure', () => {
    const root = tree(BASE);
    const update = run(root, ['--update']);
    expect(update.code).toBe(0);
    expect(fs.existsSync(path.join(root, BASELINE_FILE))).toBe(true);

    const check = run(root, []);
    expect(check).toMatchObject({ code: 0, stderr: '' });
    expect(check.stdout.trimEnd().split('\n')).toEqual([
      'structure: session-state writers: 2',
      'structure: direct session-state writes: 0',
      'structure: AdapterPolicy members: 12',
      'structure: AdapterPolicy members used by one adapter: 4 (alpha 3, beta 1)',
      'structure: language branches outside the policy files: 2'
    ]);
  });

  it('ignores test files and compiled output beside the sources', () => {
    const root = recordedThen({
      'src/session/core.test.ts': "this._updateSessionState(s, SessionState.PAUSED); if (l === 'python') {}",
      'src/session/core.js': 'this._updateSessionState(s, SessionState.PAUSED);',
      'src/session/core.d.ts': "declare const x: 'python';"
    });
    expect(run(root, []).code).toBe(0);
  });

  it('fails on a new writer, naming the file, the line and what to do instead', () => {
    const root = recordedThen(edit('src/session/core.ts', '    this._updateSessionState(session, SessionState.PAUSED);',
      '    this._updateSessionState(session, SessionState.PAUSED);\n    this._updateSessionState(session, SessionState.STOPPED);'));
    const result = run(root, []);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('structure: session-state writers: 2 recorded, 3 now; 1 file(s) gained items.');
    expect(result.stderr).toContain('src/session/core.ts: 1 -> 2');
    expect(result.stderr).toContain('    SessionManagerCore.onStopped: 1 -> 2');
    expect(result.stderr).toContain('      src/session/core.ts:14  this._updateSessionState(session, SessionState.STOPPED)');
    expect(result.stderr).toContain('Reach the state through an existing transition');
    expect(result.stderr).toContain('pnpm run structure:update');
  });

  it('fails on a direct write under both writer measures', () => {
    const root = recordedThen(edit('src/session/controller.ts', '    this.ctx.updateState(session, SessionState.RUNNING);',
      '    this.ctx.updateState(session, SessionState.RUNNING);\n    session.state = SessionState.PAUSED;'));
    const result = run(root, []);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('structure: direct session-state writes: 0 recorded, 1 now; 1 file(s) gained items.');
    expect(result.stderr).toContain('    Controller.step: 0 -> 1\n      src/session/controller.ts:6  session.state = SessionState.PAUSED');
    expect(result.stderr).toContain("skips _updateSessionState's invariant");
  });

  it('fails on a new member used by one engine, naming the member and the policy', () => {
    const root = recordedThen({
      ...edit('packages/shared/src/interfaces/adapter-policy.ts', '  quirk?(): void;', '  quirk?(): void;\n  holdsThings?: boolean;'),
      'packages/shared/src/interfaces/adapter-policy-beta.ts': BETA.replace("  name: 'beta',", "  name: 'beta',\n  holdsThings: true,")
    });
    const result = run(root, []);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('structure: AdapterPolicy members: 12 recorded, 13 now; 1 new.');
    expect(result.stderr).toContain('new member: holdsThings  (used by: beta)');
    expect(result.stderr).toContain('structure: AdapterPolicy members used by one adapter: 4 recorded, 5 now; 1 new.');
    expect(result.stderr).toContain('holdsThings: used only by beta');
    expect(result.stderr).toContain("that engine's quirk entering the core's contract");
  });

  it('fails on a new language branch in the core', () => {
    const root = recordedThen(edit('src/session/branches.ts', "  if (session.language === 'python') return 1;",
      "  if (session.language === 'python') return 1;\n  if (session.language === 'ruby') return 3;"));
    const result = run(root, []);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('src/session/branches.ts: 2 -> 3');
    // Counted per function and language, so only the new language's comparison is shown.
    expect(result.stderr).toContain('    describeRun [ruby]: 0 -> 1');
    expect(result.stderr).toContain("      src/session/branches.ts:5  session.language === 'ruby'");
    expect(result.stderr).not.toContain("session.language === 'python'");
    expect(result.stderr).toContain('keep the core language-blind');
  });

  it('names only the function that grew, and summarises the rest of the file', () => {
    const root = recordedThen(withFile('src/session/branches.ts',
      `${BRANCHES}\nexport function other(l: string) { return l === 'mock'; }\n`));
    const result = run(root, []);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('    other [mock]: 0 -> 1');
    expect(result.stderr).toContain("      src/session/branches.ts:13  l === 'mock'");
    expect(result.stderr).not.toContain("session.language === 'python'");
    expect(result.stderr).toContain('    (2 more in this file, already recorded: --list shows them)');
  });

  it('fails on a decrease too, and asks for the baseline to be re-recorded', () => {
    const root = recordedThen(edit('src/session/branches.ts', "  if (session.language === 'python') return 1;\n", ''));
    const result = run(root, []);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('structure: language branches outside the policy files: 2 recorded, 1 now; 1 file(s) lost items.');
    expect(result.stderr).toContain('That is progress, but tests/structure-baseline.json is now stale.');
    expect(result.stderr).toContain('pnpm run structure:update');
  });

  it('a move between files is reported as such, not as new debt', () => {
    const moved = edit('src/session/controller.ts', '    this.ctx.updateState(session, SessionState.RUNNING);\n', '');
    const root = recordedThen(withFile('src/session/other.ts',
      'export class Other { go(s: { id: string }) { this.ctx.updateState(s, SessionState.RUNNING); } }', moved));
    const result = run(root, []);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('2 recorded, 2 now; 1 file(s) gained items. The total did not grow');
  });

  it('refuses a corrupt baseline with exit 2 and a pointer to the update', () => {
    const root = tree(BASE);
    fs.writeFileSync(path.join(root, BASELINE_FILE), '{ "sessionStateWriters": ');
    const result = run(root, []);
    expect(result.code).toBe(2);
    expect(result.stderr).toContain('tests/structure-baseline.json is not valid JSON. Re-record it with: pnpm run structure:update');

    // --update never reads the baseline, so it repairs a corrupt one.
    expect(run(root, ['--update']).code).toBe(0);
    expect(run(root, []).code).toBe(0);
  });

  it('refuses a missing baseline and unknown arguments with exit 2', () => {
    const root = tree(BASE);
    expect(run(root, [])).toMatchObject({ code: 2, stderr: expect.stringContaining('Missing tests/structure-baseline.json') });
    expect(run(root, ['--fix'])).toMatchObject({ code: 2, stderr: expect.stringContaining('Unknown argument(s): --fix') });
  });

  it('exits 2, not 1, when the code no longer has the shape the rules read', () => {
    const root = recordedThen(edit('src/session/core.ts', 'protected _updateSessionState(', 'protected _setSessionState('));
    expect(run(root, [])).toMatchObject({ code: 2, stderr: expect.stringContaining('No method named _updateSessionState') });
  });

  it('--list prints every item and still gates', () => {
    const root = recordedThen({});
    const result = run(root, ['--list']);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('session-state writers (2):');
    expect(result.stdout).toContain('  getInitBehavior().sendEarly  [beta]');
    expect(result.stdout).toContain("src/session/branches.ts:4  describeRun  session.language === 'python'");
  });
});
