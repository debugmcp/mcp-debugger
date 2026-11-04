/**
 * The session tree with real debugpy (issue #1081): a Python launch with
 * `dapLaunchArgs.subProcess: true` used to park every child the program
 * spawned until a debug client attached, which this server never did
 * (#1005). The worker now holds debugpy's report and the server adopts or
 * releases it, so the program runs to its end either way.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import fs from 'node:fs';
import { fileURLToPath } from 'url';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { Client } from '@modelcontextprotocol/client';
import { ensurePythonOnPath } from './env-utils.js';

const currentDirName = path.dirname(fileURLToPath(import.meta.url));
const inheritFixture = path.resolve(currentDirName, '../../../fixtures/python/subprocess-inherit/spawn_child.py');
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

describe('Python child processes under subProcess: true (the session tree, issue #1081) @requires-python', () => {
  beforeAll(async () => {
    await startTestServer();
  }, 30000);

  afterAll(async () => {
    await stopTestServer();
  });

  it('a launch that spawns a child with sub-process debugging on runs to its end instead of parking', async () => {
    const created = await call('create_debug_session', { language: 'python', name: 'subprocess-tree-release' });
    expect(created.success).toBe(true);
    const sessionId = created.sessionId as string;

    try {
      const started = await call('start_debugging', {
        sessionId,
        scriptPath: inheritFixture,
        breakOnExceptions: 'none',
        dapLaunchArgs: { stopOnEntry: false, subProcess: true }
      });
      expect(started.success, JSON.stringify(started)).toBe(true);

      let ended = started;
      if (started.state === 'running') {
        ended = await call('wait_for_stop', { sessionId, timeout: 30000 });
      }
      const output = await call('get_output', { sessionId });
      const transcript = JSON.stringify(output);

      expect(['stopped', 'terminated'], JSON.stringify(ended)).toContain(ended.state);
      expect(transcript).toContain('child exit 0 child ok');
      expect(ended.exitCode ?? ended.data?.exitCode, transcript).toBe(0);
    } finally {
      await call('close_debug_session', { sessionId });
    }
  }, 60000);

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
      dapLaunchArgs: { stopOnEntry: false, subProcess: true }
    });
    expect(started.success, JSON.stringify(started)).toBe(true);
    let paused = started;
    if (started.state !== 'paused') {
      paused = await call('wait_for_stop', { sessionId: rootId, timeout: 30000 });
    }
    expect(paused.state, JSON.stringify(paused)).toBe('paused');
    expect(JSON.stringify(paused.location ?? paused.data?.location ?? paused)).toMatch(/parent\.py/);

    // The child is discovered through the listing in this milestone (the
    // tree-aware wait_for_stop lands next).
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

  it('closing the parent closes the child too and reaps the worker', async () => {
    const { rootId, childId } = await startTree('subprocess-tree-close-root');
    const childStop = await call('wait_for_stop', { sessionId: childId, timeout: 30000 });
    expect(childStop.state, JSON.stringify(childStop)).toBe('paused');

    const closed = await call('close_debug_session', { sessionId: rootId });
    expect(closed.success, JSON.stringify(closed)).toBe(true);

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
