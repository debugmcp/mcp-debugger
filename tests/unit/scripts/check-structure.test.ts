/**
 * The structure ratchet, on a miniature repository that mirrors the real anchors: the
 * session-state gate, the session store, the operations context, the policy contract with its
 * descriptor getters, engine policies behind a registry, and core code that reads them.
 *
 * Every probe of the 2026-11-28 review is here: its false alarms must stay green, its blind
 * spots must be counted (with the real types; the review's own spelling with ad-hoc types is
 * kept where it differs, to show it is correctly not a session or not a language).
 */
import { afterAll, describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  BASELINE_FILE,
  compareItems,
  measure,
  parseBaseline,
  run,
  StructureError
} from '../../../scripts/check-structure.mjs';
import type { Measurement, MeasureId } from '../../../scripts/check-structure.mjs';

// ---------------------------------------------------------------------------
// The fixture
// ---------------------------------------------------------------------------

const BASE: Record<string, string> = {
  'tsconfig.typecheck.json': JSON.stringify({
    compilerOptions: {
      strict: true,
      target: 'ES2022',
      module: 'ESNext',
      moduleResolution: 'Bundler',
      lib: ['ES2022'],
      types: [],
      noEmit: true,
      skipLibCheck: true,
      paths: { '@debugmcp/*': ['./packages/*/src/index.ts'] }
    },
    include: ['src/**/*', 'packages/*/src/**/*']
  }),
  'src/globals.d.ts': 'declare const process: { readonly platform: string };\n',

  'packages/shared/src/index.ts': `export { DebugLanguage, SessionState } from './models/index.js';
export type { DebugSessionInfo } from './models/index.js';
export type { AdapterPolicy } from './interfaces/adapter-policy.js';
export type { DapClientBehavior } from './interfaces/dap-client-behavior.js';
export { getPolicyForLanguage } from './interfaces/adapter-policy-map.js';
`,
  'packages/shared/src/models/index.ts': `export enum DebugLanguage { PYTHON = 'python', RUBY = 'ruby', JAVA = 'java', MOCK = 'mock' }
export enum SessionState { CREATED = 'created', RUNNING = 'running', PAUSED = 'paused', STOPPED = 'stopped' }
export interface DebugSessionInfo { id: string; language: DebugLanguage; state: SessionState }
`,
  'packages/shared/src/interfaces/dap-client-behavior.ts': `export interface DapClientBehavior {
  mirrorBreakpoints?: boolean;
  childTimeout?: number;
}
`,
  'packages/shared/src/interfaces/adapter-policy.ts': `import type { DapClientBehavior } from './dap-client-behavior.js';
export interface AdapterPolicy {
  name: string;
  supportsLogPoints?: boolean;
  quirk?(): string;
  describe(): { type: string; extra?: boolean };
  format(text: string): { short?: string };
  getInitBehavior(): { deferConfig?: boolean; stopOnEntry?: boolean; filters?: { all?: string[] } };
  getClientBehavior(): DapClientBehavior;
}
export const DefaultAdapterPolicy: AdapterPolicy = {
  name: 'default',
  describe: () => ({ type: 'default' }),
  format: () => ({}),
  getInitBehavior: () => ({}),
  getClientBehavior: () => ({})
};
`,
  'packages/shared/src/interfaces/common-policy-shared.ts': `import type { DapClientBehavior } from './dap-client-behavior.js';
export function sharedClient(): DapClientBehavior {
  return { childTimeout: 5000, mirrorBreakpoints: false };
}
`,
  'packages/shared/src/interfaces/adapter-policy-python.ts': `import type { AdapterPolicy } from './adapter-policy.js';
import { sharedClient } from './common-policy-shared.js';
export const PythonAdapterPolicy = {
  name: 'python',
  supportsLogPoints: true,
  describe: () => ({ type: 'debugpy' }),
  format: (text: string) => ({ short: text }),
  getInitBehavior: () => ({ deferConfig: false, stopOnEntry: false }),
  getClientBehavior: sharedClient
} satisfies AdapterPolicy;
`,
  'packages/shared/src/interfaces/adapter-policy-ruby.ts': `import type { AdapterPolicy } from './adapter-policy.js';
import { sharedClient } from './common-policy-shared.js';
export const RubyAdapterPolicy = {
  name: 'ruby',
  supportsLogPoints: false,
  describe: () => ({ type: 'rdbg' }),
  format: () => ({}),
  getInitBehavior: () => ({ stopOnEntry: false }),
  getClientBehavior: () => sharedClient()
} satisfies AdapterPolicy;
`,
  'packages/shared/src/interfaces/adapter-policy-java.ts': `import type { AdapterPolicy } from './adapter-policy.js';
export const JavaAdapterPolicy = {
  name: 'java',
  supportsLogPoints: true,
  quirk: () => 'jdwp',
  describe: () => ({ type: 'jdi' }),
  format: () => ({}),
  getInitBehavior: () => ({ deferConfig: true, filters: { all: ['uncaught'] } }),
  getClientBehavior: () => ({ mirrorBreakpoints: true })
} satisfies AdapterPolicy;
`,
  'packages/shared/src/interfaces/adapter-policy-mock.ts': `import type { AdapterPolicy } from './adapter-policy.js';
export const MockAdapterPolicy = {
  name: 'mock',
  quirk: () => 'mock',
  describe: () => ({ type: 'mock', extra: true }),
  format: () => ({}),
  getInitBehavior: () => ({ deferConfig: true }),
  getClientBehavior: () => ({ mirrorBreakpoints: true })
} satisfies AdapterPolicy;
`,
  'packages/shared/src/interfaces/adapter-policy-map.ts': `import type { AdapterPolicy } from './adapter-policy.js';
import { DefaultAdapterPolicy } from './adapter-policy.js';
import { PythonAdapterPolicy } from './adapter-policy-python.js';
import { RubyAdapterPolicy } from './adapter-policy-ruby.js';
import { JavaAdapterPolicy } from './adapter-policy-java.js';
import { MockAdapterPolicy } from './adapter-policy-mock.js';
import { DebugLanguage } from '../models/index.js';
export function getPolicyForLanguage(language: string): AdapterPolicy {
  switch (language) {
    case DebugLanguage.PYTHON: return PythonAdapterPolicy;
    case DebugLanguage.RUBY: return RubyAdapterPolicy;
    case DebugLanguage.JAVA: return JavaAdapterPolicy;
    case DebugLanguage.MOCK: return MockAdapterPolicy;
    default: return DefaultAdapterPolicy;
  }
}
`,
  'src/server/reads.ts': `import type { AdapterPolicy } from '@debugmcp/shared';
export function gates(policy: AdapterPolicy): string[] {
  const out: string[] = [];
  if (policy.supportsLogPoints === false) out.push('logpoints refused');
  const init = policy.getInitBehavior();
  if (init.deferConfig) out.push('defer');
  if (typeof init.stopOnEntry === 'boolean') out.push('entry');
  if (policy.getClientBehavior().mirrorBreakpoints) out.push('mirror');
  if (policy.describe().extra) out.push('extra');
  return out;
}
`,
  'src/session/session-store.ts': `import { SessionState, type DebugLanguage, type DebugSessionInfo } from '@debugmcp/shared';
export interface ManagedSession extends DebugSessionInfo { note?: string }
export class SessionStore {
  private readonly sessions = new Map<string, ManagedSession>();
  create(id: string, language: DebugLanguage): ManagedSession {
    const session: ManagedSession = { id, language, state: SessionState.CREATED };
    this.sessions.set(id, session);
    return session;
  }
  get(id: string): ManagedSession {
    const session = this.sessions.get(id);
    if (!session) throw new Error(id);
    return session;
  }
  update(id: string, updates: Partial<ManagedSession>): void {
    Object.assign(this.get(id), updates);
  }
  updateState(id: string, newState: SessionState): void {
    const session = this.get(id);
    session.state = newState;
  }
  snapshot(id: string): DebugSessionInfo {
    const session = this.get(id);
    return { id: session.id, language: session.language, state: session.state };
  }
}
`,
  'src/session/session-manager-core.ts': `import { SessionState } from '@debugmcp/shared';
import { SessionStore, type ManagedSession } from './session-store.js';
export class SessionManagerCore {
  protected readonly sessionStore = new SessionStore();
  protected _updateSessionState(session: ManagedSession, newState: SessionState): void {
    if (session.state === newState) return;
    this.sessionStore.updateState(session.id, newState);
  }
  onStopped(session: ManagedSession): void {
    this._updateSessionState(session, SessionState.PAUSED);
  }
}
`,
  'src/session/operations-context.ts': `import type { SessionState } from '@debugmcp/shared';
import type { ManagedSession } from './session-store.js';
export interface OperationsContext {
  updateState(session: ManagedSession, newState: SessionState): void;
  updateSession(id: string, updates: Partial<ManagedSession>): void;
}
`,
  'src/session/session-manager-operations.ts': `import { SessionManagerCore } from './session-manager-core.js';
import type { OperationsContext } from './operations-context.js';
export class SessionManagerOperations extends SessionManagerCore {
  protected buildOperationsContext(): OperationsContext {
    return {
      updateState: (session, newState) => this._updateSessionState(session, newState),
      updateSession: (id, updates) => this.sessionStore.update(id, updates)
    };
  }
}
`,
  'src/session/controller.ts': `import { SessionState } from '@debugmcp/shared';
import type { OperationsContext } from './operations-context.js';
import type { ManagedSession } from './session-store.js';
export class Controller {
  constructor(private readonly ctx: Pick<OperationsContext, 'updateState' | 'updateSession'>) {}
  step(session: ManagedSession): void {
    this.ctx.updateState(session, SessionState.RUNNING);
  }
}
`,
  'src/session/branches.ts': `import { DebugLanguage } from '@debugmcp/shared';
import type { ManagedSession } from './session-store.js';
export function describeRun(session: ManagedSession): number {
  if (session.language === 'python') return 1;
  switch (session.language) {
    case DebugLanguage.RUBY:
      return 2;
    default:
      return 0;
  }
}
export function note(language: string): string {
  return language === 'java' ? 'jvm' : '';
}
export function noteFor(session: ManagedSession): string {
  return note(session.language);
}
`
};

type Edit = Record<string, string | null | ((text: string) => string)>;

/** Replace one occurrence, failing loudly when the fixture no longer has the text. */
function swap(from: string, to: string): (text: string) => string {
  return text => {
    if (!text.includes(from)) throw new Error(`fixture edit: '${from}' not found`);
    return text.replace(from, to);
  };
}

/** Append a line before a file's last closing brace. */
function insertBefore(marker: string, addition: string): (text: string) => string {
  return swap(marker, `${addition}\n${marker}`);
}

const roots: string[] = [];
afterAll(() => {
  for (const root of roots) fs.rmSync(root, { recursive: true, force: true });
});

function write(root: string, edit: Edit): void {
  for (const [file, change] of Object.entries(edit)) {
    const target = path.join(root, file);
    if (change === null) {
      fs.rmSync(target, { force: true });
      continue;
    }
    const before = fs.existsSync(target) ? fs.readFileSync(target, 'utf-8') : '';
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, typeof change === 'function' ? change(before) : change);
  }
}

function tree(...edits: Edit[]): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'check-structure-'));
  roots.push(root);
  fs.mkdirSync(path.join(root, 'tests'), { recursive: true });
  write(root, BASE);
  for (const edit of edits) write(root, edit);
  return root;
}

async function measured(...edits: Edit[]): Promise<Measurement> {
  return measure(tree(...edits));
}

function keys(m: Measurement, id: MeasureId): string[] {
  return m.items[id].map(entry => entry.key).sort();
}

/** A baseline recorded on the fixture, then the edit, then the check. */
async function recordedThen(edit: Edit, argv: string[] = []) {
  const root = tree();
  const init = await run(root, ['--init']);
  expect(init.code, init.stderr).toBe(0);
  write(root, edit);
  return { root, result: await run(root, argv) };
}

const BASE_WRITERS = [
  'Controller.step :: this.ctx.updateState(session, SessionState.RUNNING)',
  'SessionManagerCore.onStopped :: this._updateSessionState(session, SessionState.PAUSED)'
];

// ---------------------------------------------------------------------------
// Session-state writers
// ---------------------------------------------------------------------------

describe('session-state writers', () => {
  it('counts the decisions, not the plumbing: the store setter, the gate, the context alias, constructions and snapshots', async () => {
    const m = await measured();
    expect(keys(m, 'sessionStateWriters')).toEqual(BASE_WRITERS);
    expect(m.items.directStateWrites).toEqual([]);
  });

  const inStep = (statement: string): Edit => ({
    'src/session/controller.ts': swap('    this.ctx.updateState(session, SessionState.RUNNING);',
      `    this.ctx.updateState(session, SessionState.RUNNING);\n    ${statement}`)
  });

  it.each([
    ['a destructured alias of the context entry', 'const { updateState: transition } = this.ctx; transition(session, SessionState.PAUSED);',
      'Controller.step :: transition(session, SessionState.PAUSED)']
  ])('counts %s as a gated writer', async (_name, statement, key) => {
    const m = await measured(inStep(statement));
    expect(keys(m, 'sessionStateWriters')).toEqual([...BASE_WRITERS, key].sort());
    expect(m.items.directStateWrites).toEqual([]);
  });

  it.each([
    ['an assignment', 'session.state = SessionState.PAUSED;'],
    ['an assignment of a variable', 'const next = SessionState.PAUSED; session.state = next;'],
    ['an element access', "session['state'] = SessionState.RUNNING;"],
    ['a destructuring target', '({ state: session.state } = { state: SessionState.RUNNING });'],
    ['Object.assign with a session target', 'Object.assign(session, { state: SessionState.RUNNING });'],
    ['a partial update', 'this.ctx.updateSession(session.id, { state: SessionState.RUNNING });'],
    ['a partial update through a spread', 'this.ctx.updateSession(session.id, { ...{ state: SessionState.RUNNING } });']
  ])('counts %s as a direct write', async (_name, statement) => {
    const m = await measured(inStep(statement));
    expect(m.items.sessionStateWriters).toHaveLength(3);
    expect(m.items.directStateWrites).toHaveLength(1);
    expect(m.items.directStateWrites[0]).toMatchObject({ file: 'src/session/controller.ts', where: 'Controller.step', direct: true });
  });

  it('counts a raw write inside a function that happens to be called updateState', async () => {
    const m = await measured({
      'src/session/helpers.ts': `import { SessionState } from '@debugmcp/shared';
import type { ManagedSession } from './session-store.js';
export function updateState(session: ManagedSession): void { session.state = SessionState.RUNNING; }
`
    });
    expect(keys(m, 'directStateWrites')).toEqual(['updateState :: session.state = SessionState.RUNNING']);
  });

  it("counts a call to the store's raw setter from outside the gate as direct", async () => {
    const m = await measured({
      'src/session/session-manager-core.ts': insertBefore('  onStopped(', '  abort(session: ManagedSession): void { this.sessionStore.updateState(session.id, SessionState.STOPPED); }')
    });
    expect(keys(m, 'directStateWrites')).toEqual(['SessionManagerCore.abort :: this.sessionStore.updateState(session.id, SessionState.STOPPED)']);
  });

  it('counts a forwarding wrapper at its callers, and at itself when nothing calls it', async () => {
    const wrapper = insertBefore('  onStopped(',
      '  protected transition(session: ManagedSession, next: SessionState): void { this._updateSessionState(session, next); }');
    const unused = await measured({ 'src/session/session-manager-core.ts': wrapper });
    expect(keys(unused, 'sessionStateWriters')).toContain('SessionManagerCore.transition :: this._updateSessionState(session, next)');

    const called = await measured({
      'src/session/session-manager-core.ts': text => insertBefore('  onStopped(',
        '  stopNow(session: ManagedSession): void { this.transition(session, SessionState.STOPPED); }')(wrapper(text))
    });
    expect(keys(called, 'sessionStateWriters')).toEqual([...BASE_WRITERS, 'SessionManagerCore.stopNow :: this.transition(session, SessionState.STOPPED)'].sort());
  });

  it('counts a forward from a callback nothing in the core calls', async () => {
    const m = await measured({
      'src/session/session-manager-core.ts': insertBefore('  onStopped(',
        '  replay(session: ManagedSession, states: SessionState[]): void { states.forEach(s => this._updateSessionState(session, s)); }')
    });
    expect(keys(m, 'sessionStateWriters')).toContain('SessionManagerCore.replay :: this._updateSessionState(session, s)');
  });

  it.each([
    ['an unrelated state field', "export function resetIndicator(indicator: { state: string }): void { indicator.state = 'idle'; }"],
    ['an unrelated updateState method', "export function updateLabel(label: { updateState: (value: string) => void }): void { label.updateState('ready'); }"],
    ['the review\'s Object.assign on a lookalike type', "export function resume(session: { state: string }): void { Object.assign(session, { state: 'running' }); }"],
    ['the review\'s raw write on a lookalike type', "export function updateState(session: { state: string }): void { session.state = 'running'; }"],
    ['the review\'s destructured alias on a lookalike type',
      "export function resume(ctx: { updateState: (s: { state: string }, v: string) => void }, s: { state: string }): void { const { updateState: t } = ctx; t(s, 'running'); }"],
    ['comments, strings and templates that mention writes',
      "// session.state = SessionState.PAUSED; this._updateSessionState(s, x)\nexport const a = 'ctx.updateState(s, SessionState.PAUSED)';\nexport const b = `session.state = ${String(1)}`;"]
  ])('does not count %s', async (_name, source) => {
    const m = await measured({ 'src/session/probe.ts': `${source}\n` });
    expect(keys(m, 'sessionStateWriters')).toEqual(BASE_WRITERS);
  });

  it('a file moved to a sibling behind a re-export keeps every key', async () => {
    const before = await measured();
    const m = await measured({
      'src/session/controller-moved.ts': BASE['src/session/controller.ts'],
      'src/session/controller.ts': "export * from './controller-moved.js';\n"
    });
    expect(keys(m, 'sessionStateWriters')).toEqual(keys(before, 'sessionStateWriters'));
  });
});

// ---------------------------------------------------------------------------
// The contract and its one-adapter members
// ---------------------------------------------------------------------------

const BASE_MEMBERS = [
  'describe', 'describe().extra', 'format', 'getClientBehavior', 'getClientBehavior().childTimeout',
  'getClientBehavior().mirrorBreakpoints', 'getInitBehavior', 'getInitBehavior().deferConfig',
  'getInitBehavior().filters', 'getInitBehavior().stopOnEntry', 'name', 'quirk', 'supportsLogPoints'
];
const BASE_ONE_ADAPTER = [
  'getClientBehavior().mirrorBreakpoints [java]', 'getInitBehavior().deferConfig [java]',
  'getInitBehavior().filters [java]', 'quirk [java]'
];

describe('AdapterPolicy members and their users', () => {
  it('reads the contract from the checker and the users from the real policy objects', async () => {
    const m = await measured();
    expect(keys(m, 'policyMembers')).toEqual(BASE_MEMBERS);
    expect(keys(m, 'oneAdapterMembers')).toEqual(BASE_ONE_ADAPTER);
    expect(m.contract.engines).toEqual(['python', 'ruby', 'java']);
    // ruby's supportsLogPoints: false counts: the core reads it with === false.
    expect(m.contract.usersOf.get('supportsLogPoints')).toEqual(['python', 'ruby', 'java']);
    // python's deferConfig: false does not: the core only tests its truth.
    expect(m.contract.usersOf.get('getInitBehavior().deferConfig')).toEqual(['java']);
    // stopOnEntry: false counts for both: the core reads it with typeof.
    expect(m.contract.usersOf.get('getInitBehavior().stopOnEntry')).toEqual(['python', 'ruby']);
    // the mock's describe().extra is not an engine's use.
    expect(m.contract.usersOf.get('describe().extra')).toEqual([]);
    expect(m.contract.falseIsAbsent).toEqual(expect.arrayContaining(['getInitBehavior().deferConfig', 'getClientBehavior().mirrorBreakpoints']));
  });

  const java = 'packages/shared/src/interfaces/adapter-policy-java.ts';
  const ruby = 'packages/shared/src/interfaces/adapter-policy-ruby.ts';
  const python = 'packages/shared/src/interfaces/adapter-policy-python.ts';

  it.each<[string, Edit]>([
    ['an unrelated module declaring its own DapClientBehavior', {
      'packages/shared/src/interfaces/documentation-example.ts': 'export interface DapClientBehavior { documentationExample?: string }\n'
    }],
    ['the descriptor interface extending an empty base', {
      'packages/shared/src/interfaces/dap-client-behavior.ts': swap('export interface DapClientBehavior {',
        'interface EmptyBase {}\nexport interface DapClientBehavior extends EmptyBase {')
    }],
    ['false written as !true', { [python]: swap('deferConfig: false', 'deferConfig: !true') }],
    ['a three-way switch flipped from false to true', { [ruby]: swap('getInitBehavior: () => ({ stopOnEntry: false })', 'getInitBehavior: () => ({ stopOnEntry: true })') }],
    ['satisfies (AdapterPolicy) in parentheses', { [java]: swap('} satisfies AdapterPolicy;', '} satisfies (AdapterPolicy);') }],
    ['a descriptor moved into a spread helper', {
      [java]: text => swap("  getInitBehavior: () => ({ deferConfig: true, filters: { all: ['uncaught'] } }),\n", '  ...javaInit,\n')(text)
        .replace('export const JavaAdapterPolicy', "const javaInit = { getInitBehavior: () => ({ deferConfig: true, filters: { all: ['uncaught'] } }) };\nexport const JavaAdapterPolicy")
    }]
  ])('a false alarm stays green: %s', async (_name, edit) => {
    const m = await measured(edit);
    expect(keys(m, 'policyMembers')).toEqual(BASE_MEMBERS);
    expect(keys(m, 'oneAdapterMembers')).toEqual(BASE_ONE_ADAPTER);
  });

  it('counts a switch one engine enables through a spread helper', async () => {
    const m = await measured({
      [python]: text => swap("  describe: () => ({ type: 'debugpy' }),\n", '  ...pythonDescribe,\n')(text)
        .replace('export const PythonAdapterPolicy', "const pythonDescribe = { describe: () => ({ type: 'debugpy', extra: true }) };\nexport const PythonAdapterPolicy")
    });
    expect(keys(m, 'oneAdapterMembers')).toEqual([...BASE_ONE_ADAPTER, 'describe().extra [python]'].sort());
  });

  it('counts an optional field added to a returned object that also has a required one', async () => {
    const m = await measured({
      'packages/shared/src/interfaces/adapter-policy.ts': swap('describe(): { type: string; extra?: boolean };', 'describe(): { type: string; extra?: boolean; newQuirk?: boolean };'),
      [java]: swap("describe: () => ({ type: 'jdi' }),", "describe: () => ({ type: 'jdi', newQuirk: true }),")
    });
    expect(keys(m, 'policyMembers')).toContain('describe().newQuirk');
    expect(keys(m, 'oneAdapterMembers')).toContain('describe().newQuirk [java]');
  });

  it('evaluates descriptors on every platform, so the result does not depend on the host', async () => {
    const m = await measured({ [python]: swap('deferConfig: false', "deferConfig: process.platform === 'linux'") });
    expect(m.contract.usersOf.get('getInitBehavior().deferConfig')).toEqual(['python', 'java']);
  });

  it('names a renamed member as a change, not as growth', async () => {
    const rename = (text: string) => text.replaceAll('quirk', 'peculiarity');
    const m = await measured({ 'packages/shared/src/interfaces/adapter-policy.ts': rename, [java]: rename, 'packages/shared/src/interfaces/adapter-policy-mock.ts': rename });
    expect(compareItems(keys(m, 'policyMembers'), BASE_MEMBERS)).toMatchObject({ outcome: 'change', added: ['peculiarity'], removed: ['quirk'] });
  });

  it('an unread boolean switch: false is a use, so one engine setting it true does not make it one-adapter', async () => {
    // Nothing reads the switch, so the rule cannot tell false from absent and counts false
    // as a use (the review's skipConfigurationDone probe). Setting it true in one engine
    // changes no behaviour, and the measure says so by staying where it was.
    const m = await measured({
      'packages/shared/src/interfaces/dap-client-behavior.ts': swap('  childTimeout?: number;', '  childTimeout?: number;\n  unreadFlag?: boolean;'),
      'packages/shared/src/interfaces/common-policy-shared.ts': swap('mirrorBreakpoints: false', 'mirrorBreakpoints: false, unreadFlag: false'),
      [java]: swap('({ mirrorBreakpoints: true })', '({ mirrorBreakpoints: true, unreadFlag: true })')
    });
    expect(m.contract.unread).toContain('getClientBehavior().unreadFlag');
    expect(m.contract.usersOf.get('getClientBehavior().unreadFlag')).toEqual(['python', 'ruby', 'java']);
    expect(keys(m, 'oneAdapterMembers')).toEqual(BASE_ONE_ADAPTER);
  });

  it('a placeholder every other engine fills is a use (documented limit, issue #1356)', async () => {
    const add = (value: string) => swap('  describe:', `  placeholder: () => ${value},\n  describe:`);
    const m = await measured({
      'packages/shared/src/interfaces/adapter-policy.ts': swap('  quirk?(): string;', '  quirk?(): string;\n  placeholder?(): boolean;'),
      [python]: add('false'), [ruby]: add('false'), [java]: add('true')
    });
    expect(m.contract.usersOf.get('placeholder')).toEqual(['python', 'ruby', 'java']);
  });
});

// ---------------------------------------------------------------------------
// Language branches
// ---------------------------------------------------------------------------

const BASE_BRANCHES = [
  "describeRun :: session.language === 'python'",
  'describeRun :: case DebugLanguage.RUBY:',
  "note :: language === 'java'"
];

describe('language branches outside the policy files', () => {
  it('counts a typed comparison, an enum case, and a string parameter the core passes a language', async () => {
    const m = await measured();
    expect(keys(m, 'languageBranches')).toEqual(BASE_BRANCHES.sort());
    expect(m.items.languageBranches.map(branch => branch.via).sort()).toEqual(['enum member', 'string parameter', 'typed']);
  });

  const probe = (source: string): Edit => ({
    'src/session/probe.ts': `import { DebugLanguage } from '@debugmcp/shared';\nimport type { ManagedSession } from './session-store.js';\nimport type { AdapterPolicy } from '@debugmcp/shared';\n${source}\nexport const unused: [typeof DebugLanguage, ManagedSession?, AdapterPolicy?] = [DebugLanguage];\n`
  });

  it.each([
    ['a membership test on a literal list', "export function f(s: ManagedSession): boolean { return ['python', 'ruby'].includes(s.language); }", 'membership'],
    ['a literal lookup table', "export function f(s: ManagedSession): number | undefined { return ({ python: 1, ruby: 2 } as Record<string, number>)[s.language]; }", 'index'],
    ['an in test on a literal table', "export function f(s: ManagedSession): boolean { return s.language in { python: 1 }; }", 'in'],
    ['a comparison with a const holding a language', "const engine = 'python';\nexport function f(s: ManagedSession): boolean { return s.language === engine; }", 'comparison'],
    ['a comparison inside switch (true)', "export function f(s: ManagedSession): boolean { switch (true) { case s.language === 'python': return true; default: return false; } }", 'comparison'],
    ['a comparison through a cast', "export function f(s: ManagedSession): boolean { return (s.language as string) === 'ruby'; }", 'comparison'],
    ["a policy's name", "export function f(p: AdapterPolicy): boolean { return p.name === 'java'; }", 'comparison'],
    ['a comparison with an enum member on a plain string', 'export function f(requested: string): boolean { return requested === DebugLanguage.PYTHON; }', 'comparison']
  ])('counts %s', async (_name, source, form) => {
    const m = await measured(probe(source));
    const added = m.items.languageBranches.filter(branch => branch.file === 'src/session/probe.ts');
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({ form });
  });

  it.each([
    ['an unrelated string compared with a language name', "export function isCoffee(flavour: string): boolean { return flavour === 'java'; }\nexport const order = isCoffee('mocha');"],
    ['the review\'s membership test on an untyped string nothing passes a language', "export function f(language: string): boolean { return ['python', 'ruby'].includes(language); }"],
    ['a membership test on a list of all supported languages', 'export function f(supported: DebugLanguage[], s: ManagedSession): boolean { return supported.includes(s.language); }'],
    ['a comparison of two languages', 'export function f(a: ManagedSession, b: ManagedSession): boolean { return a.language === b.language; }'],
    ['comments and strings', "// if (language === 'python')\nexport const s = \"language === 'python'\";\nexport const t = `language === 'python'`;"]
  ])('does not count %s', async (_name, source) => {
    const m = await measured(probe(source));
    expect(keys(m, 'languageBranches')).toEqual(BASE_BRANCHES.sort());
  });

  it('keeps a lost-type branch when another caller passes a plain string', async () => {
    const m = await measured({ 'src/session/branches.ts': text => `${text}export const other = note('x');\n` });
    expect(keys(m, 'languageBranches')).toEqual(BASE_BRANCHES.sort());
  });

  it('does not count a branch in a policy file', async () => {
    const m = await measured({
      'packages/shared/src/interfaces/adapter-policy-java.ts': text => `${text}export const isJava = (l: string): boolean => l === 'java';\nexport const check = isJava('x');\n`
    });
    expect(keys(m, 'languageBranches')).toEqual(BASE_BRANCHES.sort());
  });
});

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

describe('formatting', () => {
  it('reformatting, comments and line endings change no item', async () => {
    const before = await measured();
    const reformat: Edit = {};
    for (const file of Object.keys(BASE).filter(f => f.endsWith('.ts') && !f.endsWith('.d.ts'))) {
      reformat[file] = text => `// header: _updateSessionState( and language === 'python'\r\n${text.split('\n').map(line => `  ${line}`).join('\r\n\r\n')}`;
    }
    const after = await measured(reformat);
    for (const id of ['sessionStateWriters', 'directStateWrites', 'policyMembers', 'oneAdapterMembers', 'languageBranches'] as MeasureId[]) {
      expect(keys(after, id)).toEqual(keys(before, id));
    }
  });
});

// ---------------------------------------------------------------------------
// The gate: four outcomes, and an update that only lowers
// ---------------------------------------------------------------------------

describe('run', () => {
  const extraWriter: Edit = {
    'src/session/session-manager-core.ts': swap('    this._updateSessionState(session, SessionState.PAUSED);',
      '    this._updateSessionState(session, SessionState.PAUSED);\n    this._updateSessionState(session, SessionState.STOPPED);')
  };

  it('passes with one line per measure', async () => {
    const { result } = await recordedThen({});
    expect(result).toMatchObject({ code: 0, stderr: '' });
    expect(result.stdout.trimEnd().split('\n')).toEqual([
      'structure: session-state writers: 2',
      'structure: direct session-state writes: 0',
      'structure: AdapterPolicy members: 13',
      'structure: AdapterPolicy members used by one adapter: 4 (java 4)',
      'structure: language branches outside the policy files: 3'
    ]);
  });

  it('growth fails, names the new item with its place, and says how to accept it', async () => {
    const { result } = await recordedThen(extraWriter);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('structure: session-state writers: 2 recorded, 3 now. It grew by 1.');
    expect(result.stderr).toContain('  new:  src/session/session-manager-core.ts:11  SessionManagerCore.onStopped :: this._updateSessionState(session, SessionState.STOPPED)');
    expect(result.stderr).toContain('Reach the state through an existing transition');
    expect(result.stderr).toContain('--accept-growth');
  });

  it('a reduction fails as progress and asks for a re-record', async () => {
    const { result } = await recordedThen({ 'src/session/controller.ts': swap('    this.ctx.updateState(session, SessionState.RUNNING);\n', '') });
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('structure: session-state writers: 2 recorded, 1 now. 1 fewer.');
    expect(result.stderr).toContain('Fewer items is progress.');
    expect(result.stderr).not.toContain('debt');
  });

  it('a move or rename with an unchanged total passes, saying plainly that nothing grew', async () => {
    const { result } = await recordedThen({ 'src/session/controller.ts': text => text.replaceAll('step(', 'advance(') });
    expect(result.code).toBe(0);
    expect(result.stderr).toContain('structure: session-state writers: 2, unchanged. Nothing grew; 1 recorded item(s) moved, were renamed or changed:');
    expect(result.stderr).toContain('Nothing grew. Re-record to keep the item lists current');
    expect(result.stderr).not.toContain('debt');
  });

  it('--update refuses growth and writes nothing, even beside a reduction', async () => {
    const launder: Edit = {
      'src/session/controller.ts': swap('    this.ctx.updateState(session, SessionState.RUNNING);', '    session.state = SessionState.RUNNING;')
    };
    const { root } = await recordedThen(launder);
    const before = fs.readFileSync(path.join(root, BASELINE_FILE), 'utf-8');
    const update = await run(root, ['--update']);
    expect(update.code).toBe(1);
    expect(update.stderr).toContain('structure: direct session-state writes: 0 recorded, 1 now. It grew by 1.');
    expect(update.stderr).toContain('nothing\nwas written');
    expect(fs.readFileSync(path.join(root, BASELINE_FILE), 'utf-8')).toBe(before);
  });

  it('--update --accept-growth records each accepted item with its reason, and the check then passes', async () => {
    const { root } = await recordedThen(extraWriter);
    const update = await run(root, ['--update', '--accept-growth', 'the stop needs a second transition (#1)']);
    expect(update.code, update.stderr).toBe(0);
    expect(update.stdout).toContain('  accepted: src/session/session-manager-core.ts:11  SessionManagerCore.onStopped :: this._updateSessionState(session, SessionState.STOPPED)');
    const baseline = JSON.parse(fs.readFileSync(path.join(root, BASELINE_FILE), 'utf-8'));
    expect(baseline.sessionStateWriters.accepted).toEqual([{
      item: 'SessionManagerCore.onStopped :: this._updateSessionState(session, SessionState.STOPPED)',
      reason: 'the stop needs a second transition (#1)'
    }]);
    expect((await run(root, [])).code).toBe(0);

    // When the accepted item goes, a plain --update drops its entry with it.
    write(root, { 'src/session/session-manager-core.ts': swap('\n    this._updateSessionState(session, SessionState.STOPPED);', '') });
    expect((await run(root, ['--update'])).code).toBe(0);
    expect(JSON.parse(fs.readFileSync(path.join(root, BASELINE_FILE), 'utf-8')).sessionStateWriters.accepted).toEqual([]);
  });

  it('--accept-growth with a rename in the same measure records the reason on every new key, and says so', async () => {
    const renameAndAdd: Edit = {
      'src/session/controller.ts': text => text.replaceAll('step(', 'advance('),
      ...extraWriter
    };
    const { root } = await recordedThen(renameAndAdd);
    const update = await run(root, ['--update', '--accept-growth', 'second transition (#2)']);
    expect(update.code, update.stderr).toBe(0);
    expect(update.stdout).toContain('1 recorded item(s) are gone in the same change, so 2 item(s) are new to');
    expect(update.stdout).toContain("delete its 'accepted' entry");
    const accepted = JSON.parse(fs.readFileSync(path.join(root, BASELINE_FILE), 'utf-8')).sessionStateWriters.accepted;
    expect(accepted).toEqual([
      { item: 'Controller.advance :: this.ctx.updateState(session, SessionState.RUNNING)', reason: 'second transition (#2)' },
      { item: 'SessionManagerCore.onStopped :: this._updateSessionState(session, SessionState.STOPPED)', reason: 'second transition (#2)' }
    ]);
    expect((await run(root, [])).code).toBe(0);
  });

  it('--update re-records a reduction and a change', async () => {
    const { root } = await recordedThen({ 'src/session/controller.ts': swap('    this.ctx.updateState(session, SessionState.RUNNING);\n', '') });
    expect((await run(root, ['--update'])).code).toBe(0);
    expect((await run(root, [])).code).toBe(0);
  });

  it.each([
    [['--accept-growth', 'why'], '--accept-growth only means something with --update'],
    [['--update', '--accept-growth', ' '], '--accept-growth needs a reason'],
    [['--fix'], 'Unknown argument: --fix'],
    [['--init', '--update'], 'Pick one']
  ])('refuses %j with exit 2', async (argv, message) => {
    const { result } = await recordedThen({}, argv);
    expect(result.code).toBe(2);
    expect(result.stderr).toContain(message);
  });

  it('refuses --accept-growth when nothing grew', async () => {
    const { result } = await recordedThen({}, ['--update', '--accept-growth', 'no reason needed']);
    expect(result).toMatchObject({ code: 2, stderr: expect.stringContaining('nothing grew') });
  });

  it('refuses --init over an existing baseline, and a missing one points to --init', async () => {
    const { result } = await recordedThen({}, ['--init']);
    expect(result.code).toBe(2);
    expect((await run(tree(), [])).stderr).toContain('--init');
  });

  it('a corrupt baseline is refused with exit 2 and a pointer to restore it', async () => {
    const { result } = await recordedThen({ [BASELINE_FILE]: '{ broken' });
    expect(result.code).toBe(2);
    expect(result.stderr).toContain('is not valid JSON');
    expect(result.stderr).toContain(`git checkout origin/main -- ${BASELINE_FILE}`);
  });
});

describe('the analysis refuses to guess', () => {
  it.each<[string, Edit, string]>([
    ['a source that does not parse', { 'src/session/broken.ts': 'export const broken = ;\n' }, 'does not parse'],
    ['a policy that does not parse', { 'packages/shared/src/interfaces/adapter-policy-java.ts': text => `${text}\nexport const broken = ;\n` }, 'does not parse'],
    ['a type error', { 'src/session/broken.ts': 'export const n: number = "x";\n' }, 'type checker'],
    ['a renamed gate', {
      'src/session/session-manager-core.ts': text => text.replaceAll('_updateSessionState', '_setSessionState'),
      'src/session/session-manager-operations.ts': text => text.replaceAll('_updateSessionState', '_setSessionState')
    }, 'has no method _updateSessionState'],
    ['a language with no policy', { 'packages/shared/src/interfaces/adapter-policy-map.ts': swap('    case DebugLanguage.JAVA: return JavaAdapterPolicy;\n', '') }, "answers 'java' with the fallback"],
    ['a descriptor that throws', { 'packages/shared/src/interfaces/adapter-policy-java.ts': swap("getClientBehavior: () => ({ mirrorBreakpoints: true })", "getClientBehavior: () => { throw new Error('boom'); }") }, "java's getClientBehavior() threw"]
  ])('exits 2 on %s', async (_name, edit, message) => {
    const { result } = await recordedThen(edit);
    expect(result.code).toBe(2);
    expect(result.stderr).toContain(message);
  });
});

describe('parseBaseline', () => {
  const good = {
    sessionStateWriters: { count: 1, items: ['a'], accepted: [{ item: 'a', reason: 'r' }] },
    directStateWrites: { count: 0, items: [], accepted: [] },
    policyMembers: { count: 0, items: [], accepted: [] },
    oneAdapterMembers: { count: 0, items: [], accepted: [] },
    languageBranches: { count: 0, items: [], accepted: [] }
  };

  it('accepts a well-formed baseline', () => {
    expect(parseBaseline(JSON.stringify(good))).toEqual(good);
  });

  it.each<[string, unknown, RegExp]>([
    ['a count that disagrees with the items', { ...good, directStateWrites: { count: 2, items: [], accepted: [] } }, /count/],
    ['an accepted item the measure does not record', { ...good, directStateWrites: { count: 0, items: [], accepted: [{ item: 'x', reason: 'r' }] } }, /names an item/],
    ['an accepted entry without a reason', { ...good, sessionStateWriters: { count: 1, items: ['a'], accepted: [{ item: 'a', reason: '' }] } }, /accepted/],
    ['a missing measure', { ...good, languageBranches: undefined }, /missing languageBranches/],
    ['an unknown measure', { ...good, extra: {} }, /unknown extra/]
  ])('refuses %s', (_name, value, message) => {
    expect(() => parseBaseline(JSON.stringify(value))).toThrow(StructureError);
    expect(() => parseBaseline(JSON.stringify(value))).toThrow(message);
  });
});
