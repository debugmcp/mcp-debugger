/**
 * Every place that writes a session's state names its site and event, and
 * each names the event of its row (src/session/machine/transition-table.ts).
 * Read from the sources of src/session with the TypeScript parser, so that a
 * state write added without a site, a site named with the wrong event, a
 * second direct assignment of `.state`, or a test mark in production code
 * fails here.
 *
 * What the scan sees, by name, outside the gate itself (`_updateSessionState`
 * and `writeSessionState`, and the context's forwarding `updateState`):
 * - a call of `updateState` or `_updateSessionState` on any receiver;
 * - a call of `update` or `updateSession` whose object literal has a `state` key;
 * - an assignment to `.state` on any receiver but `this` (the store's own
 *   write, in session-store.ts, aside).
 * What a scan of names cannot see: a write through an alias (a method taken
 * off its object and called later), a computed key (`{ ['state']: … }`), an
 * object spread or `Object.assign` from a variable, and anything outside
 * src/session. Closing those is the compiler's job, once the stage that makes
 * a session's `state` read-only to everything but the gate lands.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import path from 'path';
import ts from 'typescript';
import { EVENT_OF_SITE } from '../../../../src/session/machine/transition-table.js';

const ROOT = path.resolve(__dirname, '../../../..');
const SESSION_DIR = path.join(ROOT, 'src', 'session');

type Kind = 'gate' | 'note' | 'direct' | 'replacement';

interface Found {
  file: string;
  line: number;
  kind: Kind;
  site?: string;
  events: string[];
}

/**
 * Where each state write is, what it is, and the events it names. The
 * comment on each row is the transition it makes and what triggers it.
 */
const EXPECTED: Array<{ file: string; site: string; kind: Kind; events: string[] }> = [
  // attach-controller.ts
  { file: 'attach/attach-controller.ts', site: 'attach.replace', kind: 'replacement', events: ['replace'] }, // a live run or child, after the teardown
  { file: 'attach/attach-controller.ts', site: 'attach', kind: 'gate', events: ['start'] }, // -> INITIALIZING, the attach starts
  { file: 'attach/attach-controller.ts', site: 'attach.verified', kind: 'gate', events: ['attach-verified'] }, // -> RUNNING, threads verified, no stop observed
  { file: 'attach/attach-controller.ts', site: 'attach.failed', kind: 'gate', events: ['start-failed'] }, // -> ERROR, the attach failed
  { file: 'attach/attach-controller.ts', site: 'detach', kind: 'gate', events: ['release'] }, // -> STOPPED, a plain detach
  // execution-controller.ts
  { file: 'execution/execution-controller.ts', site: 'step.failed', kind: 'gate', events: ['resume-failed', 'answer-failed'] }, // -> ERROR, before or after the step landed
  { file: 'execution/execution-controller.ts', site: 'executeStep.sent', kind: 'gate', events: ['resume'] }, // PAUSED -> RUNNING, the step request goes out
  { file: 'execution/execution-controller.ts', site: 'executeStep.refused', kind: 'gate', events: ['resume-refused'] }, // -> PAUSED, the adapter refused, no continued
  { file: 'execution/execution-controller.ts', site: 'executeStep.refused-unrecorded', kind: 'direct', events: ['resume-refused'] }, // -> PAUSED by assignment, no stop recorded
  { file: 'execution/execution-controller.ts', site: 'executeStep.failed', kind: 'gate', events: ['resume-failed'] }, // -> ERROR, the step request failed otherwise
  { file: 'execution/execution-controller.ts', site: 'continue.sent', kind: 'gate', events: ['resume', 'resume-unseen'] }, // PAUSED -> RUNNING, the caller's or the core's own
  { file: 'execution/execution-controller.ts', site: 'continue.rejected', kind: 'gate', events: ['resume-refused', 'resume-unanswered', 'resume-unseen-failed'] }, // -> PAUSED unless terminal
  // debug-launcher.ts
  { file: 'launch/debug-launcher.ts', site: 'launch.replace', kind: 'replacement', events: ['replace'] }, // a live run or child, after the teardown
  { file: 'launch/debug-launcher.ts', site: 'launch', kind: 'gate', events: ['start'] }, // -> INITIALIZING, the launch starts
  { file: 'launch/debug-launcher.ts', site: 'launch.refused', kind: 'gate', events: ['start-refused'] }, // -> CREATED, an incompatible toolchain
  { file: 'launch/debug-launcher.ts', site: 'launch.failed', kind: 'gate', events: ['start-failed'] }, // -> ERROR, the launch failed
  { file: 'launch/debug-launcher.ts', site: 'hotRestart.sent', kind: 'gate', events: ['hot-restart'] }, // PAUSED -> RUNNING, DAP restart goes out
  { file: 'launch/debug-launcher.ts', site: 'hotRestart.sent', kind: 'note', events: ['hot-restart'] }, // from RUNNING: no state written
  { file: 'launch/debug-launcher.ts', site: 'hotRestart.rejected', kind: 'gate', events: ['resume-refused', 'resume-unanswered'] }, // -> PAUSED, restart refused or unanswered
  // session-manager-core.ts
  { file: 'session-manager-core.ts', site: 'releaseDescendants', kind: 'gate', events: ['release'] }, // -> STOPPED, the detach cascade released a child
  { file: 'session-manager-core.ts', site: 'closeSingleSession', kind: 'gate', events: ['close'] }, // any -> STOPPED, then removed
  { file: 'session-manager-core.ts', site: 'adoptReportedChild', kind: 'gate', events: ['adopt'] }, // CREATED -> RUNNING, a child adopted
  { file: 'session-manager-core.ts', site: 'settleStop.hidden', kind: 'gate', events: ['stop-hidden'] }, // -> PAUSED transiently, an unseen entry stop
  { file: 'session-manager-core.ts', site: 'settleStop.shown', kind: 'gate', events: ['stop-shown'] }, // -> PAUSED, a shown stop
  { file: 'session-manager-core.ts', site: 'handleContinued', kind: 'note', events: ['continued'] }, // while PAUSED: stale, no state written
  { file: 'session-manager-core.ts', site: 'handleContinued', kind: 'gate', events: ['continued'] }, // -> RUNNING unless PAUSED
  { file: 'session-manager-core.ts', site: 'handleTerminated', kind: 'gate', events: ['terminated'] }, // -> STOPPED, DAP terminated
  { file: 'session-manager-core.ts', site: 'handleExited', kind: 'gate', events: ['exited'] }, // -> STOPPED, DAP exited
  { file: 'session-manager-core.ts', site: 'handleAdapterConfigured', kind: 'gate', events: ['adapter-configured'] }, // -> RUNNING unless PAUSED or stopOnEntry
  { file: 'session-manager-core.ts', site: 'handleError', kind: 'gate', events: ['error'] }, // -> ERROR, the proxy's error
  { file: 'session-manager-core.ts', site: 'handleExit.expected', kind: 'gate', events: ['worker-exit'] }, // -> STOPPED, exit reported expected
  { file: 'session-manager-core.ts', site: 'handleExit.unexpected', kind: 'gate', events: ['worker-exit'] }, // -> STOPPED on code 0, else ERROR
  { file: 'session-manager-core.ts', site: 'handleExit.clean', kind: 'gate', events: ['worker-exit'] }, // -> STOPPED, real exit code 0 or null
  { file: 'session-manager-core.ts', site: 'handleExit.crashed', kind: 'gate', events: ['worker-exit'] }, // -> ERROR, real exit otherwise
  { file: 'session-manager-core.ts', site: 'handleExit.ended', kind: 'note', events: ['worker-exit'] } // already terminal: evidence
];

/** The test files allowed to pass the test mark to the gate themselves. */
const TEST_SETUP_FILES = [
  'tests/core/unit/session/session-manager-dap.test.ts',
  'tests/unit/session-manager-operations-coverage.test.ts',
  'tests/unit/session/machine/shadow.test.ts'
];

function sourceFiles(dir: string, filter: (file: string) => boolean): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name !== 'node_modules' && name !== 'dist') out.push(...sourceFiles(full, filter));
    } else if (filter(full)) {
      out.push(full);
    }
  }
  return out;
}

/** The string literals a property can take: a literal, or either branch of a conditional. */
function literals(node: ts.Expression): string[] {
  if (ts.isStringLiteral(node)) return [node.text];
  if (ts.isConditionalExpression(node)) return [...literals(node.whenTrue), ...literals(node.whenFalse)];
  if (ts.isParenthesizedExpression(node)) return literals(node.expression);
  return [];
}

function stringsOf(node: ts.Expression | undefined, key: string): string[] {
  if (!node) return [];
  if (ts.isConditionalExpression(node)) return [...stringsOf(node.whenTrue, key), ...stringsOf(node.whenFalse, key)];
  if (ts.isParenthesizedExpression(node)) return stringsOf(node.expression, key);
  if (!ts.isObjectLiteralExpression(node)) return [];
  for (const property of node.properties) {
    if (ts.isPropertyAssignment(property) && ts.isIdentifier(property.name) && property.name.text === key) {
      return literals(property.initializer);
    }
  }
  return [];
}

/** Inside the gate itself, or the context's forwarding arrow: not a site. */
function insideTheGate(node: ts.Node): boolean {
  for (let current = node.parent; current; current = current.parent) {
    if ((ts.isPropertyAssignment(current) || ts.isMethodDeclaration(current)) && ts.isIdentifier(current.name) &&
      ['updateState', '_updateSessionState', 'writeSessionState'].includes(current.name.text)) {
      return true;
    }
  }
  return false;
}

/** An object literal with a `state` key, written as `state: …` or shorthand `state`. */
function hasStateKey(node: ts.Expression | undefined): boolean {
  return node !== undefined && ts.isObjectLiteralExpression(node) && node.properties.some((property) =>
    (ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property)) &&
    ts.isIdentifier(property.name) && property.name.text === 'state');
}

interface Scan {
  found: Found[];
  /** `update`/`updateSession` calls carrying a `state` key. */
  patches: string[];
  /** `.state =` assignments on a receiver other than `this`. */
  assignments: string[];
}

/** Every state write in one source text, by the parser. */
function scanSource(relative: string, text: string): Scan {
  const scan: Scan = { found: [], patches: [], assignments: [] };
  const source = ts.createSourceFile(relative, text, ts.ScriptTarget.Latest, true);
  const lineOf = (node: ts.Node) => source.getLineAndCharacterOfPosition(node.getStart()).line + 1;
  const where = (node: ts.Node) => `${relative}:${lineOf(node)}`;
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const name = node.expression.name.text;
      const receiver = node.expression.expression.getText(source);
      if ((name === 'updateState' || name === '_updateSessionState') && !insideTheGate(node)) {
        const write = node.arguments[2];
        scan.found.push({ file: relative, line: lineOf(node), kind: 'gate', site: stringsOf(write, 'site')[0], events: stringsOf(write, 'event') });
      } else if ((name === 'update' || name === 'updateSession') && node.arguments.some((argument) => hasStateKey(argument))) {
        scan.patches.push(where(node));
      } else if (name === 'note' && receiver.endsWith('stateShadow')) {
        const write = node.arguments[1];
        scan.found.push({
          file: relative,
          line: lineOf(node),
          kind: node.arguments.length > 2 ? 'direct' : 'note',
          site: stringsOf(write, 'site')[0],
          events: stringsOf(write, 'event')
        });
      } else if (name === 'noteReplacement' && receiver.endsWith('stateShadow')) {
        const site = node.arguments[1];
        scan.found.push({ file: relative, line: lineOf(node), kind: 'replacement', site: site && ts.isStringLiteral(site) ? site.text : undefined, events: ['replace'] });
      }
    }
    if (
      ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isPropertyAccessExpression(node.left) && node.left.name.text === 'state' &&
      node.left.expression.kind !== ts.SyntaxKind.ThisKeyword
    ) {
      scan.assignments.push(where(node));
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return scan;
}

/** Every state write in src/session; the store's own module aside for assignments and patches. */
function scan(): Scan {
  const all: Scan = { found: [], patches: [], assignments: [] };
  for (const file of sourceFiles(SESSION_DIR, (f) => f.endsWith('.ts'))) {
    const relative = path.relative(SESSION_DIR, file).split(path.sep).join('/');
    const one = scanSource(relative, readFileSync(file, 'utf8'));
    all.found.push(...one.found.filter((f) => relative !== 'session-store.ts' || f.kind !== 'gate'));
    if (relative !== 'session-store.ts') {
      all.patches.push(...one.patches);
      all.assignments.push(...one.assignments);
    }
  }
  return all;
}

describe('the state-writing sites', () => {
  const { found, patches, assignments } = scan();

  it('every gate call names a site and an event', () => {
    const unnamed = found.filter((f) => f.site === undefined || f.events.length === 0);
    expect(unnamed).toEqual([]);
  });

  it('are exactly the expected sites, each with the event of its row', () => {
    const actual = found
      .map(({ file, site, kind, events }) => ({ file, site: site!, kind, events: [...events].sort() }))
      .sort((a, b) => `${a.file}${a.site}${a.kind}`.localeCompare(`${b.file}${b.site}${b.kind}`));
    const expected = EXPECTED
      .map((e) => ({ ...e, events: [...e.events].sort() }))
      .sort((a, b) => `${a.file}${a.site}${a.kind}`.localeCompare(`${b.file}${b.site}${b.kind}`));
    expect(actual).toEqual(expected);
  });

  it('name events their site lists in EVENT_OF_SITE, and the table lists no site the code lacks', () => {
    for (const f of found) {
      const events = (EVENT_OF_SITE as Record<string, readonly string[]>)[f.site!];
      expect(events, f.site).toBeDefined();
      for (const event of f.events) expect(events, `${f.file}:${f.line} ${f.site}`).toContain(event);
    }
    const used = new Set(found.map((f) => f.site));
    expect(Object.keys(EVENT_OF_SITE).filter((site) => !used.has(site))).toEqual([]);
  });

  it('29 gate calls and one direct assignment write the state, and no patch carries a state: the count of writers does not rise', () => {
    expect(found.filter((f) => f.kind === 'gate')).toHaveLength(29);
    expect(assignments).toHaveLength(1);
    expect(assignments[0]).toMatch(/^execution\/execution-controller\.ts:\d+$/);
    expect(patches).toEqual([]);
  });

  it('the scan sees each shape it claims to: any receiver, the store outside the gate, a state patch, a direct assignment', () => {
    const probe = scanSource('probe.ts', [
      'function helper(ctx: any, s: any) { ctx.updateState(s, "running", { site: "x", event: "resume" }); }',
      'class A { other(this: any, s: any) { this.sessionStore.updateState(s.id, "running"); }',
      '  writeSessionState(this: any, s: any) { this.sessionStore.updateState(s.id, "running"); } }',
      'function patch(store: any, id: string, state: string) { store.update(id, { state }); store.updateSession(id, { state: "x" }); store.update(id, { other: 1 }); }',
      'function assign(s: any) { s.state = "paused"; }'
    ].join('\n'));
    expect(probe.found.map((f) => `${f.line} ${f.site ?? '(no site)'}`)).toEqual(['1 x', '2 (no site)']);
    expect(probe.patches).toEqual(['probe.ts:4', 'probe.ts:4']);
    expect(probe.assignments).toEqual(['probe.ts:5']);
  });

  it('the test mark is used by no production file, and by the listed test files only', () => {
    const mark = /TEST_SETUP_WRITE/;
    const inSrc = sourceFiles(path.join(ROOT, 'src'), (f) => f.endsWith('.ts'))
      .filter((f) => mark.test(readFileSync(f, 'utf8')))
      .map((f) => path.relative(ROOT, f).split(path.sep).join('/'));
    expect(inSrc).toEqual(['src/session/machine/transition-table.ts']);
    const inTests = sourceFiles(path.join(ROOT, 'tests'), (f) => f.endsWith('.ts'))
      .filter((f) => mark.test(readFileSync(f, 'utf8')))
      .map((f) => path.relative(ROOT, f).split(path.sep).join('/'))
      .filter((f) => f !== 'tests/unit/session/machine/shadow-sites.test.ts')
      .sort();
    expect(inTests).toEqual([...TEST_SETUP_FILES].sort());
  });
});
