/**
 * The session tree with real js-debug (issue #1082): a Node program's forks
 * used to be released to run undebugged after the program's own target (#501).
 * With `autoAttachChildProcesses` on, js-debug reports each fork on the
 * program's connection and the server adopts it as a child debug session on a
 * connection of its own — the M1 mechanism (#1081) under js-debug's measured
 * shapes (docs/javascript/spike-notes-forks.md): the report is answered the
 * moment it is held, release is a throwaway attach, the tree's output lands
 * on the launch session only, and a child's close releases it.
 *
 * Every case names the key explicitly for the record; it is on by default
 * since M2's second PR, which the attach and cascade suites rely on.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startStdioClient, type StdioClientHandle, type ToolAnswer } from '../../../test-utils/helpers/mcp-stdio-client.js';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const treeDir = path.join(root, 'tests/fixtures/javascript/subprocess-tree');
const parentFixture = path.join(treeDir, 'parent.js');
const childFixture = path.join(treeDir, 'child.js');
const childGrandFixture = path.join(treeDir, 'child_grand.js');
const grandchildFixture = path.join(treeDir, 'grandchild.js');
const parentExitsFixture = path.join(treeDir, 'parent_exits.js');
/** The `// BREAKPOINT` lines of the fixtures. */
const PARENT_BREAKPOINT_LINE = 20;
const CHILD_BREAKPOINT_LINE = 14;
const CHILD_GRAND_BREAKPOINT_LINE = 18;
const GRANDCHILD_BREAKPOINT_LINE = 9;

interface Row { id: string; name: string; state: string; language: string; parentSessionId?: string }
interface ChildSummary { sessionId: string; name: string; state: string; parentSessionId: string }
interface Stop extends ToolAnswer {
  sessionId?: string;
  pending?: boolean;
  exitCode?: number;
  location?: { file: string; line: number };
  lastStop?: { line?: number };
  children?: ChildSummary[];
  childrenClosed?: number;
  childrenReleased?: number;
}
interface Closed extends ToolAnswer { childrenClosed?: number; processEnded?: boolean; released?: boolean }
interface Output extends ToolAnswer { entries: Array<{ output: string }>; outputOn?: string; note?: string }
interface Stack extends ToolAnswer { stackFrames: Array<{ id: number; file?: string; line?: number }> }

let server: StdioClientHandle;
const call = <T extends ToolAnswer = ToolAnswer>(name: string, args: Record<string, unknown> = {}): Promise<T> => server.call<T>(name, args);
const rows = async (): Promise<Row[]> => (await call<ToolAnswer & { sessions: Row[] }>('list_debug_sessions')).sessions;
const outputOf = (sessionId: string): Promise<Output> => call<Output>('get_output', { sessionId, limit: 1000 });
const outputText = async (sessionId: string): Promise<string> => (await outputOf(sessionId)).entries.map((e) => e.output).join('');
const lineOf = (stop: Stop): number | undefined => stop.location?.line ?? stop.lastStop?.line;
const fileOf = (stop: Stop): string => stop.location?.file ?? '';

async function pollUntil<T>(read: () => Promise<T>, accept: (value: T) => boolean, timeoutMs: number, intervalMs = 250): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let last = await read();
  while (!accept(last) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    last = await read();
  }
  return last;
}

async function launch(scriptPath: string, extra: Record<string, unknown> = {}): Promise<Stop> {
  const started = await call<Stop>('start_debugging', {
    scriptPath,
    breakOnExceptions: 'none',
    dapLaunchArgs: { stopOnEntry: false, autoAttachChildProcesses: true },
    ...extra
  });
  expect(started.success, JSON.stringify(started)).toBe(true);
  return started;
}

/**
 * Wait on `sessionId` for a stop that must be a paused child of the tree at
 * `line`, and hand back its id. Under load js-debug can surface an adopted
 * child's first statement as a `pause` stop before its breakpoint (measured
 * once in the pre-push hook with four cluster workers starting at once:
 * reason 'pause', "Paused on debugger statement", at the module's first
 * line, which the js policy reports as a breakpoint); that stop is js-debug's
 * entry pause, not the tree's doing, so it is resumed and the wait repeated.
 */
async function waitForChildStop(sessionId: string, file: RegExp, line: number): Promise<Stop & { sessionId: string }> {
  for (let entryPauses = 0; ; entryPauses += 1) {
    const stop = await call<Stop>('wait_for_stop', { sessionId, timeout: 30000 });
    expect(stop.state, JSON.stringify(stop)).toBe('paused');
    expect(stop.sessionId, JSON.stringify(stop)).toBeDefined();
    expect(stop.sessionId).not.toBe(sessionId);
    expect(fileOf(stop), JSON.stringify(stop)).toMatch(file);
    if (lineOf(stop) === line || entryPauses >= 2) {
      expect(lineOf(stop), JSON.stringify(stop)).toBe(line);
      return stop as Stop & { sessionId: string };
    }
    const resumed = await call('continue_execution', { sessionId: stop.sessionId });
    expect(resumed.success, JSON.stringify(resumed)).toBe(true);
  }
}

async function startClient(env: Record<string, string> = {}): Promise<void> {
  server = await startStdioClient({ name: 'js-subprocess-tree', callTimeoutMs: 60_000, env });
}

beforeEach(async () => {
  await startClient();
});

afterEach(async () => {
  await server?.close();
}, 20_000);

describe('JavaScript forks as child sessions (the session tree, issue #1082)', () => {
  /**
   * The designed flow (docs/architecture/session-tree.md): a breakpoint in
   * the fork's code only, start the parent, wait on the parent. The wait
   * answers the fork's stop with the fork's id, again after each continue,
   * and the parent's own end once the fork has ended.
   */
  it("the parent's wait_for_stop reports the fork's stops with its sessionId, its output points at the launch session, then the parent ends", async () => {
    const rootId = await server.createSession('javascript', 'js-tree-designed-flow');
    const childBp = await call('set_breakpoint', { file: childFixture, line: CHILD_BREAKPOINT_LINE });
    expect(childBp.success, JSON.stringify(childBp)).toBe(true);
    const started = await launch(parentFixture);
    expect(started.state, JSON.stringify(started)).toBe('running');

    let childId: string | undefined;
    for (let iteration = 0; iteration < 3; iteration += 1) {
      const stop = await waitForChildStop(rootId, /child\.js$/, CHILD_BREAKPOINT_LINE);
      childId ??= stop.sessionId;
      expect(stop.sessionId).toBe(childId);
      expect(stop.children, JSON.stringify(stop)).toEqual([
        { sessionId: childId, name: expect.stringMatching(/child\.js \[\d+\]$/), state: 'paused', parentSessionId: rootId }
      ]);
      // The answer's own stop is the fork's: inspect it with that id.
      const stack = await call<Stack>('get_stack_trace', { sessionId: childId });
      expect(stack.success, JSON.stringify(stack)).toBe(true);
      expect(stack.stackFrames[0]?.line).toBe(CHILD_BREAKPOINT_LINE);
      const tick = await call<ToolAnswer & { result?: string }>('evaluate_expression', { sessionId: childId, expression: 'i', frameId: stack.stackFrames[0].id });
      expect(tick.success, JSON.stringify(tick)).toBe(true);
      expect(tick.result).toBe(String(iteration));
      const resumed = await call('continue_execution', { sessionId: childId });
      expect(resumed.success, JSON.stringify(resumed)).toBe(true);
    }

    const listing = await rows();
    const childRow = listing.find((row) => row.id === childId);
    expect(childRow, JSON.stringify(listing)).toMatchObject({ language: 'javascript', parentSessionId: rootId });

    // The fork runs to its end; the parent then sees its exit code and ends.
    const ended = await call<Stop>('wait_for_stop', { sessionId: rootId, timeout: 30000 });
    expect(ended.state, JSON.stringify(ended)).toBe('stopped');
    expect(ended.sessionId, JSON.stringify(ended)).toBe(rootId);
    expect(ended.exitCode, JSON.stringify(ended)).toBe(0);
    expect(ended.children, JSON.stringify(ended)).toEqual([
      expect.objectContaining({ sessionId: childId, state: 'stopped', parentSessionId: rootId })
    ]);

    // The whole tree's output is the launch session's (js-debug delivers it on the root connection only)…
    const rootOutput = await pollUntil(() => outputText(rootId), (text) => text.includes('parent child exit 0'), 5000);
    expect(rootOutput).toContain('parent start');
    expect(rootOutput).toContain('child start');
    expect(rootOutput).toContain('child done 3');
    expect(rootOutput).toContain('parent child exit 0');
    // …and the fork's own answer says so instead of pretending it printed nothing.
    const childOutput = await outputOf(childId!);
    expect(childOutput.entries).toEqual([]);
    expect(childOutput.outputOn).toBe(rootId);
    expect(childOutput.note).toContain(rootId);
  }, 120_000);

  it('a grandchild the fork starts hangs under the fork, and the root’s wait reports it too', async () => {
    const rootId = await server.createSession('javascript', 'js-tree-grandchild');
    expect((await call('set_breakpoint', { file: childGrandFixture, line: CHILD_GRAND_BREAKPOINT_LINE })).success).toBe(true);
    expect((await call('set_breakpoint', { file: grandchildFixture, line: GRANDCHILD_BREAKPOINT_LINE })).success).toBe(true);
    await launch(parentFixture, { args: ['child_grand.js'] });

    const childStop = await waitForChildStop(rootId, /child_grand\.js$/, CHILD_GRAND_BREAKPOINT_LINE);
    const childId = childStop.sessionId;
    expect((await call('continue_execution', { sessionId: childId })).success).toBe(true);

    const grandchildStop = await waitForChildStop(rootId, /grandchild\.js$/, GRANDCHILD_BREAKPOINT_LINE);
    const grandchildId = grandchildStop.sessionId;
    expect(grandchildId).not.toBe(childId);
    // Pre-order: the fork, then its grandchild; the grandchild's parent is the fork.
    expect(grandchildStop.children).toEqual([
      expect.objectContaining({ sessionId: childId, parentSessionId: rootId }),
      expect.objectContaining({ sessionId: grandchildId, state: 'paused', parentSessionId: childId })
    ]);
    const listing = await rows();
    expect(listing.find((row) => row.id === grandchildId)).toMatchObject({ parentSessionId: childId, name: expect.stringMatching(/grandchild\.js \[\d+\]$/) });

    // A wait on the fork's own id observes its subtree: the paused grandchild.
    const viaChild = await call<Stop>('wait_for_stop', { sessionId: childId, timeout: 5000 });
    expect(viaChild.sessionId).toBe(grandchildId);

    expect((await call('continue_execution', { sessionId: grandchildId })).success).toBe(true);
    const second = await waitForChildStop(rootId, /grandchild\.js$/, GRANDCHILD_BREAKPOINT_LINE);
    expect(second.sessionId).toBe(grandchildId);
    expect((await call('continue_execution', { sessionId: grandchildId })).success).toBe(true);

    const ended = await call<Stop>('wait_for_stop', { sessionId: rootId, timeout: 30000 });
    expect(ended.state, JSON.stringify(ended)).toBe('stopped');
    expect(ended.sessionId).toBe(rootId);
    expect(ended.children).toEqual([
      expect.objectContaining({ sessionId: childId, state: 'stopped' }),
      expect.objectContaining({ sessionId: grandchildId, state: 'stopped' })
    ]);
    const output = await pollUntil(() => outputText(rootId), (text) => text.includes('parent child exit 0'), 5000);
    expect(output).toContain('grandchild done 3');
    expect(output).toContain('child grandchild exit 0');
  }, 120_000);

  it("closing a paused fork releases it to run on (js-debug cannot end a target it adopted), and says released", async () => {
    const rootId = await server.createSession('javascript', 'js-tree-close-child');
    expect((await call('set_breakpoint', { file: childFixture, line: CHILD_BREAKPOINT_LINE })).success).toBe(true);
    await launch(parentFixture);
    const { sessionId: childId } = await waitForChildStop(rootId, /child\.js$/, CHILD_BREAKPOINT_LINE);

    const closed = await call<Closed>('close_debug_session', { sessionId: childId });
    expect(closed.success, JSON.stringify(closed)).toBe(true);
    expect(closed.released, JSON.stringify(closed)).toBe(true);
    expect(closed.processEnded).toBeUndefined();
    expect(closed.childrenClosed).toBeUndefined();
    expect((await rows()).some((row) => row.id === childId)).toBe(false);

    // The released fork finishes undebugged; the parent sees exit 0 and ends.
    const ended = await call<Stop>('wait_for_stop', { sessionId: rootId, timeout: 30000 });
    expect(ended.state, JSON.stringify(ended)).toBe('stopped');
    expect(ended.sessionId).toBe(rootId);
    const output = await pollUntil(() => outputText(rootId), (text) => text.includes('parent child exit 0'), 5000);
    expect(output).toContain('child done 3');
  }, 120_000);

  it("restarting the parent closes the previous run's fork, and closing the parent takes the fork with it", async () => {
    const rootId = await server.createSession('javascript', 'js-tree-restart-close');
    expect((await call('set_breakpoint', { file: parentFixture, line: PARENT_BREAKPOINT_LINE })).success).toBe(true);
    expect((await call('set_breakpoint', { file: childFixture, line: CHILD_BREAKPOINT_LINE })).success).toBe(true);

    const childOf = async (): Promise<Row | undefined> =>
      (await pollUntil(rows, (listing) => listing.some((row) => row.parentSessionId === rootId), 15000)).find((row) => row.parentSessionId === rootId);
    const pausedAtParent = async (answer: Stop): Promise<void> => {
      let paused = answer;
      if (answer.state !== 'paused') {
        paused = await call<Stop>('wait_for_stop', { sessionId: rootId, timeout: 30000 });
      }
      expect(paused.state, JSON.stringify(paused)).toBe('paused');
      expect(fileOf(paused)).toMatch(/parent\.js$/);
      expect(lineOf(paused)).toBe(PARENT_BREAKPOINT_LINE);
    };

    await pausedAtParent(await launch(parentFixture));
    const firstChild = await childOf();
    expect(firstChild, 'the fork is reported while the parent is paused').toBeDefined();
    const firstChildStop = await call<Stop>('wait_for_stop', { sessionId: firstChild!.id, timeout: 30000 });
    expect(firstChildStop.state, JSON.stringify(firstChildStop)).toBe('paused');

    const restarted = await call<Stop>('restart_debugging', { sessionId: rootId });
    expect(restarted.success, JSON.stringify(restarted)).toBe(true);
    expect(restarted.childrenClosed, JSON.stringify(restarted)).toBe(1);
    await pausedAtParent(restarted);
    expect((await rows()).some((row) => row.id === firstChild!.id)).toBe(false);

    const secondChild = await childOf();
    expect(secondChild).toBeDefined();
    expect(secondChild!.id).not.toBe(firstChild!.id);
    const closed = await call<Closed>('close_debug_session', { sessionId: rootId });
    expect(closed.success, JSON.stringify(closed)).toBe(true);
    expect(closed.childrenClosed, JSON.stringify(closed)).toBe(1);
    expect(closed.processEnded).toBeUndefined();
    server.sessionId = undefined;
    expect(await rows()).toEqual([]);
  }, 120_000);

  it('with the child-session cap at 0 the program is still adopted and its fork is released by a throwaway attach', async () => {
    await server.close();
    await startClient({ DEBUG_MCP_MAX_CHILD_SESSIONS: '0' });
    const rootId = await server.createSession('javascript', 'js-tree-cap-0');
    expect((await call('set_breakpoint', { file: childFixture, line: CHILD_BREAKPOINT_LINE })).success).toBe(true);
    const started = await launch(parentFixture);

    // No child session, no stop: the fork runs undebugged to its end and the
    // parent ends with it — inside the launch hold on a fast box, so the
    // launch answer itself may be the end.
    const ended = started.state === 'stopped' ? started : await call<Stop>('wait_for_stop', { sessionId: rootId, timeout: 30000 });
    expect(ended.state, JSON.stringify(ended)).toBe('stopped');
    if (ended !== started) {
      expect(ended.sessionId).toBe(rootId);
    }
    // A launch answer carries the exit code under `data`; a wait answer hoists it.
    expect(ended.exitCode ?? (ended as { data?: { exitCode?: number } }).data?.exitCode, JSON.stringify(ended)).toBe(0);
    expect(ended.childrenReleased, JSON.stringify(ended)).toBe(1);
    expect(ended.children).toBeUndefined();
    expect((await rows()).filter((row) => row.parentSessionId === rootId)).toEqual([]);
    const output = await pollUntil(() => outputText(rootId), (text) => text.includes('parent child exit 0'), 5000);
    expect(output).toContain('child done 3');
  }, 120_000);

  /**
   * Lifecycle row 2 (docs/architecture/session-tree.md): the spike measured
   * that a program's exit kills its unreported forks within 300 ms, and left
   * an adopted one unmeasured. Measured here, 2026-11-05 with js-debug
   * v1.140.0: the adopted fork, paused on its breakpoint, is ended the
   * moment its parent exits (its `terminated` arrives at the parent's exit;
   * no exit code) — the launch owns the tree. The server keeps the child's
   * row until it is closed, as for any ended session.
   */
  it('an adopted fork paused on a breakpoint ends with its parent’s exit (measured), and its row says so', async () => {
    const rootId = await server.createSession('javascript', 'js-tree-parent-exits');
    expect((await call('set_breakpoint', { file: childFixture, line: CHILD_BREAKPOINT_LINE })).success).toBe(true);
    await launch(parentExitsFixture);
    const { sessionId: childId } = await waitForChildStop(rootId, /child\.js$/, CHILD_BREAKPOINT_LINE);
    expect((await rows()).find((row) => row.id === childId)?.state).toBe('paused');

    // The parent exits 12 s after the fork (room for a slow CI runner to
    // adopt and observe the stop first), while the fork is still paused.
    const listing = await pollUntil(rows, (list) => list.find((row) => row.id === rootId)?.state === 'stopped', 30000);
    expect(listing.find((row) => row.id === rootId)?.state, JSON.stringify(listing)).toBe('stopped');
    const rootOutput = await pollUntil(() => outputText(rootId), (text) => text.includes('parent exiting'), 5000);
    expect(rootOutput).toContain('parent exiting');

    const childEnd = await pollUntil(rows, (list) => list.find((row) => row.id === childId)?.state === 'stopped', 10000);
    const childRow = childEnd.find((row) => row.id === childId);
    expect(childRow, JSON.stringify(childEnd)).toMatchObject({ state: 'stopped', parentSessionId: rootId });
    // Killed while paused: it never ran its ticks.
    expect(await outputText(rootId)).not.toContain('child done');
    const childEnded = await call<Stop>('wait_for_stop', { sessionId: childId, timeout: 5000 });
    expect(childEnded.state).toBe('stopped');
    expect(childEnded.exitCode).toBeUndefined();
  }, 120_000);

  it("a logpoint set on the parent reaches the fork and prints into the launch session's output", async () => {
    const rootId = await server.createSession('javascript', 'js-tree-logpoint');
    const logpoint = await call('set_breakpoint', { file: childFixture, line: CHILD_BREAKPOINT_LINE, logMessage: 'tick {i} total {total}' });
    expect(logpoint.success, JSON.stringify(logpoint)).toBe(true);
    await launch(parentFixture);

    const ended = await call<Stop>('wait_for_stop', { sessionId: rootId, timeout: 30000 });
    expect(ended.state, JSON.stringify(ended)).toBe('stopped');
    expect(ended.sessionId).toBe(rootId);
    const output = await pollUntil(() => outputText(rootId), (text) => text.includes('parent child exit 0'), 5000);
    expect(output).toContain('tick 0 total 0');
    expect(output).toContain('tick 2 total 1');
    expect(output).toContain('child done 3');
  }, 120_000);
});
