/**
 * Every place that writes a session's state names its site and event, and
 * each names the event of its row (src/session/machine/transition-table.ts).
 * Read from the sources with the TypeScript parser, so a gate call added
 * without a site, a site named with the wrong event, a second direct
 * assignment of `.state`, or a test mark in production code fails here.
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
  { file: 'attach/attach-controller.ts', site: 'attach.replace', kind: 'replacement', events: ['replace'] }, // a live run or child, before the teardown
  { file: 'attach/attach-controller.ts', site: 'attach', kind: 'gate', events: ['start'] }, // -> INITIALIZING, the attach starts
  { file: 'attach/attach-controller.ts', site: 'attach.verified', kind: 'gate', events: ['attach-verified'] }, // -> RUNNING, threads verified, no stop observed
  { file: 'attach/attach-controller.ts', site: 'attach.failed', kind: 'gate', events: ['start-failed'] }, // -> ERROR, the attach failed, not terminal
  { file: 'attach/attach-controller.ts', site: 'detach', kind: 'gate', events: ['release'] }, // -> STOPPED, a plain detach
  // execution-controller.ts
  { file: 'execution/execution-controller.ts', site: 'step.failed', kind: 'gate', events: ['resume-failed'] }, // -> ERROR, the step threw a non-DAP error
  { file: 'execution/execution-controller.ts', site: 'executeStep.sent', kind: 'gate', events: ['resume'] }, // PAUSED -> RUNNING, the step request goes out
  { file: 'execution/execution-controller.ts', site: 'executeStep.refused', kind: 'gate', events: ['resume-refused'] }, // -> PAUSED, the adapter refused, no continued
  { file: 'execution/execution-controller.ts', site: 'executeStep.refused-unrecorded', kind: 'direct', events: ['resume-refused'] }, // -> PAUSED by assignment, no stop recorded
  { file: 'execution/execution-controller.ts', site: 'executeStep.failed', kind: 'gate', events: ['resume-failed'] }, // -> ERROR, the step request failed otherwise
  { file: 'execution/execution-controller.ts', site: 'continue.sent', kind: 'gate', events: ['resume', 'resume-unseen'] }, // PAUSED -> RUNNING, the caller's or the core's own
  { file: 'execution/execution-controller.ts', site: 'continue.refused', kind: 'gate', events: ['resume-refused', 'resume-unseen-failed'] }, // -> PAUSED unless terminal
  // debug-launcher.ts
  { file: 'launch/debug-launcher.ts', site: 'launch.replace', kind: 'replacement', events: ['replace'] }, // a live run or child, before the teardown
  { file: 'launch/debug-launcher.ts', site: 'launch', kind: 'gate', events: ['start'] }, // -> INITIALIZING, the launch starts
  { file: 'launch/debug-launcher.ts', site: 'launch.refused', kind: 'gate', events: ['start-refused'] }, // -> CREATED, an incompatible toolchain
  { file: 'launch/debug-launcher.ts', site: 'launch.failed', kind: 'gate', events: ['start-failed'] }, // -> ERROR, the launch failed
  { file: 'launch/debug-launcher.ts', site: 'hotRestart.sent', kind: 'gate', events: ['hot-restart'] }, // PAUSED -> RUNNING, DAP restart goes out
  { file: 'launch/debug-launcher.ts', site: 'hotRestart.sent', kind: 'note', events: ['hot-restart'] }, // from RUNNING: no state written
  { file: 'launch/debug-launcher.ts', site: 'hotRestart.refused', kind: 'gate', events: ['resume-refused'] }, // -> PAUSED, restart refused
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
  { file: 'session-manager-core.ts', site: 'handleExit.expected', kind: 'gate', events: ['worker-exit'] }, // -> STOPPED, worker exit expected
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

function stringsOf(node: ts.Expression | undefined, key: string): string[] {
  if (!node) return [];
  if (ts.isConditionalExpression(node)) return [...stringsOf(node.whenTrue, key), ...stringsOf(node.whenFalse, key)];
  if (ts.isParenthesizedExpression(node)) return stringsOf(node.expression, key);
  if (!ts.isObjectLiteralExpression(node)) return [];
  for (const property of node.properties) {
    if (ts.isPropertyAssignment(property) && ts.isIdentifier(property.name) && property.name.text === key && ts.isStringLiteral(property.initializer)) {
      return [property.initializer.text];
    }
  }
  return [];
}

/** Inside the gate itself or the context's forwarding arrow: not a site (the census rule). */
function insideTheGate(node: ts.Node): boolean {
  for (let current = node.parent; current; current = current.parent) {
    if ((ts.isPropertyAssignment(current) || ts.isMethodDeclaration(current)) && ts.isIdentifier(current.name) &&
      (current.name.text === 'updateState' || current.name.text === '_updateSessionState')) {
      return true;
    }
  }
  return false;
}

/** Every state write in src/session, by the parser. */
function scan(): Found[] {
  const found: Found[] = [];
  for (const file of sourceFiles(SESSION_DIR, (f) => f.endsWith('.ts'))) {
    const relative = path.relative(SESSION_DIR, file).split(path.sep).join('/');
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    const lineOf = (node: ts.Node) => source.getLineAndCharacterOfPosition(node.getStart()).line + 1;
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const name = node.expression.name.text;
        const receiver = node.expression.expression.getText(source);
        if ((name === 'updateState' && receiver === 'this.ctx' || name === '_updateSessionState' && receiver === 'this') && !insideTheGate(node)) {
          const write = node.arguments[2];
          const sites = stringsOf(write, 'site');
          found.push({ file: relative, line: lineOf(node), kind: 'gate', site: sites[0], events: stringsOf(write, 'event') });
          expect(new Set(sites).size, `${relative}:${lineOf(node)} names one site`).toBeLessThanOrEqual(1);
        } else if (name === 'note' && receiver.endsWith('stateShadow')) {
          const write = node.arguments[1];
          found.push({
            file: relative,
            line: lineOf(node),
            kind: node.arguments.length > 2 ? 'direct' : 'note',
            site: stringsOf(write, 'site')[0],
            events: stringsOf(write, 'event')
          });
        } else if (name === 'noteReplacement' && receiver.endsWith('stateShadow')) {
          const site = node.arguments[1];
          found.push({ file: relative, line: lineOf(node), kind: 'replacement', site: site && ts.isStringLiteral(site) ? site.text : undefined, events: ['replace'] });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return found;
}

/** `.state =` assignments in src/session on a receiver other than `this`, the store's own write aside. */
function directStateWrites(): string[] {
  const out: string[] = [];
  for (const file of sourceFiles(SESSION_DIR, (f) => f.endsWith('.ts') && !f.endsWith('session-store.ts'))) {
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    const visit = (node: ts.Node): void => {
      if (
        ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        ts.isPropertyAccessExpression(node.left) && node.left.name.text === 'state' &&
        node.left.expression.kind !== ts.SyntaxKind.ThisKeyword
      ) {
        out.push(`${path.relative(SESSION_DIR, file).split(path.sep).join('/')}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}`);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return out;
}

describe('the state-writing sites', () => {
  const found = scan();

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

  it('29 gate calls and one direct assignment write the state: the count of writers does not rise', () => {
    expect(found.filter((f) => f.kind === 'gate')).toHaveLength(29);
    const direct = directStateWrites();
    expect(direct).toHaveLength(1);
    expect(direct[0]).toMatch(/^execution\/execution-controller\.ts:\d+$/);
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
