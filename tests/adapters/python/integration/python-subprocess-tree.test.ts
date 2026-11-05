/**
 * The session tree with real debugpy (issue #1081): a Python launch used to
 * park every child the program spawned until a debug client attached, which
 * this server never did (#1005). The worker now holds debugpy's report and
 * the server adopts it as a child debug session — on by default since the
 * last step of #1081, so no case here names `subProcess`.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import fs from 'node:fs';
import { fileURLToPath } from 'url';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { Client } from '@modelcontextprotocol/client';
import { ensurePythonOnPath } from './env-utils.js';

const currentDirName = path.dirname(fileURLToPath(import.meta.url));
const treeDir = path.resolve(currentDirName, '../../../fixtures/python/subprocess-tree');
const parentFixture = path.join(treeDir, 'parent.py');
const childFixture = path.join(treeDir, 'child.py');
/** `marker = proc.pid  # BREAKPOINT` in parent.py and `total += i  # BREAKPOINT` in child.py. */
const PARENT_BREAKPOINT_LINE = 17;
const CHILD_BREAKPOINT_LINE = 12;

async function pollUntil<T>(read: () => Promise<T>, accept: (value: T) => boolean, timeoutMs: number, intervalMs = 250): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let last = await read();
  while (!accept(last) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    last = await read();
  }
  return last;
}

let client: Client | null = null;

async function startTestServer(): Promise<void> {
  const serverScriptPath = path.resolve(currentDirName, '../../../../dist/index.js');
  client = new Client({ name: 'mcp-test-client', version: '0.1.0' }, { capabilities: {} });

  const env: Record<string, string> = {};
  for (const key in process.env) {
    if (process.env[key] !== undefined) env[key] = process.env[key] as string;
  }
  ensurePythonOnPath(env);

  const logFilePath = path.resolve(currentDirName, '../../subprocess_tree_test_server.log');
  try {
    if (fs.existsSync(logFilePath)) fs.unlinkSync(logFilePath);
  } catch { /* best effort */ }

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverScriptPath, '--log-level', 'debug', '--log-file', logFilePath],
    env
  });
  await client.connect(transport);
}

async function stopTestServer(): Promise<void> {
  if (client) {
    try { await client.close(); } catch { /* best effort */ }
  }
  client = null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const parseToolResult = (raw: any): any => {
  if (!raw?.content?.[0] || raw.content[0].type !== 'text') {
    throw new Error(`Invalid tool result: ${JSON.stringify(raw)}`);
  }
  return JSON.parse(raw.content[0].text);
};

async function call(name: string, args: Record<string, unknown>) {
  if (!client) throw new Error('MCP client not initialized');
  return parseToolResult(await client.callTool({ name, arguments: args }));
}

describe('Python child processes as child sessions (the session tree, issue #1081) @requires-python', () => {
  beforeAll(async () => {
    await startTestServer();
  }, 30000);

  afterAll(async () => {
    await stopTestServer();
  });

  /**
   * Set the breakpoints, start the parent, and wait for it to pause right
   * after the spawn; returns once the child's row is listed.
   */
  async function startTree(name: string): Promise<{ rootId: string; childId: string }> {
    const created = await call('create_debug_session', { language: 'python', name });
    expect(created.success).toBe(true);
    const rootId = created.sessionId as string;

    const parentBp = await call('set_breakpoint', { sessionId: rootId, file: parentFixture, line: PARENT_BREAKPOINT_LINE });
    expect(parentBp.success, JSON.stringify(parentBp)).toBe(true);
    const childBp = await call('set_breakpoint', { sessionId: rootId, file: childFixture, line: CHILD_BREAKPOINT_LINE });
    expect(childBp.success, JSON.stringify(childBp)).toBe(true);

    const started = await call('start_debugging', {
      sessionId: rootId,
      scriptPath: parentFixture,
      breakOnExceptions: 'none',
      dapLaunchArgs: { stopOnEntry: false }
    });
    expect(started.success, JSON.stringify(started)).toBe(true);
    let paused = started;
    if (started.state !== 'paused') {
      paused = await call('wait_for_stop', { sessionId: rootId, timeout: 30000 });
    }
    expect(paused.state, JSON.stringify(paused)).toBe('paused');
    expect(JSON.stringify(paused.location ?? paused.data?.location ?? paused)).toMatch(/parent\.py/);
    // A paused parent is reported before its children (rule 1); the launch
    // answer itself names no session — it is about the launched one.
    if (paused !== started) {
      expect(paused.sessionId, JSON.stringify(paused)).toBe(rootId);
    }

    // The parent paused the moment it spawned, before the child was reported:
    // the listing is where the child's row turns up.
    const listing = await pollUntil(
      () => call('list_debug_sessions', {}),
      (l) => Array.isArray(l.sessions) && l.sessions.some((s: { parentSessionId?: string }) => s.parentSessionId === rootId),
      15000
    );
    const childRow = (listing.sessions as Array<Record<string, unknown>>).find((s) => s.parentSessionId === rootId);
    expect(childRow, JSON.stringify(listing)).toBeDefined();
    expect(childRow!.language).toBe('python');
    expect(childRow!.name).toMatch(/^Subprocess \d+$/);
    return { rootId, childId: childRow!.id as string };
  }

  it('adopts the child as a session that stops on the breakpoint set before launch, with its own output, and closes alone', async () => {
    const { rootId, childId } = await startTree('subprocess-tree-adopt');
    try {
      const childStop = await call('wait_for_stop', { sessionId: childId, timeout: 30000 });
      expect(childStop.state, JSON.stringify(childStop)).toBe('paused');
      expect(JSON.stringify(childStop.location ?? childStop)).toMatch(/child\.py/);
      expect(childStop.location?.line ?? childStop.lastStop?.line).toBe(CHILD_BREAKPOINT_LINE);

      // The child's own buffer carries its lines (redirectOutput on its connection) …
      const childOutput = await pollUntil(
        () => call('get_output', { sessionId: childId }),
        (o) => JSON.stringify(o).includes('child start'),
        5000
      );
      expect(JSON.stringify(childOutput)).toContain('child start');
      // … and the launch session's buffer carries the whole tree's.
      const rootOutput = await pollUntil(
        () => call('get_output', { sessionId: rootId }),
        (o) => JSON.stringify(o).includes('child start'),
        5000
      );
      expect(JSON.stringify(rootOutput)).toContain('parent start');
      expect(JSON.stringify(rootOutput)).toContain('child start');

      const resumed = await call('continue_execution', { sessionId: childId });
      expect(resumed.success, JSON.stringify(resumed)).toBe(true);
      const secondStop = await call('wait_for_stop', { sessionId: childId, timeout: 30000 });
      expect(secondStop.state, JSON.stringify(secondStop)).toBe('paused');
      const afterStep = await pollUntil(
        () => call('get_output', { sessionId: childId }),
        (o) => JSON.stringify(o).includes('child step 0'),
        5000
      );
      expect(JSON.stringify(afterStep)).toContain('child step 0');

      // Closing the child leaves the parent paused and its worker alive.
      const closedChild = await call('close_debug_session', { sessionId: childId });
      expect(closedChild.success, JSON.stringify(closedChild)).toBe(true);
      expect(closedChild.processEnded, JSON.stringify(closedChild)).toBe(true);
      expect(closedChild.childrenClosed).toBeUndefined();
      const listing = await call('list_debug_sessions', {});
      expect((listing.sessions as Array<{ id: string }>).some((s) => s.id === childId)).toBe(false);
      const rootRow = (listing.sessions as Array<{ id: string; state: string }>).find((s) => s.id === rootId);
      expect(rootRow?.state).toBe('paused');
      const stack = await call('get_stack_trace', { sessionId: rootId });
      expect(stack.success, JSON.stringify(stack)).toBe(true);

      // debugpy ends the closed child with exit 0 (spike cascade row 4); the parent runs to its end.
      const resumedRoot = await call('continue_execution', { sessionId: rootId });
      expect(resumedRoot.success, JSON.stringify(resumedRoot)).toBe(true);
      const ended = await call('wait_for_stop', { sessionId: rootId, timeout: 30000 });
      expect(ended.state, JSON.stringify(ended)).toBe('stopped');
      expect(ended.exitCode, JSON.stringify(ended)).toBe(0);
      const finalOutput = await call('get_output', { sessionId: rootId });
      expect(JSON.stringify(finalOutput)).toContain('parent child exit 0');
    } finally {
      await call('close_debug_session', { sessionId: rootId });
    }
  }, 120000);

  it('sets a breakpoint on an adopted child without changing the paused parent', async () => {
    const { rootId, childId } = await startTree('subprocess-tree-child-breakpoint');
    try {
      const firstStop = await call('wait_for_stop', { sessionId: childId, timeout: 30000 });
      expect(firstStop.state, JSON.stringify(firstStop)).toBe('paused');
      const breakpoint = await call('set_breakpoint', {
        sessionId: childId, file: childFixture, line: CHILD_BREAKPOINT_LINE + 1
      });
      expect(breakpoint.success, JSON.stringify(breakpoint)).toBe(true);

      const resumed = await call('continue_execution', { sessionId: childId });
      expect(resumed.success, JSON.stringify(resumed)).toBe(true);
      const nextStop = await call('wait_for_stop', { sessionId: childId, timeout: 30000 });
      expect(nextStop.state, JSON.stringify(nextStop)).toBe('paused');
      expect(nextStop.location?.line ?? nextStop.lastStop?.line).toBe(CHILD_BREAKPOINT_LINE + 1);

      const parentStop = await call('wait_for_stop', { sessionId: rootId, timeout: 1000 });
      expect(parentStop.state, JSON.stringify(parentStop)).toBe('paused');
      expect(parentStop.location?.line ?? parentStop.lastStop?.line).toBe(PARENT_BREAKPOINT_LINE);
    } finally {
      await call('close_debug_session', { sessionId: rootId });
    }
  }, 120000);

  /**
   * The designed flow (docs/architecture/session-tree.md): a breakpoint in
   * the child's code only, start the parent, wait on the parent. The wait
   * answers the child's stop with the child's id (rule 2), again after each
   * continue, and the parent's own end once the child has ended (rule 3).
   */
  it("the parent's wait_for_stop reports the child's stops with its sessionId, then the parent's end", async () => {
    const created = await call('create_debug_session', { language: 'python', name: 'subprocess-tree-designed-flow' });
    expect(created.success).toBe(true);
    const rootId = created.sessionId as string;
    try {
      const childBp = await call('set_breakpoint', { sessionId: rootId, file: childFixture, line: CHILD_BREAKPOINT_LINE });
      expect(childBp.success, JSON.stringify(childBp)).toBe(true);
      const started = await call('start_debugging', {
        sessionId: rootId,
        scriptPath: parentFixture,
        breakOnExceptions: 'none',
        dapLaunchArgs: { stopOnEntry: false }
      });
      expect(started.success, JSON.stringify(started)).toBe(true);
      expect(started.state, JSON.stringify(started)).toBe('running');

      let childId: string | undefined;
      for (let iteration = 0; iteration < 3; iteration += 1) {
        const stop = await call('wait_for_stop', { sessionId: rootId, timeout: 30000 });
        expect(stop.state, JSON.stringify(stop)).toBe('paused');
        expect(stop.sessionId, JSON.stringify(stop)).toBeDefined();
        expect(stop.sessionId).not.toBe(rootId);
        childId ??= stop.sessionId as string;
        expect(stop.sessionId).toBe(childId);
        expect(JSON.stringify(stop.location ?? stop)).toMatch(/child\.py/);
        expect(stop.location?.line ?? stop.lastStop?.line).toBe(CHILD_BREAKPOINT_LINE);
        expect(stop.children, JSON.stringify(stop)).toEqual([
          { sessionId: childId, name: expect.stringMatching(/^Subprocess \d+$/), state: 'paused', parentSessionId: rootId }
        ]);
        // The answer's own stop is the child's: inspect it with that id.
        const locals = await call('get_local_variables', { sessionId: childId });
        expect(locals.success, JSON.stringify(locals)).toBe(true);
        expect(JSON.stringify(locals)).toMatch(/"i"/);
        const resumed = await call('continue_execution', { sessionId: childId });
        expect(resumed.success, JSON.stringify(resumed)).toBe(true);
      }

      // The child runs to its end; the parent then sees the exit code and ends.
      const ended = await call('wait_for_stop', { sessionId: rootId, timeout: 30000 });
      expect(ended.state, JSON.stringify(ended)).toBe('stopped');
      expect(ended.sessionId, JSON.stringify(ended)).toBe(rootId);
      expect(ended.exitCode, JSON.stringify(ended)).toBe(0);
      expect(ended.children, JSON.stringify(ended)).toEqual([
        expect.objectContaining({ sessionId: childId, state: 'stopped', parentSessionId: rootId })
      ]);
      const output = await call('get_output', { sessionId: rootId });
      expect(JSON.stringify(output)).toContain('child done 3');
      expect(JSON.stringify(output)).toContain('parent child exit 0');
    } finally {
      await call('close_debug_session', { sessionId: rootId });
    }
  }, 120000);

  it("restarting the parent closes the previous run's child and says so", async () => {
    const { rootId, childId } = await startTree('subprocess-tree-restart');
    try {
      const childStop = await call('wait_for_stop', { sessionId: childId, timeout: 30000 });
      expect(childStop.state, JSON.stringify(childStop)).toBe('paused');

      const restarted = await call('restart_debugging', { sessionId: rootId });
      expect(restarted.success, JSON.stringify(restarted)).toBe(true);
      expect(restarted.childrenClosed, JSON.stringify(restarted)).toBe(1);

      let paused = restarted;
      if (restarted.state !== 'paused') {
        paused = await call('wait_for_stop', { sessionId: rootId, timeout: 30000 });
      }
      expect(paused.state, JSON.stringify(paused)).toBe('paused');
      if (paused !== restarted) {
        expect(paused.sessionId, JSON.stringify(paused)).toBe(rootId);
      }
      expect(JSON.stringify(paused.location ?? paused)).toMatch(/parent\.py/);

      const listing = await call('list_debug_sessions', {});
      const ids = (listing.sessions as Array<{ id: string }>).map((s) => s.id);
      expect(ids).not.toContain(childId);
    } finally {
      await call('close_debug_session', { sessionId: rootId });
    }
  }, 120000);

  it('closing the parent closes the child too and reaps the worker', async () => {
    const { rootId, childId } = await startTree('subprocess-tree-close-root');
    const childStop = await call('wait_for_stop', { sessionId: childId, timeout: 30000 });
    expect(childStop.state, JSON.stringify(childStop)).toBe('paused');

    const closed = await call('close_debug_session', { sessionId: rootId });
    expect(closed.success, JSON.stringify(closed)).toBe(true);
    expect(closed.childrenClosed, JSON.stringify(closed)).toBe(1);
    expect(closed.processEnded).toBeUndefined();

    const listing = await call('list_debug_sessions', {});
    const ids = (listing.sessions as Array<{ id: string }>).map((s) => s.id);
    expect(ids).not.toContain(rootId);
    expect(ids).not.toContain(childId);

    // The leak probe runs 1.5 s after a root's close: no leaked-worker line may follow.
    await new Promise((resolve) => setTimeout(resolve, 2500));
    const logFilePath = path.resolve(currentDirName, '../../subprocess_tree_test_server.log');
    const log = fs.existsSync(logFilePath) ? fs.readFileSync(logFilePath, 'utf8') : '';
    expect(log).not.toContain('leaked worker');
  }, 120000);
});
