/**
 * The session tree's lifecycle rows with real js-debug (issue #1082,
 * docs/architecture/session-tree.md "Lifecycle: the cascade contract"): a
 * fork that ends while its parent is paused, two siblings of which one is
 * closed (released, for js-debug), and a cluster primary's four workers.
 * `autoAttachChildProcesses` is on by default, so no case names the key: the
 * launches here are the proof of the default.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startStdioClient, type StdioClientHandle, type ToolAnswer } from '../../../test-utils/helpers/mcp-stdio-client.js';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const treeDir = path.join(root, 'tests/fixtures/javascript/subprocess-tree');
const parentFixture = path.join(treeDir, 'parent.js');
const parentTwoFixture = path.join(treeDir, 'parent_two.js');
const clusterFixture = path.join(treeDir, 'cluster_parent.js');
const childFixture = path.join(treeDir, 'child.js');
/** The `// BREAKPOINT` lines of the fixtures. */
const PARENT_BREAKPOINT_LINE = 20;
const CHILD_BREAKPOINT_LINE = 14;
const CLUSTER_BREAKPOINT_LINE = 29;
const WORKERS = 4;

interface Row { id: string; name: string; state: string; parentSessionId?: string }
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
interface Output extends ToolAnswer { entries: Array<{ output: string }> }
interface Stack extends ToolAnswer { stackFrames: Array<{ id: number; file?: string; line?: number }> }

let server: StdioClientHandle;
const call = <T extends ToolAnswer = ToolAnswer>(name: string, args: Record<string, unknown> = {}): Promise<T> => server.call<T>(name, args);
const rows = async (): Promise<Row[]> => (await call<ToolAnswer & { sessions: Row[] }>('list_debug_sessions')).sessions;
const outputText = async (sessionId: string): Promise<string> =>
  (await call<Output>('get_output', { sessionId, limit: 1000 })).entries.map((e) => e.output).join('');
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

/** Launch without naming autoAttachChildProcesses: the default is what these cases prove. */
async function launch(scriptPath: string): Promise<Stop> {
  const started = await call<Stop>('start_debugging', { scriptPath, breakOnExceptions: 'none', dapLaunchArgs: { stopOnEntry: false } });
  expect(started.success, JSON.stringify(started)).toBe(true);
  return started;
}

async function setBreakpoint(file: string, line: number): Promise<void> {
  const bp = await call('set_breakpoint', { file, line });
  expect(bp.success, JSON.stringify(bp)).toBe(true);
}

/**
 * Wait on `sessionId` (or on `childId`) for a stop that must be a paused child
 * of the tree at `line`, and hand back its id. One wait, one answer: a child's
 * first stop anywhere else — js-debug's module-entry break surfacing under
 * load as a "debugger statement" pause at the module's first line, seen here
 * once with four cluster workers starting at once — is the #1097 regression.
 * The server verifies such a stop against the source line and resumes it
 * before anything is answered, so here it fails by name.
 */
async function waitForChildStop(sessionId: string, file: RegExp, line: number, childId?: string): Promise<Stop & { sessionId: string }> {
  const stop = await call<Stop>('wait_for_stop', { sessionId: childId ?? sessionId, timeout: 30000 });
  expect(stop.state, JSON.stringify(stop)).toBe('paused');
  expect(stop.sessionId, JSON.stringify(stop)).toBeDefined();
  expect(stop.sessionId).not.toBe(sessionId);
  if (childId) expect(stop.sessionId).toBe(childId);
  expect(fileOf(stop), JSON.stringify(stop)).toMatch(file);
  expect(lineOf(stop), JSON.stringify(stop)).toBe(line);
  return stop as Stop & { sessionId: string };
}

beforeEach(async () => {
  server = await startStdioClient({ name: 'js-subprocess-cascade', callTimeoutMs: 60_000 });
});

afterEach(async () => {
  await server?.close();
}, 30_000);

describe('JavaScript session-tree lifecycle rows (issue #1082)', () => {
  it('a fork that ends while the parent is paused leaves the parent paused, the fork ended in children (row 1)', async () => {
    const rootId = await server.createSession('javascript', 'js-cascade-row-1');
    await setBreakpoint(parentFixture, PARENT_BREAKPOINT_LINE);
    const started = await launch(parentFixture);
    const paused = started.state === 'paused' ? started : await call<Stop>('wait_for_stop', { sessionId: rootId, timeout: 30000 });
    expect(paused.state, JSON.stringify(paused)).toBe('paused');
    expect(fileOf(paused)).toMatch(/parent\.js$/);
    expect(lineOf(paused)).toBe(PARENT_BREAKPOINT_LINE);

    // No breakpoint of its own: the adopted fork runs to its end while the parent stays paused.
    const listing = await pollUntil(rows, (list) => list.some((row) => row.parentSessionId === rootId && row.state === 'stopped'), 30000);
    const childRow = listing.find((row) => row.parentSessionId === rootId);
    expect(childRow, JSON.stringify(listing)).toBeDefined();
    expect(childRow!.state).toBe('stopped');
    expect(listing.find((row) => row.id === rootId)?.state).toBe('paused');

    // Rule 1: the paused parent is the answer, with the ended fork listed.
    const stop = await call<Stop>('wait_for_stop', { sessionId: rootId, timeout: 1000 });
    expect(stop.state, JSON.stringify(stop)).toBe('paused');
    expect(stop.sessionId).toBe(rootId);
    expect(stop.children).toEqual([
      { sessionId: childRow!.id, name: expect.stringMatching(/child\.js \[\d+\]$/), state: 'stopped', parentSessionId: rootId }
    ]);

    // After the parent resumes, it sees the exit code and ends normally.
    expect((await call('continue_execution', { sessionId: rootId })).success).toBe(true);
    const ended = await call<Stop>('wait_for_stop', { sessionId: rootId, timeout: 30000 });
    expect(ended.state, JSON.stringify(ended)).toBe('stopped');
    expect(ended.sessionId).toBe(rootId);
    expect(ended.exitCode).toBe(0);
    const output = await pollUntil(() => outputText(rootId), (text) => text.includes('parent child exit 0'), 5000);
    expect(output).toContain('child done 3');
  }, 120_000);

  it('closing one of two forks releases that fork alone: its sibling and the parent go on', async () => {
    const rootId = await server.createSession('javascript', 'js-cascade-siblings');
    await setBreakpoint(childFixture, CHILD_BREAKPOINT_LINE);
    await launch(parentTwoFixture);

    const first = await waitForChildStop(rootId, /child\.js$/, CHILD_BREAKPOINT_LINE);
    expect(first.sessionId).toBeDefined();
    const listing = await pollUntil(
      rows,
      (list) => list.filter((row) => row.parentSessionId === rootId && row.state === 'paused').length === 2,
      30000
    );
    const children = listing.filter((row) => row.parentSessionId === rootId);
    expect(children, JSON.stringify(listing)).toHaveLength(2);
    // Both are paused; each must be at the breakpoint. Wait on each id so the
    // root's already-paused first child cannot hide the other's stop.
    for (const child of children) {
      await waitForChildStop(rootId, /child\.js$/, CHILD_BREAKPOINT_LINE, child.id);
    }
    const [closedChild, survivor] = children;

    // js-debug cannot end a target it adopted: the close releases the fork, which runs on undebugged.
    const closed = await call<Closed>('close_debug_session', { sessionId: closedChild.id });
    expect(closed.success, JSON.stringify(closed)).toBe(true);
    expect(closed.released, JSON.stringify(closed)).toBe(true);
    expect(closed.processEnded).toBeUndefined();
    expect(closed.childrenClosed).toBeUndefined();

    const after = await rows();
    expect(after.map((row) => row.id)).not.toContain(closedChild.id);
    expect(after.find((row) => row.id === survivor.id)?.state).toBe('paused');
    expect(after.find((row) => row.id === rootId)?.state).toBe('running');
    const stack = await call<Stack>('get_stack_trace', { sessionId: survivor.id });
    expect(stack.success, JSON.stringify(stack)).toBe(true);
    expect(stack.stackFrames[0]?.line).toBe(CHILD_BREAKPOINT_LINE);

    // The survivor runs its remaining two ticks under the debugger; the parent then ends.
    for (let iteration = 1; iteration < 3; iteration += 1) {
      expect((await call('continue_execution', { sessionId: survivor.id })).success).toBe(true);
      const stop = await call<Stop>('wait_for_stop', { sessionId: rootId, timeout: 30000 });
      expect(stop.state, JSON.stringify(stop)).toBe('paused');
      expect(stop.sessionId).toBe(survivor.id);
      expect(stop.children).toEqual([expect.objectContaining({ sessionId: survivor.id, state: 'paused' })]);
    }
    expect((await call('continue_execution', { sessionId: survivor.id })).success).toBe(true);
    const ended = await call<Stop>('wait_for_stop', { sessionId: rootId, timeout: 30000 });
    expect(ended.state, JSON.stringify(ended)).toBe('stopped');
    expect(ended.sessionId).toBe(rootId);
    expect(ended.exitCode).toBe(0);
    expect(ended.children).toEqual([expect.objectContaining({ sessionId: survivor.id, state: 'stopped' })]);
    const output = await pollUntil(() => outputText(rootId), (text) => text.includes('parent done 0'), 5000);
    expect(output).toContain('parent done 0');
  }, 120_000);

  it("a cluster primary's workers each become a child session and stop on the breakpoint in the worker branch", async () => {
    const rootId = await server.createSession('javascript', 'js-cascade-cluster');
    await setBreakpoint(clusterFixture, CLUSTER_BREAKPOINT_LINE);
    await launch(clusterFixture);

    // One tick per worker: four stops, each a different child, in the scheduler's order.
    const workers = new Set<string>();
    for (let stops = 0; stops < WORKERS; stops += 1) {
      const stop = await waitForChildStop(rootId, /cluster_parent\.js$/, CLUSTER_BREAKPOINT_LINE);
      workers.add(stop.sessionId);
      expect(stop.children).toEqual(expect.arrayContaining([
        { sessionId: stop.sessionId, name: expect.stringMatching(/cluster_parent\.js \[\d+\]$/), state: 'paused', parentSessionId: rootId }
      ]));
      expect((await call('continue_execution', { sessionId: stop.sessionId })).success).toBe(true);
    }
    expect(workers.size).toBe(WORKERS);

    const ended = await call<Stop>('wait_for_stop', { sessionId: rootId, timeout: 30000 });
    expect(ended.state, JSON.stringify(ended)).toBe('stopped');
    expect(ended.sessionId).toBe(rootId);
    expect(ended.exitCode).toBe(0);
    expect(ended.children).toHaveLength(WORKERS);
    for (const child of ended.children ?? []) {
      expect(child).toMatchObject({ state: 'stopped', parentSessionId: rootId });
      expect(workers.has(child.sessionId)).toBe(true);
    }
    const output = await pollUntil(() => outputText(rootId), (text) => text.includes('primary done'), 5000);
    for (let id = 1; id <= WORKERS; id += 1) {
      expect(output).toContain(`worker ${id} done`);
    }
  }, 120_000);
});
