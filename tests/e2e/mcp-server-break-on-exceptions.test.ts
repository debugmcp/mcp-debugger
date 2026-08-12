/**
 * Break-on-exception E2E tests (issue #220)
 *
 * Validates the breakOnExceptions option end to end:
 * - Mock adapter: full stack (server -> proxy -> real mock adapter process)
 *   with the gated exception simulation, including exit-code surfacing
 * - Python launch: uncaught ZeroDivisionError pauses at the crash site with
 *   stack + locals live instead of terminating the session
 * - Launch default (issue #244): with the option unset, launch sessions pause
 *   at uncaught exceptions; explicit "none" opts out and restores
 *   run-to-termination with the debuggee exit code surfaced
 * - Java launch (issue #259): JDI bridge advertises the exception filters and
 *   answers exceptionInfo — uncaught RuntimeException pauses with enrichment,
 *   'all' also pauses at the caught raise with breakMode 'always'
 * - Rust launch (issue #260): CodeLLDB's rust_panic filter hit arrives as an
 *   internal-breakpoint stop; the policy normalizes it to 'exception';
 *   explicit 'none' runs the panicking program to termination (exit 101)
 * - Python attach: filters armed during the attach init sequence (attach
 *   itself never applies a default)
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn, execSync, type ChildProcess } from 'child_process';
import net from 'net';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { parseSdkToolResult, callToolSafely, pollUntil } from './smoke-test-utils.js';
import { prepareJavaExample } from './java-example-utils.js';
import { prepareRustExample } from './rust-example-utils.js';
import { skipIfSpawnBlocked } from '../test-utils/helpers/adapter-spawn.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

const CRASHING_SCRIPT = path.resolve(ROOT, 'tests', 'fixtures', 'debug-scripts', 'with-errors.py');
const JS_CRASHING_SCRIPT = path.resolve(ROOT, 'tests', 'fixtures', 'debug-scripts', 'js-throws.js');
const JS_CLEAN_SCRIPT = path.resolve(ROOT, 'tests', 'fixtures', 'debug-scripts', 'js-clean-exit.js');
const ATTACH_SCRIPT = path.resolve(ROOT, 'tests', 'fixtures', 'python', 'attach_then_raise.py');
const PYTHON = process.platform === 'win32' ? 'python' : 'python3';

interface SessionSnapshot {
  state?: string;
  lastStop?: {
    reason?: string;
    description?: string;
    text?: string;
    exceptionInfo?: {
      exceptionId?: string;
      breakMode?: string;
      description?: string;
      details?: { message?: string; typeName?: string; fullTypeName?: string; stackTrace?: string };
    };
  };
  exitCode?: number;
}

async function getSessionSnapshot(client: Client, sessionId: string): Promise<SessionSnapshot | undefined> {
  const res = parseSdkToolResult(await client.callTool({ name: 'list_debug_sessions', arguments: {} }));
  const sessions = (res.sessions ?? []) as Array<SessionSnapshot & { id: string }>;
  return sessions.find(s => s.id === sessionId);
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

      // Best-effort exceptionInfo enrichment lands asynchronously (issue #243)
      const enriched = await pollUntil(async () => {
        const snap = await getSessionSnapshot(mcpClient!, sessionId!);
        return snap?.lastStop?.exceptionInfo ? snap : undefined;
      }, 5000);
      expect(enriched, 'lastStop should gain exceptionInfo from the mock adapter').toBeDefined();
      expect(enriched!.lastStop!.exceptionInfo!.exceptionId).toBe('MockError');
      expect(enriched!.lastStop!.exceptionInfo!.breakMode).toBe('unhandled');
      expect(enriched!.lastStop!.exceptionInfo!.details?.typeName).toBe('MockError');

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

    it('pauses at the simulated uncaught exception by default when breakOnExceptions is not set (issue #244)', async () => {
      sessionId = await createSession('mock', 'mock-default-break-on-exceptions');

      const startRes = parseSdkToolResult(await mcpClient!.callTool({
        name: 'start_debugging',
        arguments: {
          sessionId,
          scriptPath: CRASHING_SCRIPT
        }
      }));
      expect(startRes.success).toBe(true);

      const paused = await pollUntil(async () => {
        const snap = await getSessionSnapshot(mcpClient!, sessionId!);
        return snap?.state === 'paused' && snap.lastStop?.reason === 'exception' ? snap : undefined;
      }, 10000);
      expect(paused, 'launch default uncaught should pause at the exception').toBeDefined();
      expect(paused!.lastStop!.description).toBe('MockError');
    }, 30000);

    it("runs to completion with exit code 0 with explicit breakOnExceptions 'none' (opt-out, issues #220/#244)", async () => {
      sessionId = await createSession('mock', 'mock-no-break-on-exceptions');

      const startRes = parseSdkToolResult(await mcpClient!.callTool({
        name: 'start_debugging',
        arguments: {
          sessionId,
          scriptPath: CRASHING_SCRIPT,
          breakOnExceptions: 'none'
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

    it("honors breakOnExceptions 'none' nested inside dapLaunchArgs with a warning (#305)", async () => {
      sessionId = await createSession('mock', 'mock-nested-break-on-exceptions');

      const startRes = parseSdkToolResult(await mcpClient!.callTool({
        name: 'start_debugging',
        arguments: {
          sessionId,
          scriptPath: CRASHING_SCRIPT,
          dapLaunchArgs: { stopOnEntry: false, breakOnExceptions: 'none' }
        }
      }));
      expect(startRes.success).toBe(true);
      expect((startRes as { warning?: string }).warning).toMatch(
        /breakOnExceptions is a top-level start_debugging parameter/
      );

      // Previously the nested value was silently dropped and the default
      // 'uncaught' paused at the crash site; now the session runs to
      // completion exactly like the top-level 'none' case above.
      const stopped = await pollUntil(async () => {
        const snap = await getSessionSnapshot(mcpClient!, sessionId!);
        return snap?.state === 'stopped' ? snap : undefined;
      }, 10000);
      expect(stopped, 'session should run to completion').toBeDefined();
      expect(stopped!.lastStop).toBeUndefined();
      expect(stopped!.exitCode).toBe(0);
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

      // debugpy supports exceptionInfo: the enrichment should land (issue #243)
      const enriched = await pollUntil(async () => {
        const snap = await getSessionSnapshot(mcpClient!, sessionId!);
        return snap?.lastStop?.exceptionInfo ? snap : undefined;
      }, 5000);
      expect(enriched, 'lastStop should gain exceptionInfo from debugpy').toBeDefined();
      expect(enriched!.lastStop!.exceptionInfo!.exceptionId).toMatch(/ZeroDivisionError/i);

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

    it('pauses at the uncaught exception by default when breakOnExceptions is not set (issue #244)', async () => {
      sessionId = await createSession('python', 'py-default-break-on-exceptions');

      const startRes = parseSdkToolResult(await mcpClient!.callTool({
        name: 'start_debugging',
        arguments: {
          sessionId,
          scriptPath: CRASHING_SCRIPT,
          dapLaunchArgs: { stopOnEntry: false }
        }
      }));
      expect(startRes.success).toBe(true);

      const paused = await pollUntil(async () => {
        const snap = await getSessionSnapshot(mcpClient!, sessionId!);
        return snap?.state === 'paused' && snap.lastStop?.reason === 'exception' ? snap : undefined;
      }, 15000);
      expect(paused, 'launch default uncaught should pause at the crash site').toBeDefined();
      const detail = `${paused!.lastStop!.description ?? ''} ${paused!.lastStop!.text ?? ''}`;
      expect(detail).toMatch(/ZeroDivisionError|division/i);

      // Continue: debugpy re-raises and the session terminates
      await callToolSafely(mcpClient!, 'continue_execution', { sessionId });
      const stopped = await pollUntil(async () => {
        const snap = await getSessionSnapshot(mcpClient!, sessionId!);
        return snap?.state === 'stopped' ? snap : undefined;
      }, 15000);
      expect(stopped, 'session should terminate after continuing past the exception').toBeDefined();
    }, 60000);

    it("terminates without pausing with explicit breakOnExceptions 'none' (opt-out, issues #220/#244)", async () => {
      sessionId = await createSession('python', 'py-no-break-on-exceptions');

      const startRes = parseSdkToolResult(await mcpClient!.callTool({
        name: 'start_debugging',
        arguments: {
          sessionId,
          scriptPath: CRASHING_SCRIPT,
          dapLaunchArgs: { stopOnEntry: false },
          breakOnExceptions: 'none'
        }
      }));
      expect(startRes.success).toBe(true);

      const stopped = await pollUntil(async () => {
        const snap = await getSessionSnapshot(mcpClient!, sessionId!);
        return snap?.state === 'stopped' ? snap : undefined;
      }, 15000);
      expect(stopped, 'session should terminate (opt-out preserves pre-#220 behavior)').toBeDefined();
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

    it('pauses at the uncaught Error by default when breakOnExceptions is not set (issue #244)', async () => {
      sessionId = await createSession('javascript', 'js-default-break-on-exceptions');

      const startRes = parseSdkToolResult(await mcpClient!.callTool({
        name: 'start_debugging',
        arguments: {
          sessionId,
          scriptPath: JS_CRASHING_SCRIPT,
          dapLaunchArgs: { stopOnEntry: false }
        }
      }));
      expect(startRes.success).toBe(true);

      const paused = await pollUntil(async () => {
        const snap = await getSessionSnapshot(mcpClient!, sessionId!);
        return snap?.state === 'paused' && snap.lastStop?.reason === 'exception' ? snap : undefined;
      }, 20000);
      expect(paused, 'launch default uncaught should pause the js session at the exception').toBeDefined();
    }, 60000);

    // Regression guard for issue #242: launching a fast-crashing js script
    // that terminates (now via explicit opt-out) must not hang
    // start_debugging (the js-debug launch barrier used to be disposed
    // unsettled when the debuggee died mid-launch).
    it("terminates without pausing with explicit breakOnExceptions 'none' (opt-out; regression guard, issue #242)", async () => {
      sessionId = await createSession('javascript', 'js-no-break-on-exceptions');

      const startRes = parseSdkToolResult(await mcpClient!.callTool({
        name: 'start_debugging',
        arguments: {
          sessionId,
          scriptPath: JS_CRASHING_SCRIPT,
          dapLaunchArgs: { stopOnEntry: false },
          breakOnExceptions: 'none'
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
      // Crash vs clean exit is distinguishable (issue #247): the exit-code
      // shim records the debuggee's code and the worker replays it, matching
      // the contract the python twin asserts above
      expect(stopped!.exitCode).toBeDefined();
      expect(stopped!.exitCode).not.toBe(0);
    }, 60000);

    it('reports exit code 0 for a clean run (issue #247)', async () => {
      sessionId = await createSession('javascript', 'js-clean-exit-code');

      const startRes = parseSdkToolResult(await mcpClient!.callTool({
        name: 'start_debugging',
        arguments: {
          sessionId,
          scriptPath: JS_CLEAN_SCRIPT,
          dapLaunchArgs: { stopOnEntry: false }
        }
      }));
      expect(startRes.success).toBe(true);

      const stopped = await pollUntil(async () => {
        const snap = await getSessionSnapshot(mcpClient!, sessionId!);
        return snap?.state === 'stopped' ? snap : undefined;
      }, 20000);
      expect(stopped, 'js session should run to completion').toBeDefined();
      expect(stopped!.exitCode).toBe(0);
    }, 60000);
  });

  describe('Java launch (JDI bridge) @requires-java', () => {
    function hasJdk(): boolean {
      try {
        execSync('java -version', { stdio: 'ignore' });
        execSync('javac -version', { stdio: 'ignore' });
        return true;
      } catch {
        console.log('[break-on-exceptions] Skipping — JDK not installed');
        return false;
      }
    }

    /** Poll until paused at an exception or terminated; undefined on timeout. */
    async function pollExceptionPauseOrExit(): Promise<SessionSnapshot | undefined> {
      return pollUntil(async () => {
        const snap = await getSessionSnapshot(mcpClient!, sessionId!);
        if (!snap) return undefined;
        if (snap.state === 'stopped') return snap;
        return snap.state === 'paused' && snap.lastStop?.reason === 'exception' ? snap : undefined;
      }, 15000);
    }

    it('pauses at the uncaught RuntimeException with exceptionInfo enrichment (issue #259)', async () => {
      if (!hasJdk()) return;
      const { sourcePath, classDir, mainClass } = prepareJavaExample('ThrowsTest');

      sessionId = await createSession('java', 'java-break-on-exceptions');

      const startRes = parseSdkToolResult(await mcpClient!.callTool({
        name: 'start_debugging',
        arguments: {
          sessionId,
          scriptPath: sourcePath,
          dapLaunchArgs: { mainClass, classpath: classDir, cwd: classDir, stopOnEntry: false },
          breakOnExceptions: 'uncaught'
        }
      }));
      expect(startRes.success).toBe(true);

      const paused = await pollUntil(async () => {
        const snap = await getSessionSnapshot(mcpClient!, sessionId!);
        return snap?.state === 'paused' && snap.lastStop?.reason === 'exception' ? snap : undefined;
      }, 15000);
      expect(paused, 'session should pause at the uncaught exception instead of terminating').toBeDefined();
      expect(paused!.lastStop!.text).toBe('java.lang.RuntimeException');
      expect(paused!.lastStop!.description).toMatch(/java\.lang\.RuntimeException: uncaught on purpose/);

      // Enrichment proves both halves of #259: the bridge advertised
      // supportsExceptionInfoRequest (SessionManager's live gate) AND answered
      // the exceptionInfo request.
      const enriched = await pollUntil(async () => {
        const snap = await getSessionSnapshot(mcpClient!, sessionId!);
        return snap?.lastStop?.exceptionInfo ? snap : undefined;
      }, 5000);
      expect(enriched, 'lastStop should gain exceptionInfo from the JDI bridge').toBeDefined();
      const info = enriched!.lastStop!.exceptionInfo!;
      expect(info.exceptionId).toBe('java.lang.RuntimeException');
      expect(info.breakMode).toBe('unhandled');
      expect(info.details?.message).toBe('uncaught on purpose');
      expect(info.details?.fullTypeName).toBe('java.lang.RuntimeException');
      expect(info.details?.stackTrace).toContain('at ThrowsTest.main');

      // Stack trace: top frame at the throw site in main
      const stack = parseSdkToolResult(await mcpClient!.callTool({
        name: 'get_stack_trace',
        arguments: { sessionId }
      }));
      expect(stack.stopReason).toBe('exception');
      const frames = stack.stackFrames as Array<{ name: string; line: number }>;
      expect(frames.length).toBeGreaterThan(0);
      expect(frames[0].name).toContain('main');

      // Continue: the JVM re-throws and terminates. The bridge emits
      // terminated without an exited event, so no exitCode assertion.
      await callToolSafely(mcpClient!, 'continue_execution', { sessionId });
      const stopped = await pollUntil(async () => {
        const snap = await getSessionSnapshot(mcpClient!, sessionId!);
        return snap?.state === 'stopped' ? snap : undefined;
      }, 15000);
      expect(stopped, 'session should terminate after continuing past the exception').toBeDefined();
    }, 60000);

    it("pauses at the caught IllegalStateException with breakMode 'always' when breakOnExceptions is 'all'", async () => {
      if (!hasJdk()) return;
      const { sourcePath, classDir, mainClass } = prepareJavaExample('ThrowsTest');

      sessionId = await createSession('java', 'java-break-on-caught');

      const startRes = parseSdkToolResult(await mcpClient!.callTool({
        name: 'start_debugging',
        arguments: {
          sessionId,
          scriptPath: sourcePath,
          dapLaunchArgs: { mainClass, classpath: classDir, cwd: classDir, stopOnEntry: false },
          breakOnExceptions: 'all'
        }
      }));
      expect(startRes.success).toBe(true);

      // The unfiltered caught-exception request can also fire on JDK-internal
      // exceptions during startup — continue past those (bounded) until the
      // fixture's IllegalStateException.
      let target: SessionSnapshot | undefined;
      for (let i = 0; i < 15; i++) {
        const snap = await pollExceptionPauseOrExit();
        if (!snap || snap.state === 'stopped') break;
        if (snap.lastStop?.text === 'java.lang.IllegalStateException') {
          target = snap;
          break;
        }
        await callToolSafely(mcpClient!, 'continue_execution', { sessionId: sessionId! });
      }
      expect(target, 'session should pause at the caught IllegalStateException').toBeDefined();
      expect(target!.lastStop!.description).toMatch(/java\.lang\.IllegalStateException: caught on purpose/);

      const enriched = await pollUntil(async () => {
        const snap = await getSessionSnapshot(mcpClient!, sessionId!);
        return snap?.lastStop?.exceptionInfo ? snap : undefined;
      }, 5000);
      expect(enriched, 'caught stop should gain exceptionInfo').toBeDefined();
      expect(enriched!.lastStop!.exceptionInfo!.exceptionId).toBe('java.lang.IllegalStateException');
      expect(enriched!.lastStop!.exceptionInfo!.breakMode).toBe('always');

      // Continue on: expect the uncaught RuntimeException stop on the way out
      // (internal caught stops may intervene), then termination.
      let sawUncaught = false;
      let finalSnap: SessionSnapshot | undefined;
      for (let i = 0; i < 15; i++) {
        await callToolSafely(mcpClient!, 'continue_execution', { sessionId: sessionId! });
        const snap = await pollExceptionPauseOrExit();
        if (!snap) break;
        if (snap.state === 'stopped') {
          finalSnap = snap;
          break;
        }
        if (snap.lastStop?.text === 'java.lang.RuntimeException') sawUncaught = true;
      }
      expect(sawUncaught, 'should pause at the uncaught RuntimeException on the way out').toBe(true);
      expect(finalSnap?.state, 'session should terminate').toBe('stopped');
    }, 90000);
  });

  describe('Rust launch (CodeLLDB) @requires-rust', () => {
    function hasRustToolchain(): boolean {
      try {
        execSync('rustc --version', { stdio: 'ignore' });
        return true;
      } catch {
        console.log('[break-on-exceptions] Skipping — Rust toolchain not installed');
        return false;
      }
    }

    // CodeLLDB implements the rust_panic filter as an internal breakpoint and
    // reports the panic stop as reason 'breakpoint'; RustAdapterPolicy
    // normalizes it to 'exception' via hitBreakpointIds (issue #260). The
    // stopped body carries no exception text, so the panic message is
    // asserted from the captured output instead of lastStop.description.
    it('pauses at a panic with reason exception by default and exits 101 after continue', async (ctx) => {
      if (!hasRustToolchain()) return;
      const { binaryPath } = await prepareRustExample('panic_example');

      sessionId = await createSession('rust', 'rust-panic-default');

      const startRes = parseSdkToolResult(await mcpClient!.callTool({
        name: 'start_debugging',
        arguments: {
          sessionId,
          scriptPath: binaryPath,
          dapLaunchArgs: { stopOnEntry: false },
          adapterLaunchConfig: { sourceLanguages: ['rust'] }
        }
      }));
      skipIfSpawnBlocked(ctx, startRes, 'Rust');
      expect(startRes.success).toBe(true);

      const paused = await pollUntil(async () => {
        const snap = await getSessionSnapshot(mcpClient!, sessionId!);
        return snap?.state === 'paused' && snap.lastStop?.reason === 'exception' ? snap : undefined;
      }, 30000);
      expect(paused, 'session should pause at the panic with reason exception').toBeDefined();

      // The panic site must be visible in the stack (frames above are std
      // panicking machinery).
      const stack = parseSdkToolResult(await mcpClient!.callTool({
        name: 'get_stack_trace',
        arguments: { sessionId }
      }));
      expect(stack.stopReason).toBe('exception');
      const frames = stack.stackFrames as Array<{ name: string; file?: string; line?: number }>;
      const panicFrame = frames.find(f => f.file?.replace(/\\/g, '/').endsWith('panic_example/src/main.rs'));
      expect(panicFrame, 'stack should contain the panic_example source frame').toBeDefined();

      // Panic message arrives on stderr before the rust_panic stop
      const output = await pollUntil(async () => {
        const res = parseSdkToolResult(await mcpClient!.callTool({
          name: 'get_output',
          arguments: { sessionId }
        }));
        const entries = (res.entries ?? []) as Array<{ category?: string; output?: string }>;
        const text = entries.map(e => e.output ?? '').join('');
        return /intentional panic for mcp-debugger tests/.test(text) ? text : undefined;
      }, 10000);
      expect(output, 'captured output should contain the panic message').toBeDefined();
      expect(output!).toMatch(/panicked at/);

      // Continue past the panic: clean termination with the panic exit code
      // (verified live on Windows/GNU — no issue #255 interplay here).
      await callToolSafely(mcpClient!, 'continue_execution', { sessionId });
      const stopped = await pollUntil(async () => {
        const snap = await getSessionSnapshot(mcpClient!, sessionId!);
        return snap?.state === 'stopped' ? snap : undefined;
      }, 20000);
      expect(stopped, 'session should terminate after continuing past the panic').toBeDefined();
      expect(stopped!.exitCode).toBe(101);
    }, 120000);

    it("pauses at the panic when breakOnExceptions is explicitly 'uncaught'", async (ctx) => {
      if (!hasRustToolchain()) return;
      const { binaryPath } = await prepareRustExample('panic_example');

      sessionId = await createSession('rust', 'rust-panic-uncaught');

      const startRes = parseSdkToolResult(await mcpClient!.callTool({
        name: 'start_debugging',
        arguments: {
          sessionId,
          scriptPath: binaryPath,
          dapLaunchArgs: { stopOnEntry: false },
          adapterLaunchConfig: { sourceLanguages: ['rust'] },
          breakOnExceptions: 'uncaught'
        }
      }));
      skipIfSpawnBlocked(ctx, startRes, 'Rust');
      expect(startRes.success).toBe(true);

      const paused = await pollUntil(async () => {
        const snap = await getSessionSnapshot(mcpClient!, sessionId!);
        return snap?.state === 'paused' && snap.lastStop?.reason === 'exception' ? snap : undefined;
      }, 30000);
      expect(paused, 'session should pause at the panic with reason exception').toBeDefined();
    }, 60000);

    it("runs the panicking program to termination when breakOnExceptions is 'none'", async (ctx) => {
      if (!hasRustToolchain()) return;
      const { binaryPath } = await prepareRustExample('panic_example');

      sessionId = await createSession('rust', 'rust-panic-none');

      const startRes = parseSdkToolResult(await mcpClient!.callTool({
        name: 'start_debugging',
        arguments: {
          sessionId,
          scriptPath: binaryPath,
          dapLaunchArgs: { stopOnEntry: false },
          adapterLaunchConfig: { sourceLanguages: ['rust'] },
          breakOnExceptions: 'none'
        }
      }));
      skipIfSpawnBlocked(ctx, startRes, 'Rust');
      expect(startRes.success).toBe(true);

      const stopped = await pollUntil(async () => {
        const snap = await getSessionSnapshot(mcpClient!, sessionId!);
        return snap?.state === 'stopped' ? snap : undefined;
      }, 30000);
      expect(stopped, 'panicking program should run to termination').toBeDefined();
      expect(stopped!.exitCode).toBe(101);
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
