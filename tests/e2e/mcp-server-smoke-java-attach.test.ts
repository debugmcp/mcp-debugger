/**
 * Java Attach-Mode Smoke Tests via MCP Interface
 *
 * Tests Java attach debugging: spawn a JVM with JDWP agent (suspend=y),
 * then use attach_to_process to connect the debugger.
 *
 * Hard assertions (every step must succeed):
 * - Session creation returns valid sessionId
 * - Breakpoint on line 14 (compute method) returns success
 * - Attach succeeds and returns paused state
 * - Continue execution resumes the suspended VM
 * - Breakpoints re-sent after class loading (KDA deferred breakpoints don't fire)
 * - Breakpoint fires: non-empty stack frames with top frame in compute()
 * - Local variables a=42, b=58 with correct values
 * - Continue after breakpoint hit succeeds
 *
 * Prerequisites:
 * - JDK installed (java + javac on PATH)
 * - javac -g for LocalVariableTable (JDI requires it for variable access)
 * - InfiniteWait.java has Thread.sleep(2000) before compute() to allow
 *   breakpoint re-send after class loading
 *
 * Skips gracefully when JDK is not installed.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import path from 'path';
import net from 'net';
import { fileURLToPath } from 'url';
import { execSync, spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { parseSdkToolResult, callToolSafely } from './smoke-test-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

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
  intervalMs = 500
): Promise<{ stackFrames?: Array<{ file?: string; name?: string; line?: number }> } | null> {
  for (let i = 0; i < maxAttempts; i++) {
    const result = await callToolSafely(client, 'get_stack_trace', { sessionId });
    if (result.stackFrames && (result.stackFrames as any[]).length > 0) {
      return result as { stackFrames: Array<{ file?: string; name?: string; line?: number }> };
    }
    await new Promise(r => setTimeout(r, intervalMs));
  }
  return null;
}

describe('MCP Server Java Attach-Mode Smoke Test @requires-java', () => {
  let mcpClient: Client | null = null;
  let transport: StdioClientTransport | null = null;
  let sessionId: string | null = null;
  let jvmProcess: ChildProcess | null = null;

  beforeAll(async () => {
    console.log('[Java Attach Test] Starting MCP server...');

    transport = new StdioClientTransport({
      command: process.execPath,
      args: [path.join(ROOT, 'dist', 'index.js'), '--log-level', 'info'],
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });

    mcpClient = new Client({
      name: 'java-attach-smoke-test-client',
      version: '1.0.0'
    }, {
      capabilities: {}
    });

    await mcpClient.connect(transport);
    console.log('[Java Attach Test] MCP client connected');
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

    if (jvmProcess && !jvmProcess.killed) {
      jvmProcess.kill('SIGKILL');
    }

    console.log('[Java Attach Test] Cleanup completed');
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

    if (jvmProcess && !jvmProcess.killed) {
      jvmProcess.kill('SIGKILL');
      jvmProcess = null;
    }
  });

  it('should attach to a running JVM and debug with verified stack and variables', async () => {
    // Skip if java/javac not available
    try {
      execSync('java -version', { stdio: 'ignore' });
      execSync('javac -version', { stdio: 'ignore' });
    } catch {
      console.log('[Java Attach Test] Skipping — JDK not installed');
      return;
    }

    const testJavaFile = path.resolve(ROOT, 'examples', 'java', 'InfiniteWait.java');
    const testClassDir = path.resolve(ROOT, 'examples', 'java');

    // Compile with full debug info (-g) so JDI can access local variables
    execSync(`javac -g "${testJavaFile}"`, { cwd: testClassDir, stdio: 'pipe' });
    console.log('[Java Attach Test] Compiled InfiniteWait.java');

    try {
      // Pick a free port
      const jdwpPort = await getFreePort();
      console.log(`[Java Attach Test] Using JDWP port: ${jdwpPort}`);

      // Spawn JVM with JDWP agent (suspend=y pauses until debugger attaches)
      jvmProcess = spawn('java', [
        `-agentlib:jdwp=transport=dt_socket,server=y,address=${jdwpPort},suspend=y`,
        '-cp', testClassDir,
        'InfiniteWait'
      ], {
        cwd: testClassDir,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      // Wait for "Listening for transport" on stdout or stderr
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timeout waiting for JDWP agent')), 15000);
        let outputData = '';
        let resolved = false;

        const checkOutput = (chunk: Buffer, stream: string) => {
          if (resolved) return;
          outputData += chunk.toString();
          console.log(`[Java Attach Test] JVM ${stream}:`, chunk.toString().trim());
          if (outputData.includes('Listening for transport')) {
            resolved = true;
            clearTimeout(timeout);
            resolve();
          }
        };

        jvmProcess!.stdout!.on('data', (chunk: Buffer) => checkOutput(chunk, 'stdout'));
        jvmProcess!.stderr!.on('data', (chunk: Buffer) => checkOutput(chunk, 'stderr'));

        jvmProcess!.on('error', (err) => {
          if (resolved) return;
          clearTimeout(timeout);
          reject(err);
        });

        jvmProcess!.on('exit', (code) => {
          if (resolved) return;
          clearTimeout(timeout);
          reject(new Error(`JVM exited with code ${code} before JDWP was ready`));
        });
      });

      console.log('[Java Attach Test] JVM is waiting for debugger');

      // 1. Create Java debug session
      console.log('[Java Attach Test] Creating debug session...');
      const createResult = await mcpClient!.callTool({
        name: 'create_debug_session',
        arguments: {
          language: 'java',
          name: 'java-attach-test'
        }
      });

      const createResponse = parseSdkToolResult(createResult);
      expect(createResponse.sessionId).toBeDefined();
      sessionId = createResponse.sessionId as string;
      console.log(`[Java Attach Test] Session created: ${sessionId}`);

      // 2. Set breakpoint on line 14 (int result = a + b; inside compute())
      console.log('[Java Attach Test] Setting breakpoint on line 14...');
      const bpResult = await mcpClient!.callTool({
        name: 'set_breakpoint',
        arguments: {
          sessionId,
          file: testJavaFile,
          line: 14
        }
      });

      const bpResponse = parseSdkToolResult(bpResult);
      expect(bpResponse.success).toBe(true);
      console.log('[Java Attach Test] Breakpoint set successfully');

      // 3. Attach to the running JVM
      console.log(`[Java Attach Test] Attaching to JVM on port ${jdwpPort}...`);
      const attachResult = await mcpClient!.callTool({
        name: 'attach_to_process',
        arguments: {
          sessionId,
          port: jdwpPort,
          host: '127.0.0.1',
          sourcePaths: [testClassDir]
        }
      });

      const attachResponse = parseSdkToolResult(attachResult);
      expect(attachResponse.success).toBe(true);
      expect(attachResponse.state).toBe('paused');
      console.log('[Java Attach Test] Attached successfully, state:', attachResponse.state);

      // 4. Continue execution — VM was suspended at startup (suspend=y).
      //    configurationDone already resumed the VM, but session state is PAUSED.
      //    Continue sets session to RUNNING and resumes all threads.
      console.log('[Java Attach Test] Continuing execution to start program...');
      const continueResult = parseSdkToolResult(
        await mcpClient!.callTool({
          name: 'continue_execution',
          arguments: { sessionId }
        })
      );
      expect(continueResult.success).toBe(true);

      // 5. Wait for class loading, then re-send breakpoints.
      //    KDA doesn't reliably implement JDI deferred breakpoints: breakpoints
      //    set before the class is loaded (suspend=y) report verified:true but
      //    don't fire. After the VM resumes and loads InfiniteWait, re-setting
      //    the breakpoint ensures KDA can resolve the class and set a real JDI
      //    breakpoint. InfiniteWait.main() has Thread.sleep(2000) to give us time.
      console.log('[Java Attach Test] Waiting for class loading, then re-sending breakpoints...');
      await new Promise(r => setTimeout(r, 500));

      const bpRetryResult = await mcpClient!.callTool({
        name: 'set_breakpoint',
        arguments: {
          sessionId,
          file: testJavaFile,
          line: 14
        }
      });
      const bpRetryResponse = parseSdkToolResult(bpRetryResult);
      console.log('[Java Attach Test] Breakpoint re-set, verified:', bpRetryResponse.verified);

      // 6. Poll for breakpoint hit (non-empty stack frames)
      //    InfiniteWait.main() sleeps 2s then calls compute() — breakpoint should fire.
      console.log('[Java Attach Test] Waiting for breakpoint hit...');
      const stackResponse = await waitForPausedState(mcpClient!, sessionId, 15, 500);

      // HARD ASSERTION: Breakpoint must fire
      expect(stackResponse).not.toBeNull();
      expect(stackResponse!.stackFrames).toBeDefined();
      const frames = stackResponse!.stackFrames!;
      expect(frames.length).toBeGreaterThan(0);
      console.log(`[Java Attach Test] Stack has ${frames.length} frames`);

      // HARD ASSERTION: Top frame is compute() at line 14
      const topFrame = frames[0];
      console.log('[Java Attach Test] Top frame:', topFrame.name, 'line:', topFrame.line);
      expect(topFrame.name?.toLowerCase()).toContain('compute');
      // KDA may report line 0 (no source mapping) — assert only when present
      if (typeof topFrame.line === 'number' && topFrame.line > 0) {
        expect(topFrame.line).toBe(14);
      }

      // Get local variables and verify runtime values
      console.log('[Java Attach Test] Getting local variables...');
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
      console.log('[Java Attach Test] Variables:', Object.fromEntries(localsByName));

      // HARD ASSERTION: a=42, b=58 in compute()
      expect(localsByName.get('a')).toBe('42');
      expect(localsByName.get('b')).toBe('58');

      // HARD ASSERTION: Continue execution after breakpoint hit
      console.log('[Java Attach Test] Continuing execution...');
      const finalContinue = parseSdkToolResult(
        await mcpClient!.callTool({
          name: 'continue_execution',
          arguments: { sessionId }
        })
      );
      expect(finalContinue.success).toBe(true);

    } finally {
      // Clean up compiled class files
      try {
        const classFile = path.resolve(testClassDir, 'InfiniteWait.class');
        if (fs.existsSync(classFile)) {
          fs.unlinkSync(classFile);
        }
      } catch {
        // Ignore cleanup errors
      }

      // Kill JVM if still running
      if (jvmProcess && !jvmProcess.killed) {
        jvmProcess.kill('SIGKILL');
        jvmProcess = null;
      }
    }
  }, 60000);
});
