/**
 * Python Attach-Mode Smoke Tests via MCP Interface
 *
 * Tests Python attach debugging (issue #145): start a script under
 * `python -m debugpy --listen host:port`, then use attach_to_process to
 * connect the debugger directly to the listening debugpy endpoint.
 *
 * This is the regression test for the attach handshake deadlock: debugpy
 * emits 'initialized' only after it receives the attach request, and only
 * responds to attach after configurationDone — attach succeeding at all
 * proves the attach-first ordering works.
 *
 * Hard assertions (every step must succeed):
 * - Session creation returns valid sessionId
 * - Breakpoint on line 7 (result = a + b inside compute()) returns success
 * - Attach succeeds and returns paused state (post-attach pause)
 * - Continue execution resumes the loop
 * - Breakpoint fires: non-empty stack frames with top frame in compute()
 * - Local variables a=42, b=58 with correct values
 * - Continue after breakpoint hit succeeds
 * - Closing the session detaches without killing the target
 *
 * Prerequisites:
 * - Python 3.7+ with debugpy installed (pip install debugpy)
 *
 * Skips gracefully when python/debugpy is not installed.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import path from 'path';
import net from 'net';
import { fileURLToPath } from 'url';
import { execSync, spawn, ChildProcess } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { parseSdkToolResult, callToolSafely } from './smoke-test-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

// Windows ships `python`; Linux/macOS use `python3`
const PYTHON_CMD = process.platform === 'win32' ? 'python' : 'python3';

/**
 * Find a free TCP port by briefly listening on port 0.
 */
function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      if (!addr || typeof addr === 'string') {
        srv.close(() => reject(new Error('Could not determine port')));
        return;
      }
      const port = addr.port;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

/**
 * Poll for non-empty stack frames (breakpoint hit).
 * Returns the stack response once frames appear, or null after exhausting attempts.
 */
async function waitForPausedState(
  client: Client,
  sessionId: string,
  maxAttempts = 20,
  intervalMs = 500,
  validate?: (frames: Array<{ file?: string; name?: string; line?: number }>) => boolean
): Promise<{ stackFrames?: Array<{ file?: string; name?: string; line?: number }> } | null> {
  for (let i = 0; i < maxAttempts; i++) {
    const result = await callToolSafely(client, 'get_stack_trace', { sessionId });
    if (result.stackFrames && (result.stackFrames as any[]).length > 0) {
      const frames = result.stackFrames as Array<{ file?: string; name?: string; line?: number }>;
      if (!validate || validate(frames)) {
        return result as { stackFrames: Array<{ file?: string; name?: string; line?: number }> };
      }
    }
    await new Promise(r => setTimeout(r, intervalMs));
  }
  return null;
}

describe('MCP Server Python Attach-Mode Smoke Test @requires-python', () => {
  let mcpClient: Client | null = null;
  let transport: StdioClientTransport | null = null;
  let sessionId: string | null = null;
  let pyProcess: ChildProcess | null = null;

  beforeAll(async () => {
    console.log('[Python Attach Test] Starting MCP server...');

    transport = new StdioClientTransport({
      command: process.execPath,
      args: [path.join(ROOT, 'dist', 'index.js'), '--log-level', 'info'],
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });

    mcpClient = new Client({
      name: 'python-attach-smoke-test-client',
      version: '1.0.0'
    }, {
      capabilities: {}
    });

    await mcpClient.connect(transport);
    console.log('[Python Attach Test] MCP client connected');
  }, 30000);

  afterAll(async () => {
    if (sessionId && mcpClient) {
      try {
        await callToolSafely(mcpClient, 'close_debug_session', { sessionId });
      } catch {
        // Session may already be closed
      }
    }

    if (mcpClient) {
      await mcpClient.close();
    }
    if (transport) {
      await transport.close();
    }

    if (pyProcess && !pyProcess.killed) {
      pyProcess.kill('SIGKILL');
    }

    console.log('[Python Attach Test] Cleanup completed');
  });

  afterEach(async () => {
    if (sessionId && mcpClient) {
      try {
        await callToolSafely(mcpClient, 'close_debug_session', { sessionId });
      } catch {
        // Session may already be closed
      }
      sessionId = null;
    }

    if (pyProcess && !pyProcess.killed) {
      pyProcess.kill('SIGKILL');
      pyProcess = null;
    }
  });

  it('should attach to a running debugpy target and debug with verified stack and variables', async () => {
    // Skip if python/debugpy not available
    try {
      execSync(`${PYTHON_CMD} -c "import debugpy"`, { stdio: 'ignore' });
    } catch {
      console.log('[Python Attach Test] Skipping — python/debugpy not installed');
      return;
    }

    const scriptPath = path.resolve(ROOT, 'examples', 'python', 'attach_loop.py');

    try {
      // Pick a free port for debugpy to listen on
      const debugPort = await getFreePort();
      console.log(`[Python Attach Test] Using debugpy port: ${debugPort}`);

      // Start the target under debugpy. debugpy sets up its listener before
      // running the script, so the READY marker implies the port is open.
      pyProcess = spawn(PYTHON_CMD, [
        '-m', 'debugpy',
        '--listen', `127.0.0.1:${debugPort}`,
        scriptPath
      ], {
        cwd: ROOT,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timeout waiting for debugpy target')), 15000);
        let outputData = '';
        let resolved = false;

        const checkOutput = (chunk: Buffer, stream: string) => {
          if (resolved) return;
          outputData += chunk.toString();
          console.log(`[Python Attach Test] target ${stream}:`, chunk.toString().trim());
          if (outputData.includes('ATTACH_LOOP_READY')) {
            resolved = true;
            clearTimeout(timeout);
            resolve();
          }
        };

        pyProcess!.stdout!.on('data', (chunk: Buffer) => checkOutput(chunk, 'stdout'));
        pyProcess!.stderr!.on('data', (chunk: Buffer) => checkOutput(chunk, 'stderr'));

        pyProcess!.on('error', (err) => {
          if (resolved) return;
          clearTimeout(timeout);
          reject(err);
        });

        pyProcess!.on('exit', (code) => {
          if (resolved) return;
          clearTimeout(timeout);
          reject(new Error(`Target exited with code ${code} before debugpy was ready`));
        });
      });

      console.log('[Python Attach Test] Target is running with debugpy listening');

      // 1. Create Python debug session
      console.log('[Python Attach Test] Creating debug session...');
      const createResult = await mcpClient!.callTool({
        name: 'create_debug_session',
        arguments: {
          language: 'python',
          name: 'python-attach-test'
        }
      });

      const createResponse = parseSdkToolResult(createResult);
      expect(createResponse.sessionId).toBeDefined();
      sessionId = createResponse.sessionId as string;
      console.log(`[Python Attach Test] Session created: ${sessionId}`);

      // 2. Set breakpoint on line 7 (result = a + b; inside compute())
      console.log('[Python Attach Test] Setting breakpoint on line 7...');
      const bpResult = await mcpClient!.callTool({
        name: 'set_breakpoint',
        arguments: {
          sessionId,
          file: scriptPath,
          line: 7
        }
      });

      const bpResponse = parseSdkToolResult(bpResult);
      expect(bpResponse.success).toBe(true);
      console.log('[Python Attach Test] Breakpoint set successfully');

      // 3. Attach to the running target. Success here is the regression test
      //    for the issue #145 handshake deadlock.
      console.log(`[Python Attach Test] Attaching to debugpy on port ${debugPort}...`);
      const attachResult = await mcpClient!.callTool({
        name: 'attach_to_process',
        arguments: {
          sessionId,
          host: '127.0.0.1',
          port: debugPort
        }
      });

      const attachResponse = parseSdkToolResult(attachResult);
      console.log('[Python Attach Test] attach response:', JSON.stringify(attachResponse));
      expect(attachResponse.success).toBe(true);
      expect(attachResponse.state).toBe('paused');
      console.log('[Python Attach Test] Attached successfully, state:', attachResponse.state);

      // 4. Continue execution — the post-attach pause left the target stopped.
      console.log('[Python Attach Test] Continuing execution...');
      const continueResult = parseSdkToolResult(
        await mcpClient!.callTool({
          name: 'continue_execution',
          arguments: { sessionId }
        })
      );
      expect(continueResult.success).toBe(true);

      // 5. Poll for breakpoint hit — the loop calls compute() every 500ms.
      console.log('[Python Attach Test] Waiting for breakpoint hit...');
      const stackResponse = await waitForPausedState(mcpClient!, sessionId, 20, 500,
        (frames) => frames[0]?.name?.toLowerCase().includes('compute') ?? false
      );

      // HARD ASSERTION: Breakpoint must fire
      expect(stackResponse).not.toBeNull();
      expect(stackResponse!.stackFrames).toBeDefined();
      const frames = stackResponse!.stackFrames!;
      expect(frames.length).toBeGreaterThan(0);
      console.log(`[Python Attach Test] Stack has ${frames.length} frames`);

      // HARD ASSERTION: Top frame is compute() at line 7
      const topFrame = frames[0];
      console.log('[Python Attach Test] Top frame:', topFrame.name, 'line:', topFrame.line);
      expect(topFrame.name?.toLowerCase()).toContain('compute');
      if (typeof topFrame.line === 'number' && topFrame.line > 0) {
        expect(topFrame.line).toBe(7);
      }

      // Get local variables and verify runtime values
      console.log('[Python Attach Test] Getting local variables...');
      const localsRaw = await mcpClient!.callTool({
        name: 'get_local_variables',
        arguments: { sessionId }
      });
      const localsResponse = parseSdkToolResult(localsRaw) as {
        success?: boolean;
        variables?: Array<{ name: string; value: string }>;
        count?: number;
      };

      expect(localsResponse.success).toBe(true);
      expect(Array.isArray(localsResponse.variables)).toBe(true);
      expect(localsResponse.variables!.length).toBeGreaterThan(0);

      const localsByName = new Map(
        (localsResponse.variables ?? []).map(v => [v.name, v.value])
      );
      console.log('[Python Attach Test] Variables:', Object.fromEntries(localsByName));

      // HARD ASSERTION: a=42, b=58 in compute()
      expect(localsByName.get('a')).toBe('42');
      expect(localsByName.get('b')).toBe('58');

      // HARD ASSERTION: Continue execution after breakpoint hit
      console.log('[Python Attach Test] Continuing execution...');
      const finalContinue = parseSdkToolResult(
        await mcpClient!.callTool({
          name: 'continue_execution',
          arguments: { sessionId }
        })
      );
      expect(finalContinue.success).toBe(true);

      // 6. Close the session — attach mode must detach without killing the
      //    target (terminateDebuggee=false).
      console.log('[Python Attach Test] Closing session (detach)...');
      await callToolSafely(mcpClient!, 'close_debug_session', { sessionId });
      sessionId = null;

      await new Promise(r => setTimeout(r, 1000));
      expect(pyProcess!.exitCode).toBeNull();
      console.log('[Python Attach Test] Target survived detach');

    } finally {
      // Kill target if still running
      if (pyProcess && !pyProcess.killed) {
        pyProcess.kill('SIGKILL');
        pyProcess = null;
      }
    }
  }, 60000);
});
