/**
 * The session tree's lifecycle rows with real debugpy (issue #1081,
 * docs/architecture/session-tree.md "Lifecycle: the cascade contract"): a
 * child that ends while its parent is paused, a parent that exits with its
 * child live (the #993 pipe), a grandchild adopted under the child and
 * closed with it, two siblings of which one is closed, and a
 * multiprocessing child. Sub-process debugging is on by default, so no case
 * names `subProcess`.
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
const parentExitsFixture = path.join(treeDir, 'parent_exits.py');
const parentTwoFixture = path.join(treeDir, 'parent_two.py');
const mpParentFixture = path.join(treeDir, 'mp_parent.py');
const childFixture = path.join(treeDir, 'child.py');
const childGrandFixture = path.join(treeDir, 'child_grand.py');
const grandchildFixture = path.join(treeDir, 'grandchild.py');
/** The `# BREAKPOINT` lines of the fixtures. */
const PARENT_BREAKPOINT_LINE = 17;
const CHILD_BREAKPOINT_LINE = 12;
const CHILD_GRAND_BREAKPOINT_LINE = 14;
const GRANDCHILD_BREAKPOINT_LINE = 9;
const MP_BREAKPOINT_LINE = 12;

type Row = { id: string; state: string; parentSessionId?: string; name?: string };
type Child = { sessionId: string; name: string; state: string; parentSessionId: string };

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

  const logFilePath = path.resolve(currentDirName, '../../subprocess_cascade_test_server.log');
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

async function rows(): Promise<Row[]> {
  const listing = await call('list_debug_sessions', {});
  return listing.sessions as Row[];
}

const locationOf = (answer: Record<string, unknown>): string => JSON.stringify(answer.location ?? answer.lastStop ?? answer);
const lineOf = (answer: Record<string, unknown>): number | undefined =>
  (answer.location as { line?: number } | undefined)?.line ?? (answer.lastStop as { line?: number } | undefined)?.line;

describe('Python session-tree lifecycle rows (issue #1081) @requires-python', () => {
  beforeAll(async () => {
    await startTestServer();
  }, 30000);

  afterAll(async () => {
    await stopTestServer();
  });

  async function createRoot(name: string): Promise<string> {
    const created = await call('create_debug_session', { language: 'python', name });
    expect(created.success).toBe(true);
    return created.sessionId as string;
  }

  async function setBreakpoint(sessionId: string, file: string, line: number): Promise<void> {
    const bp = await call('set_breakpoint', { sessionId, file, line });
    expect(bp.success, JSON.stringify(bp)).toBe(true);
  }

  async function start(sessionId: string, scriptPath: string, extra: Record<string, unknown> = {}) {
    const started = await call('start_debugging', {
      sessionId, scriptPath, breakOnExceptions: 'none', dapLaunchArgs: { stopOnEntry: false }, ...extra
    });
    expect(started.success, JSON.stringify(started)).toBe(true);
    return started;
  }

  it('a child that ends while the parent is paused leaves the parent paused, the child ended in children (row 1)', async () => {
    const rootId = await createRoot('cascade-row-1');
    try {
      await setBreakpoint(rootId, parentFixture, PARENT_BREAKPOINT_LINE);
      const started = await start(rootId, parentFixture);
      let paused = started;
      if (started.state !== 'paused') paused = await call('wait_for_stop', { sessionId: rootId, timeout: 30000 });
      expect(paused.state, JSON.stringify(paused)).toBe('paused');
      expect(locationOf(paused)).toMatch(/parent\.py/);

      // No breakpoint of its own: the adopted child runs to its end while the parent stays paused.
      const listing = await pollUntil(rows, (l) => l.some((s) => s.parentSessionId === rootId && s.state === 'stopped'), 30000);
      const childRow = listing.find((s) => s.parentSessionId === rootId);
      expect(childRow, JSON.stringify(listing)).toBeDefined();
      expect(childRow!.state).toBe('stopped');
      expect(listing.find((s) => s.id === rootId)?.state).toBe('paused');

      // Rule 1: the paused parent is the answer, with the ended child listed.
      const stop = await call('wait_for_stop', { sessionId: rootId, timeout: 1000 });
      expect(stop.state, JSON.stringify(stop)).toBe('paused');
      expect(stop.sessionId).toBe(rootId);
      expect(stop.children).toEqual([
        { sessionId: childRow!.id, name: expect.stringMatching(/^Subprocess \d+$/), state: 'stopped', parentSessionId: rootId }
      ]);

      // After the parent resumes, it sees the exit code and ends normally.
      const resumed = await call('continue_execution', { sessionId: rootId });
      expect(resumed.success, JSON.stringify(resumed)).toBe(true);
      const ended = await call('wait_for_stop', { sessionId: rootId, timeout: 30000 });
      expect(ended.state, JSON.stringify(ended)).toBe('stopped');
      expect(ended.sessionId).toBe(rootId);
      expect(ended.exitCode).toBe(0);
      const output = JSON.stringify(await call('get_output', { sessionId: rootId }));
      expect(output).toContain('child done 3');
      expect(output).toContain('parent child exit 0');
    } finally {
      await call('close_debug_session', { sessionId: rootId });
    }
  }, 120000);

  it("a parent that exits with its child live stays running while its wait reports the child, and ends when the child does (row 2, the #993 pipe)", async () => {
    const rootId = await createRoot('cascade-row-2');
    try {
      await setBreakpoint(rootId, childFixture, CHILD_BREAKPOINT_LINE);
      await start(rootId, parentExitsFixture);

      let childId: string | undefined;
      for (let iteration = 0; iteration < 3; iteration += 1) {
        const stop = await call('wait_for_stop', { sessionId: rootId, timeout: 30000 });
        expect(stop.state, JSON.stringify(stop)).toBe('paused');
        expect(stop.sessionId).not.toBe(rootId);
        childId ??= stop.sessionId as string;
        expect(stop.sessionId).toBe(childId);
        expect(lineOf(stop)).toBe(CHILD_BREAKPOINT_LINE);
        if (iteration === 0) {
          // The parent process is gone, but its exit is held by the stdout
          // pipe the child inherited: the row stays running, not stopped.
          const rootRow = (await rows()).find((s) => s.id === rootId);
          expect(rootRow?.state, JSON.stringify(rootRow)).toBe('running');
          expect(JSON.stringify(await call('get_output', { sessionId: rootId }))).toContain('parent exiting');
        }
        const resumed = await call('continue_execution', { sessionId: childId });
        expect(resumed.success, JSON.stringify(resumed)).toBe(true);
      }

      const ended = await call('wait_for_stop', { sessionId: rootId, timeout: 30000 });
      expect(ended.state, JSON.stringify(ended)).toBe('stopped');
      expect(ended.sessionId).toBe(rootId);
      expect(ended.exitCode).toBe(0);
      expect(ended.children).toEqual([expect.objectContaining({ sessionId: childId, state: 'stopped', parentSessionId: rootId })]);
      expect(JSON.stringify(await call('get_output', { sessionId: rootId }))).toContain('child done 3');
    } finally {
      await call('close_debug_session', { sessionId: rootId });
    }
  }, 120000);

  /** Start the grandchild chain and run it to the grandchild's stop. */
  async function startChain(name: string): Promise<{ rootId: string; childId: string; grandchildId: string }> {
    const rootId = await createRoot(name);
    await setBreakpoint(rootId, childGrandFixture, CHILD_GRAND_BREAKPOINT_LINE);
    await setBreakpoint(rootId, grandchildFixture, GRANDCHILD_BREAKPOINT_LINE);
    await start(rootId, parentFixture, { args: ['child_grand.py'] });

    const childStop = await call('wait_for_stop', { sessionId: rootId, timeout: 30000 });
    expect(childStop.state, JSON.stringify(childStop)).toBe('paused');
    expect(childStop.sessionId).not.toBe(rootId);
    const childId = childStop.sessionId as string;
    expect(locationOf(childStop)).toMatch(/child_grand\.py/);
    expect(lineOf(childStop)).toBe(CHILD_GRAND_BREAKPOINT_LINE);
    expect(childStop.children).toEqual([
      { sessionId: childId, name: expect.stringMatching(/^Subprocess \d+$/), state: 'paused', parentSessionId: rootId }
    ]);

    // The child spawns the grandchild once resumed; debugpy reports it on the
    // child's connection and the root's wait still reaches it (pre-order).
    const resumed = await call('continue_execution', { sessionId: childId });
    expect(resumed.success, JSON.stringify(resumed)).toBe(true);
    const grandStop = await call('wait_for_stop', { sessionId: rootId, timeout: 30000 });
    expect(grandStop.state, JSON.stringify(grandStop)).toBe('paused');
    expect(grandStop.sessionId).not.toBe(rootId);
    expect(grandStop.sessionId).not.toBe(childId);
    const grandchildId = grandStop.sessionId as string;
    expect(locationOf(grandStop)).toMatch(/grandchild\.py/);
    expect(lineOf(grandStop)).toBe(GRANDCHILD_BREAKPOINT_LINE);
    expect(grandStop.children).toEqual([
      { sessionId: childId, name: expect.stringMatching(/^Subprocess \d+$/), state: 'running', parentSessionId: rootId },
      { sessionId: grandchildId, name: expect.stringMatching(/^Subprocess \d+$/), state: 'paused', parentSessionId: childId }
    ]);
    const listing = await rows();
    expect(listing.find((s) => s.id === grandchildId)?.parentSessionId).toBe(childId);
    return { rootId, childId, grandchildId };
  }

  it("a grandchild is adopted under the child; the root's wait reports it in pre-order and the chain runs to its end (row: grandchildren)", async () => {
    const { rootId, childId, grandchildId } = await startChain('cascade-grandchild');
    try {
      const resumed = await call('continue_execution', { sessionId: grandchildId });
      expect(resumed.success, JSON.stringify(resumed)).toBe(true);
      const ended = await call('wait_for_stop', { sessionId: rootId, timeout: 30000 });
      expect(ended.state, JSON.stringify(ended)).toBe('stopped');
      expect(ended.sessionId).toBe(rootId);
      expect(ended.exitCode).toBe(0);
      expect(ended.children).toEqual([
        expect.objectContaining({ sessionId: childId, state: 'stopped', parentSessionId: rootId }),
        expect.objectContaining({ sessionId: grandchildId, state: 'stopped', parentSessionId: childId })
      ]);
      const output = JSON.stringify(await call('get_output', { sessionId: rootId }));
      expect(output).toContain('grandchild done 42');
      expect(output).toContain('child grandchild exit 0');
      expect(output).toContain('parent child exit 0');
    } finally {
      await call('close_debug_session', { sessionId: rootId });
    }
  }, 120000);

  it('closing a child with a paused grandchild closes both, orphans nothing, and the root goes on (a non-root subtree close)', async () => {
    const { rootId, childId, grandchildId } = await startChain('cascade-close-child-subtree');
    try {
      const closed = await call('close_debug_session', { sessionId: childId });
      expect(closed.success, JSON.stringify(closed)).toBe(true);
      expect(closed.childrenClosed, JSON.stringify(closed)).toBe(1);
      expect(closed.processEnded, JSON.stringify(closed)).toBe(true);

      const listing = await rows();
      const ids = listing.map((s) => s.id);
      expect(ids).not.toContain(childId);
      expect(ids).not.toContain(grandchildId);
      expect(ids).toContain(rootId);

      // The shared worker is untouched: the root sees its child's end and ends itself.
      const ended = await call('wait_for_stop', { sessionId: rootId, timeout: 30000 });
      expect(ended.state, JSON.stringify(ended)).toBe('stopped');
      expect(ended.sessionId).toBe(rootId);
      expect(ended.children).toBeUndefined();
      expect(JSON.stringify(await call('get_output', { sessionId: rootId }))).toMatch(/parent child exit \d+/);
    } finally {
      await call('close_debug_session', { sessionId: rootId });
    }
  }, 120000);

  it('closing one of two children ends that child alone: its sibling and the parent go on (child termination keeps the worker)', async () => {
    const rootId = await createRoot('cascade-siblings');
    try {
      await setBreakpoint(rootId, childFixture, CHILD_BREAKPOINT_LINE);
      await start(rootId, parentTwoFixture);

      const first = await call('wait_for_stop', { sessionId: rootId, timeout: 30000 });
      expect(first.state, JSON.stringify(first)).toBe('paused');
      expect(first.sessionId).not.toBe(rootId);
      const listing = await pollUntil(
        rows,
        (l) => l.filter((s) => s.parentSessionId === rootId && s.state === 'paused').length === 2,
        30000
      );
      const children = listing.filter((s) => s.parentSessionId === rootId);
      expect(children, JSON.stringify(listing)).toHaveLength(2);
      const [closedChild, survivor] = children;

      const closed = await call('close_debug_session', { sessionId: closedChild.id });
      expect(closed.success, JSON.stringify(closed)).toBe(true);
      expect(closed.processEnded).toBe(true);
      expect(closed.childrenClosed).toBeUndefined();

      const after = await rows();
      expect(after.map((s) => s.id)).not.toContain(closedChild.id);
      expect(after.find((s) => s.id === survivor.id)?.state).toBe('paused');
      expect(after.find((s) => s.id === rootId)?.state).toBe('running');
      const stack = await call('get_stack_trace', { sessionId: survivor.id });
      expect(stack.success, JSON.stringify(stack)).toBe(true);

      // The survivor runs its remaining two iterations; the parent then ends.
      for (let iteration = 1; iteration < 3; iteration += 1) {
        const resumed = await call('continue_execution', { sessionId: survivor.id });
        expect(resumed.success, JSON.stringify(resumed)).toBe(true);
        const stop = await call('wait_for_stop', { sessionId: rootId, timeout: 30000 });
        expect(stop.state, JSON.stringify(stop)).toBe('paused');
        expect(stop.sessionId).toBe(survivor.id);
        expect(stop.children).toEqual([expect.objectContaining({ sessionId: survivor.id, state: 'paused' })]);
      }
      const resumed = await call('continue_execution', { sessionId: survivor.id });
      expect(resumed.success, JSON.stringify(resumed)).toBe(true);
      const ended = await call('wait_for_stop', { sessionId: rootId, timeout: 30000 });
      expect(ended.state, JSON.stringify(ended)).toBe('stopped');
      expect(ended.sessionId).toBe(rootId);
      expect(ended.exitCode).toBe(0);
      expect(ended.children).toEqual([expect.objectContaining({ sessionId: survivor.id, state: 'stopped' })]);
      expect(JSON.stringify(await call('get_output', { sessionId: rootId }))).toContain('parent children exit 0 0');
    } finally {
      await call('close_debug_session', { sessionId: rootId });
    }
  }, 120000);

  it('a multiprocessing child (spawn) is reported and stops on the breakpoint in its target function', async () => {
    const rootId = await createRoot('cascade-multiprocessing');
    try {
      await setBreakpoint(rootId, mpParentFixture, MP_BREAKPOINT_LINE);
      await start(rootId, mpParentFixture);

      const stop = await call('wait_for_stop', { sessionId: rootId, timeout: 30000 });
      expect(stop.state, JSON.stringify(stop)).toBe('paused');
      expect(stop.sessionId).not.toBe(rootId);
      const childId = stop.sessionId as string;
      expect(locationOf(stop)).toMatch(/mp_parent\.py/);
      expect(lineOf(stop)).toBe(MP_BREAKPOINT_LINE);
      // POSIX spawn also starts a resource-tracker process, which debugpy
      // can adopt as a sibling. Identify the worker by its stop above; the
      // tree need not contain only that worker.
      expect(stop.children).toEqual(expect.arrayContaining([
        { sessionId: childId, name: expect.stringMatching(/^Subprocess \d+$/), state: 'paused', parentSessionId: rootId }
      ]));
      const locals = await call('get_local_variables', { sessionId: childId });
      expect(locals.success, JSON.stringify(locals)).toBe(true);
      expect(JSON.stringify(locals)).toMatch(/"n"/);

      const resumed = await call('continue_execution', { sessionId: childId });
      expect(resumed.success, JSON.stringify(resumed)).toBe(true);
      const ended = await call('wait_for_stop', { sessionId: rootId, timeout: 30000 });
      expect(ended.state, JSON.stringify(ended)).toBe('stopped');
      expect(ended.sessionId).toBe(rootId);
      expect(ended.exitCode).toBe(0);
      const output = JSON.stringify(await call('get_output', { sessionId: rootId }));
      expect(output).toContain('mp work done 42');
      expect(output).toContain('mp parent exit 0');
    } finally {
      await call('close_debug_session', { sessionId: rootId });
    }
  }, 120000);
});
