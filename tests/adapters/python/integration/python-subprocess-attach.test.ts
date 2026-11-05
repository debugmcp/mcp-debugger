/**
 * The session tree over a by-port attach with real debugpy (issue #1081): a
 * target started with `python -m debugpy --listen` that spawns a Python
 * child. Measured here (2026-11-04, debugpy 1.8.20): the child's report
 * arrives on the attach connection with `connect.port` equal to the port
 * attached to, whatever the attach request says about `subProcess` — the
 * target decides at listen time (`--configure-subProcess`). The cascades on
 * an attach root release its targets: detach keeps the rows, close removes
 * them, and the target runs to its end either way.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import path from 'path';
import fs from 'node:fs';
import net from 'node:net';
import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'url';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { Client } from '@modelcontextprotocol/client';
import { ensurePythonOnPath } from './env-utils.js';

const currentDirName = path.dirname(fileURLToPath(import.meta.url));
const treeDir = path.resolve(currentDirName, '../../../fixtures/python/subprocess-tree');
const attachParent = path.join(treeDir, 'attach_parent.py');
const childFixture = path.join(treeDir, 'child.py');
/** The first line after wait_for_client, before the target can spawn or exit. */
const PARENT_BREAKPOINT_LINE = 17;
/** `total += i  # BREAKPOINT` in child.py. */
const CHILD_BREAKPOINT_LINE = 12;
const PYTHON = process.env.PYTHON_PATH ?? process.env.PYTHON_EXECUTABLE ?? (process.platform === 'win32' ? 'python' : 'python3');

async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close(() => (port ? resolve(port) : reject(new Error('no free port'))));
    });
    server.on('error', reject);
  });
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

  const logFilePath = path.resolve(currentDirName, '../../subprocess_attach_test_server.log');
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

type Row = { id: string; state: string; parentSessionId?: string };

async function rows(): Promise<Row[]> {
  const listing = await call('list_debug_sessions', {});
  return listing.sessions as Row[];
}

interface Target { proc: ChildProcess; port: number; output: () => string; exited: Promise<number | null> }

let targets: Target[] = [];

/**
 * Start attach_parent.py under `python -m debugpy --listen` and wait for its
 * READY line. No TCP probe: a session-less connect makes the adapter exit
 * (docs/python/spike-notes-subprocess.md), and the script prints READY after
 * debugpy has its listener up.
 */
async function startTarget(extraArgs: string[] = []): Promise<Target> {
  const port = await getFreePort();
  const proc = spawn(PYTHON, ['-m', 'debugpy', '--listen', `127.0.0.1:${port}`, ...extraArgs, attachParent], {
    cwd: treeDir,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let buffer = '';
  // close also waits for the output pipes, so the exit assertions see the final lines.
  const exited = new Promise<number | null>((resolve) => proc.on('close', (code) => resolve(code)));
  const target = { proc, port, output: () => buffer, exited };
  // Register before readiness so afterEach also cleans up a failed startup.
  targets.push(target);
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`debugpy target not ready: ${buffer}`)), 20000);
    const onData = (chunk: Buffer) => {
      buffer += chunk.toString();
      if (buffer.includes('ATTACH_PARENT_READY')) { clearTimeout(timer); resolve(); }
    };
    proc.stdout!.on('data', onData);
    proc.stderr!.on('data', onData);
    proc.on('error', (error) => { clearTimeout(timer); reject(error); });
    proc.on('exit', (code) => { clearTimeout(timer); reject(new Error(`debugpy target exited ${code} before ready: ${buffer}`)); });
  });
  return target;
}

/** The target's exit, with its own pipe's last lines: the proof that nothing killed it. */
async function targetRanToItsEnd(target: Target): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const exit = await Promise.race([target.exited, new Promise<string>((resolve) => {
      timer = setTimeout(() => resolve('still running'), 20000);
    })]);
    expect(exit, target.output()).toBe(0);
    expect(target.output()).toContain('child done 3');
    expect(target.output()).toContain('parent child exit 0');
  } finally {
    clearTimeout(timer);
  }
}

describe('Python session tree over a by-port attach (issue #1081) @requires-python', () => {
  beforeAll(async () => {
    await startTestServer();
  }, 30000);

  afterAll(async () => {
    await stopTestServer();
  });

  afterEach(() => {
    for (const target of targets) {
      if (target.proc.exitCode === null) target.proc.kill();
    }
    targets = [];
  });

  /**
   * Set both breakpoints before attaching. The parent must stop before it
   * spawns: attach alone need not pause it, and a tree wait may name a child.
   * This also keeps the opt-out target alive through attach verification.
   */
  async function attachTree(name: string, target: Target, adapterConfig?: Record<string, unknown>) {
    const created = await call('create_debug_session', { language: 'python', name });
    expect(created.success).toBe(true);
    const rootId = created.sessionId as string;
    try {
      return await attachRoot(rootId, target, adapterConfig);
    } catch (error) {
      await call('close_debug_session', { sessionId: rootId });
      throw error;
    }
  }

  async function attachRoot(rootId: string, target: Target, adapterConfig?: Record<string, unknown>) {
    const parentBp = await call('set_breakpoint', { sessionId: rootId, file: attachParent, line: PARENT_BREAKPOINT_LINE });
    expect(parentBp.success, JSON.stringify(parentBp)).toBe(true);
    const bp = await call('set_breakpoint', { sessionId: rootId, file: childFixture, line: CHILD_BREAKPOINT_LINE });
    expect(bp.success, JSON.stringify(bp)).toBe(true);

    const attachArgs: Record<string, unknown> = { sessionId: rootId, host: '127.0.0.1', port: target.port };
    if (adapterConfig) attachArgs.adapterConfig = adapterConfig;
    const attached = await call('attach_to_process', attachArgs);
    expect(attached.success, JSON.stringify(attached)).toBe(true);
    const landed = await call('wait_for_stop', { sessionId: rootId, timeout: 15000 });
    expect(landed.state, JSON.stringify(landed)).toBe('paused');
    expect(landed.sessionId, JSON.stringify(landed)).toBe(rootId);
    expect(JSON.stringify(landed.location ?? landed.lastStop)).toMatch(/attach_parent\.py/);
    expect(landed.location?.line ?? landed.lastStop?.line).toBe(PARENT_BREAKPOINT_LINE);
    const resumed = await call('continue_execution', { sessionId: rootId });
    expect(resumed.success, JSON.stringify(resumed)).toBe(true);
    return { rootId, attached };
  }

  async function firstChildStop(rootId: string): Promise<string> {
    const stop = await call('wait_for_stop', { sessionId: rootId, timeout: 30000 });
    expect(stop.state, JSON.stringify(stop)).toBe('paused');
    expect(stop.sessionId, JSON.stringify(stop)).toBeDefined();
    expect(stop.sessionId).not.toBe(rootId);
    const childId = stop.sessionId as string;
    expect(JSON.stringify(stop.location ?? stop)).toMatch(/child\.py/);
    expect(stop.location?.line ?? stop.lastStop?.line).toBe(CHILD_BREAKPOINT_LINE);
    expect(stop.children, JSON.stringify(stop)).toEqual([
      { sessionId: childId, name: expect.stringMatching(/^Subprocess \d+$/), state: 'paused', parentSessionId: rootId }
    ]);
    return childId;
  }

  it("the attached parent's child is reported on the attach connection and stops on the breakpoint set before the attach", async () => {
    const target = await startTarget();
    const { rootId, attached } = await attachTree('attach-tree-designed-flow', target);
    try {
      expect(attached.warning ?? '').not.toContain('subProcess');
      const childId = await firstChildStop(rootId);
      for (let iteration = 1; iteration < 3; iteration += 1) {
        const resumed = await call('continue_execution', { sessionId: childId });
        expect(resumed.success, JSON.stringify(resumed)).toBe(true);
        const stop = await call('wait_for_stop', { sessionId: rootId, timeout: 30000 });
        expect(stop.state, JSON.stringify(stop)).toBe('paused');
        expect(stop.sessionId).toBe(childId);
      }
      const resumed = await call('continue_execution', { sessionId: childId });
      expect(resumed.success, JSON.stringify(resumed)).toBe(true);
      // An attach root ends with `terminated` and no exit code, like its child.
      const ended = await call('wait_for_stop', { sessionId: rootId, timeout: 30000 });
      expect(ended.state, JSON.stringify(ended)).toBe('stopped');
      expect(ended.sessionId).toBe(rootId);
      expect(ended.children).toEqual([expect.objectContaining({ sessionId: childId, state: 'stopped', parentSessionId: rootId })]);
      await targetRanToItsEnd(target);
    } finally {
      await call('close_debug_session', { sessionId: rootId });
    }
  }, 120000);

  it('detaching the attach root releases the child first and keeps both rows stopped; the target runs on to its end', async () => {
    const target = await startTarget();
    const { rootId } = await attachTree('attach-tree-detach', target);
    try {
      const childId = await firstChildStop(rootId);

      const detached = await call('detach_from_process', { sessionId: rootId });
      expect(detached.success, JSON.stringify(detached)).toBe(true);
      expect(detached.childrenReleased, JSON.stringify(detached)).toBe(1);
      expect(detached.childrenClosed).toBeUndefined();

      // Detach keeps the rows: the child is stopped and says it was released.
      const listing = await rows();
      expect(listing.find((s) => s.id === rootId)?.state).toBe('stopped');
      expect(listing.find((s) => s.id === childId)?.state).toBe('stopped');
      const childEnd = await call('wait_for_stop', { sessionId: childId, timeout: 5000 });
      expect(childEnd.state, JSON.stringify(childEnd)).toBe('stopped');
      expect(childEnd.released, JSON.stringify(childEnd)).toBe(true);
      expect(JSON.stringify(childEnd.programEnd ?? childEnd)).toMatch(/[Rr]eleased/);

      // Nothing was killed: the released child finished its loop and the parent exited with its code.
      await targetRanToItsEnd(target);
    } finally {
      await call('close_debug_session', { sessionId: rootId });
    }
  }, 120000);

  it('closing the attach root releases the child and removes both rows; the target runs on to its end', async () => {
    const target = await startTarget();
    const { rootId } = await attachTree('attach-tree-close', target);
    const childId = await firstChildStop(rootId);

    const closed = await call('close_debug_session', { sessionId: rootId });
    expect(closed.success, JSON.stringify(closed)).toBe(true);
    expect(closed.released, JSON.stringify(closed)).toBe(true);
    expect(closed.childrenClosed, JSON.stringify(closed)).toBe(1);
    expect(closed.processEnded).toBeUndefined();

    const ids = (await rows()).map((s) => s.id);
    expect(ids).not.toContain(rootId);
    expect(ids).not.toContain(childId);

    await targetRanToItsEnd(target);
  }, 120000);

  it("an attach's subProcess: false changes nothing — the target decides — and the answer says so", async () => {
    const target = await startTarget();
    const { rootId, attached } = await attachTree('attach-tree-request-false', target, { subProcess: false });
    try {
      expect(attached.warning, JSON.stringify(attached)).toMatch(/subProcess: forwarded, but a target started with python -m debugpy --listen decides/);
      const childId = await firstChildStop(rootId);
      expect(childId).toBeDefined();
    } finally {
      await call('close_debug_session', { sessionId: rootId });
      await targetRanToItsEnd(target);
    }
  }, 120000);

  it('a target started with --configure-subProcess false reports no children: they run undebugged', async () => {
    const target = await startTarget(['--configure-subProcess', 'false']);
    const { rootId } = await attachTree('attach-tree-target-off', target);
    try {
      const ended = await call('wait_for_stop', { sessionId: rootId, timeout: 30000 });
      expect(ended.state, JSON.stringify(ended)).toBe('stopped');
      expect(ended.sessionId).toBe(rootId);
      expect(ended.children).toBeUndefined();
      expect((await rows()).some((s) => s.parentSessionId === rootId)).toBe(false);
      await targetRanToItsEnd(target);
    } finally {
      await call('close_debug_session', { sessionId: rootId });
    }
  }, 120000);
});
