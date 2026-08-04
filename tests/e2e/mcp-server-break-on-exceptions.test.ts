/**
 * Break-on-exception E2E tests (issue #220)
 *
 * Validates the breakOnExceptions option end to end:
 * - Mock adapter: full stack (server -> proxy -> real mock adapter process)
 *   with the gated exception simulation, including exit-code surfacing
 * - Python launch: uncaught ZeroDivisionError pauses at the crash site with
 *   stack + locals live instead of terminating the session
 * - Python launch without the option: unchanged behavior (terminates), with
 *   the debuggee exit code surfaced
 * - Python attach: filters armed during the attach init sequence
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn, type ChildProcess } from 'child_process';
import net from 'net';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { parseSdkToolResult, callToolSafely } from './smoke-test-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

const CRASHING_SCRIPT = path.resolve(ROOT, 'tests', 'fixtures', 'debug-scripts', 'with-errors.py');
const JS_CRASHING_SCRIPT = path.resolve(ROOT, 'tests', 'fixtures', 'debug-scripts', 'js-throws.js');
const ATTACH_SCRIPT = path.resolve(ROOT, 'tests', 'fixtures', 'python', 'attach_then_raise.py');
const PYTHON = process.platform === 'win32' ? 'python' : 'python3';

interface SessionSnapshot {
  state?: string;
  lastStop?: { reason?: string; description?: string; text?: string };
  exitCode?: number;
}

async function getSessionSnapshot(client: Client, sessionId: string): Promise<SessionSnapshot | undefined> {
  const res = parseSdkToolResult(await client.callTool({ name: 'list_debug_sessions', arguments: {} }));
  const sessions = (res.sessions ?? []) as Array<SessionSnapshot & { id: string }>;
  return sessions.find(s => s.id === sessionId);
}

async function pollUntil<T>(
  fn: () => Promise<T | undefined>,
  timeoutMs: number,
  intervalMs = 250
): Promise<T | undefined> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await fn();
    if (value !== undefined) return value;
    if (Date.now() > deadline) return undefined;
    await new Promise(r => setTimeout(r, intervalMs));
  }
}

async function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address && typeof address === 'object') {
        const port = address.port;
        server.close(() => resolve(port));
      } else {
        server.close(() => reject(new Error('No port assigned')));
      }
    });
    server.on('error', reject);
  });
}

describe('Break-on-exception (issue #220)', () => {
  let mcpClient: Client | null = null;
  let transport: StdioClientTransport | null = null;
  let sessionId: string | null = null;

  beforeAll(async () => {
    transport = new StdioClientTransport({
      command: process.execPath,
      args: [path.join(ROOT, 'dist', 'index.js'), '--log-level', 'info'],
      env: { ...process.env, NODE_ENV: 'test' }
    });
    mcpClient = new Client(
      { name: 'break-on-exceptions-e2e', version: '1.0.0' },
      { capabilities: {} }
    );
    await mcpClient.connect(transport);
  }, 30000);

  afterAll(async () => {
    if (mcpClient) await mcpClient.close();
    if (transport) await transport.close();
  });

  afterEach(async () => {
    if (sessionId && mcpClient) {
      await callToolSafely(mcpClient, 'close_debug_session', { sessionId });
      sessionId = null;
    }
  });

  async function createSession(language: string, name: string): Promise<string> {
    const createRes = parseSdkToolResult(await mcpClient!.callTool({
      name: 'create_debug_session',
      arguments: { language, name }
    }));
    expect(createRes.sessionId).toBeDefined();
    return createRes.sessionId as string;
  }

  describe('Mock adapter (full stack)', () => {
    it('pauses at the simulated uncaught exception and surfaces exit code 1 after continue', async () => {
      sessionId = await createSession('mock', 'mock-break-on-exceptions');

      const startRes = parseSdkToolResult(await mcpClient!.callTool({
        name: 'start_debugging',
        arguments: {
          sessionId,
          scriptPath: CRASHING_SCRIPT,
          breakOnExceptions: 'uncaught'
        }
      }));
      expect(startRes.success).toBe(true);

      // The mock emits stopped{reason:'exception'} instead of terminating
      const paused = await pollUntil(async () => {
        const snap = await getSessionSnapshot(mcpClient!, sessionId!);
        return snap?.state === 'paused' && snap.lastStop?.reason === 'exception' ? snap : undefined;
      }, 10000);
      expect(paused, 'session should pause with reason exception').toBeDefined();
      expect(paused!.lastStop!.description).toBe('MockError');
      expect(paused!.lastStop!.text).toBe('Mock uncaught exception');

      // get_stack_trace surfaces the stop reason (issue #214 surface)
      const stack = parseSdkToolResult(await mcpClient!.callTool({
        name: 'get_stack_trace',
        arguments: { sessionId }
      }));
      expect(stack.stopReason).toBe('exception');

      // Continue past the exception: mock terminates with exit code 1
      await callToolSafely(mcpClient!, 'continue_execution', { sessionId });
      const stopped = await pollUntil(async () => {
        const snap = await getSessionSnapshot(mcpClient!, sessionId!);
        return snap?.state === 'stopped' ? snap : undefined;
      }, 10000);
      expect(stopped, 'session should terminate after continuing past the exception').toBeDefined();
      expect(stopped!.exitCode).toBe(1);
    }, 30000);

    it('runs to completion with exit code 0 when breakOnExceptions is not set (regression guard)', async () => {
      sessionId = await createSession('mock', 'mock-no-break-on-exceptions');

      const startRes = parseSdkToolResult(await mcpClient!.callTool({
        name: 'start_debugging',
        arguments: {
          sessionId,
          scriptPath: CRASHING_SCRIPT
        }
      }));
      expect(startRes.success).toBe(true);

      const stopped = await pollUntil(async () => {
        const snap = await getSessionSnapshot(mcpClient!, sessionId!);
        return snap?.state === 'stopped' ? snap : undefined;
      }, 10000);
      expect(stopped, 'session should run to completion').toBeDefined();
      expect(stopped!.lastStop).toBeUndefined();
      expect(stopped!.exitCode).toBe(0);
    }, 30000);

    it('rejects an invalid breakOnExceptions value', async () => {
      sessionId = await createSession('mock', 'mock-invalid-mode');

      await expect(mcpClient!.callTool({
        name: 'start_debugging',
        arguments: {
          sessionId,
          scriptPath: CRASHING_SCRIPT,
          breakOnExceptions: 'sometimes'
        }
      })).rejects.toThrow(/breakOnExceptions/);
    }, 30000);
  });

  describe('Python launch', () => {
    it('pauses at the uncaught ZeroDivisionError crash site with locals live', async () => {
      sessionId = await createSession('python', 'py-break-on-exceptions');

      const startRes = parseSdkToolResult(await mcpClient!.callTool({
        name: 'start_debugging',
        arguments: {
          sessionId,
          scriptPath: CRASHING_SCRIPT,
          dapLaunchArgs: { stopOnEntry: false },
          breakOnExceptions: 'uncaught'
        }
      }));
      expect(startRes.success).toBe(true);

      const paused = await pollUntil(async () => {
        const snap = await getSessionSnapshot(mcpClient!, sessionId!);
        return snap?.state === 'paused' && snap.lastStop?.reason === 'exception' ? snap : undefined;
      }, 15000);
      expect(paused, 'session should pause at the uncaught exception instead of terminating').toBeDefined();
      // debugpy puts the exception class/message in description/text
      const detail = `${paused!.lastStop!.description ?? ''} ${paused!.lastStop!.text ?? ''}`;
      expect(detail).toMatch(/ZeroDivisionError|division/i);

      // Stack trace: top frame at the crash site (divide, line 5)
      const stack = parseSdkToolResult(await mcpClient!.callTool({
        name: 'get_stack_trace',
        arguments: { sessionId }
      }));
      expect(stack.stopReason).toBe('exception');
      const frames = stack.stackFrames as Array<{ name: string; line: number; file?: string }>;
      expect(frames.length).toBeGreaterThan(0);
      expect(Math.abs(frames[0].line - 5)).toBeLessThanOrEqual(1);

      // Locals at the crash site are inspectable
      const locals = parseSdkToolResult(await mcpClient!.callTool({
        name: 'get_local_variables',
        arguments: { sessionId }
      }));
      const variables = (locals.variables ?? []) as Array<{ name: string; value: string }>;
      const a = variables.find(v => v.name === 'a');
      const b = variables.find(v => v.name === 'b');
      expect(a?.value).toBe('10');
      expect(b?.value).toBe('0');

      // Continue: debugpy re-raises and the session terminates
      await callToolSafely(mcpClient!, 'continue_execution', { sessionId });
      const stopped = await pollUntil(async () => {
        const snap = await getSessionSnapshot(mcpClient!, sessionId!);
        return snap?.state === 'stopped' ? snap : undefined;
      }, 15000);
      expect(stopped, 'session should terminate after continuing past the exception').toBeDefined();
    }, 60000);

    it('terminates without pausing when breakOnExceptions is not set (regression guard)', async () => {
      sessionId = await createSession('python', 'py-no-break-on-exceptions');

      const startRes = parseSdkToolResult(await mcpClient!.callTool({
        name: 'start_debugging',
        arguments: {
          sessionId,
          scriptPath: CRASHING_SCRIPT,
          dapLaunchArgs: { stopOnEntry: false }
        }
      }));
      expect(startRes.success).toBe(true);

      const stopped = await pollUntil(async () => {
        const snap = await getSessionSnapshot(mcpClient!, sessionId!);
        return snap?.state === 'stopped' ? snap : undefined;
      }, 15000);
      expect(stopped, 'session should terminate (pre-#220 behavior preserved)').toBeDefined();
      // No user-visible stop was recorded on the way down
      expect(stopped!.lastStop?.reason).not.toBe('exception');
      // The crash is distinguishable from a clean exit via the exit code
      expect(stopped!.exitCode).toBeDefined();
      expect(stopped!.exitCode).not.toBe(0);
    }, 60000);
  });

  describe('JavaScript launch (js-debug child session)', () => {
    // Runtime verification that the js-debug filter ID 'uncaught' is real:
    // the filters travel worker -> MinimalDapClient -> child session, so a
    // wrong ID means no pause and this test fails.
    it('pauses at an uncaught Error instead of terminating', async () => {
      sessionId = await createSession('javascript', 'js-break-on-exceptions');

      const startRes = parseSdkToolResult(await mcpClient!.callTool({
        name: 'start_debugging',
        arguments: {
          sessionId,
          scriptPath: JS_CRASHING_SCRIPT,
          dapLaunchArgs: { stopOnEntry: false },
          breakOnExceptions: 'uncaught'
        }
      }));
      expect(startRes.success).toBe(true);

      const paused = await pollUntil(async () => {
        const snap = await getSessionSnapshot(mcpClient!, sessionId!);
        return snap?.state === 'paused' && snap.lastStop?.reason === 'exception' ? snap : undefined;
      }, 20000);
      expect(paused, 'js session should pause at the uncaught exception').toBeDefined();

      const stack = parseSdkToolResult(await mcpClient!.callTool({
        name: 'get_stack_trace',
        arguments: { sessionId }
      }));
      expect(stack.stopReason).toBe('exception');
      const frames = stack.stackFrames as Array<{ name: string; line: number }>;
      expect(frames.length).toBeGreaterThan(0);
    }, 60000);

    // Regression guard for issue #242: launching a fast-crashing js script
    // WITHOUT breakOnExceptions used to hang start_debugging (the js-debug
    // launch barrier was disposed unsettled when the debuggee died mid-launch).
    it('terminates without pausing when breakOnExceptions is not set (regression guard, issue #242)', async () => {
      sessionId = await createSession('javascript', 'js-no-break-on-exceptions');

      const startRes = parseSdkToolResult(await mcpClient!.callTool({
        name: 'start_debugging',
        arguments: {
          sessionId,
          scriptPath: JS_CRASHING_SCRIPT,
          dapLaunchArgs: { stopOnEntry: false }
        }
      }));
      expect(startRes.success).toBe(true);

      const stopped = await pollUntil(async () => {
        const snap = await getSessionSnapshot(mcpClient!, sessionId!);
        return snap?.state === 'stopped' ? snap : undefined;
      }, 20000);
      expect(stopped, 'js session should terminate promptly instead of hanging (issue #242)').toBeDefined();
      // No user-visible stop was recorded on the way down
      expect(stopped!.lastStop?.reason).not.toBe('exception');
    }, 60000);
  });

  describe('Python attach', () => {
    let debuggee: ChildProcess | null = null;

    afterEach(() => {
      if (debuggee && !debuggee.killed) {
        debuggee.kill();
      }
      debuggee = null;
    });

    it('arms exception filters during attach and pauses at the post-attach raise', async () => {
      const port = await findFreePort();

      // Start the fixture: listens for debugpy attach, then raises after resume
      debuggee = spawn(PYTHON, ['-u', ATTACH_SCRIPT, String(port)], { stdio: 'pipe' });
      const listening = await new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => resolve(false), 15000);
        debuggee!.stdout!.on('data', (data: Buffer) => {
          if (data.toString().includes('LISTENING')) {
            clearTimeout(timer);
            resolve(true);
          }
        });
        debuggee!.on('exit', () => {
          clearTimeout(timer);
          resolve(false);
        });
      });
      expect(listening, 'debuggee should start listening for attach').toBe(true);

      sessionId = await createSession('python', 'py-attach-break-on-exceptions');

      const attachRes = parseSdkToolResult(await mcpClient!.callTool({
        name: 'attach_to_process',
        arguments: {
          sessionId,
          host: '127.0.0.1',
          port,
          breakOnExceptions: 'uncaught'
        }
      }));
      expect(attachRes.success).toBe(true);

      // attach pauses the target (pauseAfterAttach); resume it so the fixture
      // reaches its raise
      await callToolSafely(mcpClient!, 'continue_execution', { sessionId });

      const paused = await pollUntil(async () => {
        const snap = await getSessionSnapshot(mcpClient!, sessionId!);
        return snap?.state === 'paused' && snap.lastStop?.reason === 'exception' ? snap : undefined;
      }, 20000);
      expect(paused, 'attach session should pause at the uncaught exception').toBeDefined();
      const detail = `${paused!.lastStop!.description ?? ''} ${paused!.lastStop!.text ?? ''}`;
      expect(detail).toMatch(/RuntimeError|attach-mode uncaught exception/i);
    }, 60000);
  });
});
