/**
 * Closing a child session of an attached Python tree by name (issue #1343).
 *
 * A target started with `python -m debugpy --listen` starts a child process,
 * which debugpy reports and the server adopts as a child session. Neither
 * process was started by this server, so closing the child's session must
 * release the child, as closing the root releases both: the answer says
 * `released: true`, the child runs on and finishes its work, and the root
 * session goes on being debugged. It used to send the child's connection
 * `disconnect { terminateDebuggee: true }` (debugpy's close for a launched
 * tree's child) and answer `processEnded: true`: the child was ended, and its
 * parent saw it exit 0, as if it had finished.
 *
 * The target says it is ready on its own output, never through a connection
 * to its debug port (a session-less connection makes debugpy's adapter exit).
 * The released child keeps running, waiting, until the test creates its go
 * file, so no assertion depends on how long the server took to answer. Both
 * processes run until the test stops them, and each bounds its own life with
 * a 10-minute backstop armed when it starts (an aborted run leaves neither).
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import net from 'node:net';
import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { Client } from '@modelcontextprotocol/client';
import { ensurePythonOnPath } from './env-utils.js';

const currentDirName = path.dirname(fileURLToPath(import.meta.url));
const treeDir = path.resolve(currentDirName, '../../../fixtures/python/subprocess-tree');
const parentScript = path.join(treeDir, 'attach_service_parent.py');
const childScript = path.join(treeDir, 'child_steps.py');
/** `print("parent attached", ...)` in attach_service_parent.py: before the child starts. */
const PARENT_BREAKPOINT_LINE = 36;
/** `return count + 1  # TICK` in attach_service_parent.py: reached every 50 ms once the child has ended. */
const TICK_LINE = 29;
/** `total += i  # BREAKPOINT` in child_steps.py. */
const CHILD_BREAKPOINT_LINE = 27;
const PYTHON =
  process.env.PYTHON_PATH ??
  process.env.PYTHON_EXECUTABLE ??
  (process.platform === 'win32' ? 'python' : 'python3');

/**
 * A loopback port in 5960..5989, a window of its own so this file never
 * races the attach-addressing suite (5900..5959) for one, falling back to an
 * OS-assigned port only when all 30 are taken.
 */
async function tryBindPort(port: number): Promise<number | null> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(null));
    server.listen(port, '127.0.0.1', () => {
      const address = server.address();
      const bound = typeof address === 'object' && address ? address.port : null;
      server.close(() => resolve(bound));
    });
  });
}

let nextCandidatePort = 5960;

async function getAttachPort(): Promise<number> {
  for (let offset = 0; offset < 30; offset++) {
    const candidate = 5960 + ((nextCandidatePort - 5960 + offset) % 30);
    const bound = await tryBindPort(candidate);
    if (bound !== null) {
      nextCandidatePort = 5960 + ((candidate - 5960 + 1) % 30);
      return bound;
    }
  }
  const fallback = await tryBindPort(0);
  if (fallback === null) {
    throw new Error('Could not bind any loopback port');
  }
  return fallback;
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

interface Target {
  proc: ChildProcess;
  port: number;
  output: () => string;
  exited: Promise<number | null>;
  /** The child process the target started, once the server reported it: stopped with the target. */
  childPid?: number;
  /** The file the child waits for after its first step; created by the test to let it finish. */
  goFile: string;
  /** The directory that holds it, removed when the target is stopped. */
  dir: string;
}

const PORT_IN_USE_PATTERN = /Address already in use|EADDRINUSE|10048/i;

describe('Closing a child session of an attached Python tree (issue #1343) @requires-python', () => {
  let client: Client | null = null;
  let targets: Target[] = [];

  async function stopTarget(target: Target): Promise<void> {
    // The child first: stopping the parent alone would orphan it.
    if (target.childPid !== undefined && isAlive(target.childPid)) {
      try {
        process.kill(target.childPid);
      } catch {
        // already exited
      }
    }
    if (target.proc.pid !== undefined && target.proc.exitCode === null) {
      try {
        process.kill(target.proc.pid);
      } catch {
        // already exited
      }
    }
    const exited = await Promise.race([
      target.exited.then(() => true),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 3000))
    ]);
    if (!exited && target.proc.exitCode === null) {
      try {
        target.proc.kill('SIGKILL');
      } catch {
        // already exited
      }
      await Promise.race([target.exited, new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000))]);
    }
    fs.rmSync(target.dir, { recursive: true, force: true });
  }

  async function stopAllTargets(): Promise<void> {
    const toStop = targets;
    targets = [];
    for (const target of toStop) {
      await stopTarget(target);
    }
  }

  beforeAll(async () => {
    const serverScriptPath = path.resolve(currentDirName, '../../../../dist/index.js');
    client = new Client({ name: 'mcp-attach-child-close-test', version: '0.1.0' }, { capabilities: {} });

    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined) env[key] = value;
    }
    ensurePythonOnPath(env);

    const logFilePath = path.join(os.tmpdir(), `mcp-debugger-1343-${process.pid}.log`);
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [serverScriptPath, '--log-level', 'info', '--log-file', logFilePath],
      env
    });
    await client.connect(transport);
  }, 30000);

  afterEach(async () => {
    await stopAllTargets();
  });

  afterAll(async () => {
    await stopAllTargets();
    if (client) {
      try {
        await client.close();
      } catch {
        // best effort
      }
      client = null;
    }
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function call(name: string, args: Record<string, unknown>): Promise<any> {
    if (!client) throw new Error('MCP client not initialized');
    const raw = await client.callTool({ name, arguments: args });
    const content = raw.content as Array<{ type: string; text?: string }>;
    if (!content?.[0] || content[0].type !== 'text' || typeof content[0].text !== 'string') {
      throw new Error(`Unexpected tool result: ${JSON.stringify(raw)}`);
    }
    return JSON.parse(content[0].text);
  }

  async function startTargetOnce(): Promise<Target> {
    const port = await getAttachPort();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-debugger-1343-'));
    const goFile = path.join(dir, 'go');
    const proc = spawn(PYTHON, ['-m', 'debugpy', '--listen', `127.0.0.1:${port}`, parentScript, goFile], {
      cwd: treeDir,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let buffer = '';
    // close also waits for the output pipes, so the assertions see the final lines.
    const exited = new Promise<number | null>((resolve) => proc.on('close', (code) => resolve(code)));
    const target: Target = { proc, port, output: () => buffer, exited, goFile, dir };
    // Registered before readiness, so afterEach also stops a target that failed to start.
    targets.push(target);
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`debugpy target not ready on 127.0.0.1:${port}: ${buffer}`)), 20000);
      const onData = (chunk: Buffer) => {
        buffer += chunk.toString();
        if (buffer.includes('ATTACH_PARENT_READY')) {
          clearTimeout(timer);
          resolve();
        }
      };
      proc.stdout!.on('data', onData);
      proc.stderr!.on('data', onData);
      proc.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
      proc.on('exit', (code) => {
        clearTimeout(timer);
        reject(new Error(`debugpy target exited (${code}) before ready: ${buffer}`));
      });
    });
    return target;
  }

  async function startTarget(): Promise<Target> {
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        return await startTargetOnce();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (attempt < 4 && PORT_IN_USE_PATTERN.test(message)) {
          const failed = targets.pop();
          if (failed) await stopTarget(failed);
          continue;
        }
        throw error;
      }
    }
    throw new Error('unreachable');
  }

  /** Resolves once the target's own pipe has printed `line`; fails after `timeoutMs` with what it printed. */
  async function targetPrinted(target: Target, line: string, timeoutMs: number): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (!target.output().includes(line)) {
      if (Date.now() > deadline) {
        throw new Error(`the target did not print "${line}" within ${timeoutMs} ms; it printed:\n${target.output()}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  it('releases the child: the answer says released, the child finishes its work, and the root session goes on', async () => {
    const target = await startTarget();
    const created = await call('create_debug_session', { language: 'python', name: 'attach-child-close-1343' });
    expect(created.success, JSON.stringify(created)).toBe(true);
    const rootId = String(created.sessionId);
    let rootClosed = false;

    try {
      // Both breakpoints before the attach: the parent stops before it starts the child.
      expect((await call('set_breakpoint', { sessionId: rootId, file: parentScript, line: PARENT_BREAKPOINT_LINE })).success).toBe(true);
      expect((await call('set_breakpoint', { sessionId: rootId, file: childScript, line: CHILD_BREAKPOINT_LINE })).success).toBe(true);
      const attached = await call('attach_to_process', { sessionId: rootId, host: '127.0.0.1', port: target.port });
      expect(attached.success, JSON.stringify(attached)).toBe(true);
      const landed = await call('wait_for_stop', { sessionId: rootId, timeout: 15000 });
      expect(landed.state, JSON.stringify(landed)).toBe('paused');
      expect(landed.location?.line ?? landed.lastStop?.line, JSON.stringify(landed)).toBe(PARENT_BREAKPOINT_LINE);
      expect((await call('continue_execution', { sessionId: rootId })).success).toBe(true);

      const childStop = await call('wait_for_stop', { sessionId: rootId, timeout: 30000 });
      expect(childStop.state, JSON.stringify(childStop)).toBe('paused');
      const childId = String(childStop.sessionId);
      expect(childId).not.toBe(rootId);
      expect(childStop.location?.line ?? childStop.lastStop?.line, JSON.stringify(childStop)).toBe(CHILD_BREAKPOINT_LINE);
      const childRow = (childStop.children as Array<{ sessionId: string; name: string }>).find((c) => c.sessionId === childId);
      const childPid = Number(/^Subprocess (\d+)$/.exec(childRow?.name ?? '')?.[1]);
      expect(Number.isInteger(childPid), JSON.stringify(childStop)).toBe(true);
      target.childPid = childPid;

      const closed = await call('close_debug_session', { sessionId: childId });
      expect(closed.success, JSON.stringify(closed)).toBe(true);
      expect(closed.released, JSON.stringify(closed)).toBe(true);
      expect(closed.processEnded, JSON.stringify(closed)).toBeUndefined();
      expect(closed.warning, JSON.stringify(closed)).toBeUndefined();

      // The child runs on: it waits for its go file after its first step, so
      // it is alive however long the answer took. Told to finish, it does its
      // remaining steps and exits 0 on its own, and its parent says so.
      expect(isAlive(childPid)).toBe(true);
      fs.writeFileSync(target.goFile, 'go');
      await targetPrinted(target, 'child done 3', 20000);
      await targetPrinted(target, 'parent child exit 0', 20000);

      // The root session goes on: its row is there without the child's, and it stops on a new breakpoint.
      const listing = await call('list_debug_sessions', {});
      const ids = (listing.sessions as Array<{ id: string }>).map((s) => s.id);
      expect(ids).toContain(rootId);
      expect(ids).not.toContain(childId);
      expect((await call('set_breakpoint', { sessionId: rootId, file: parentScript, line: TICK_LINE })).success).toBe(true);
      const ticked = await call('wait_for_stop', { sessionId: rootId, timeout: 15000 });
      expect(ticked.state, JSON.stringify(ticked)).toBe('paused');
      expect(ticked.sessionId).toBe(rootId);
      expect(ticked.location?.line ?? ticked.lastStop?.line, JSON.stringify(ticked)).toBe(TICK_LINE);

      // Closing the root releases the target too: it is still running when the test stops it.
      const rootClose = await call('close_debug_session', { sessionId: rootId });
      rootClosed = true;
      expect(rootClose.success, JSON.stringify(rootClose)).toBe(true);
      expect(rootClose.released, JSON.stringify(rootClose)).toBe(true);
      expect(target.proc.exitCode).toBeNull();
    } finally {
      if (!rootClosed) {
        await call('close_debug_session', { sessionId: rootId });
      }
    }
  }, 120000);
});
