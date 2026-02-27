/**
 * Java Attach-Mode Smoke Tests via MCP Interface
 *
 * Tests Java attach debugging: spawn a JVM with JDWP agent (suspend=y),
 * then use attach_to_process to connect the debugger.
 *
 * JDI bridge handles deferred breakpoints natively via ClassPrepareRequest,
 * so no breakpoint re-sends are needed (unlike KDA).
 *
 * Hard assertions (every step must succeed):
 * - Session creation returns valid sessionId
 * - Breakpoint on line 14 (compute method) returns success
 * - Attach succeeds and returns paused state
 * - Continue execution resumes the suspended VM
 * - Breakpoint fires: non-empty stack frames with top frame in compute()
 * - Local variables a=42, b=58 with correct values
 * - Continue after breakpoint hit succeeds
 *
 * Prerequisites:
 * - JDK installed (java + javac on PATH)
 * - javac -g for LocalVariableTable (JDI requires it for variable access)
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
      //    JDI bridge handles deferred breakpoints via ClassPrepareRequest,
      //    so no breakpoint re-sends needed.
      console.log('[Java Attach Test] Continuing execution to start program...');
      const continueResult = parseSdkToolResult(
        await mcpClient!.callTool({
          name: 'continue_execution',
          arguments: { sessionId }
        })
      );
      expect(continueResult.success).toBe(true);

      // 5. Poll for breakpoint hit (non-empty stack frames)
      //    InfiniteWait.main() sleeps 2s then calls compute() — breakpoint should fire.
      console.log('[Java Attach Test] Waiting for breakpoint hit...');
      const stackResponse = await waitForPausedState(mcpClient!, sessionId, 20, 500);

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

  it('should hit a breakpoint added while paused after attach', async () => {
    // Skip if java/javac not available
    try {
      execSync('java -version', { stdio: 'ignore' });
      execSync('javac -version', { stdio: 'ignore' });
    } catch {
      console.log('[Java Attach BP-While-Paused] Skipping — JDK not installed');
      return;
    }

    const testJavaFile = path.resolve(ROOT, 'examples', 'java', 'InfiniteWait.java');
    const testClassDir = path.resolve(ROOT, 'examples', 'java');

    // Compile with full debug info
    execSync(`javac -g "${testJavaFile}"`, { cwd: testClassDir, stdio: 'pipe' });

    try {
      // Pick a free port and spawn JVM with JDWP (suspend=y)
      const jdwpPort = await getFreePort();
      console.log(`[Attach BP-While-Paused] Using JDWP port: ${jdwpPort}`);

      jvmProcess = spawn('java', [
        `-agentlib:jdwp=transport=dt_socket,server=y,address=${jdwpPort},suspend=y`,
        '-cp', testClassDir,
        'InfiniteWait'
      ], {
        cwd: testClassDir,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      // Wait for JDWP agent to be ready
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timeout waiting for JDWP agent')), 15000);
        let outputData = '';
        let resolved = false;

        const checkOutput = (chunk: Buffer) => {
          if (resolved) return;
          outputData += chunk.toString();
          if (outputData.includes('Listening for transport')) {
            resolved = true;
            clearTimeout(timeout);
            resolve();
          }
        };

        jvmProcess!.stdout!.on('data', checkOutput);
        jvmProcess!.stderr!.on('data', checkOutput);
        jvmProcess!.on('error', (err) => { if (!resolved) { clearTimeout(timeout); reject(err); } });
        jvmProcess!.on('exit', (code) => { if (!resolved) { clearTimeout(timeout); reject(new Error(`JVM exited ${code}`)); } });
      });

      // 1. Create session
      const createResult = await mcpClient!.callTool({
        name: 'create_debug_session',
        arguments: { language: 'java', name: 'java-attach-bp-paused' }
      });
      const createResponse = parseSdkToolResult(createResult);
      expect(createResponse.sessionId).toBeDefined();
      sessionId = createResponse.sessionId as string;

      // 2. Set FIRST breakpoint on line 14 (compute: int result = a + b)
      console.log('[Attach BP-While-Paused] Setting first breakpoint on line 14 (compute)...');
      const bp1Result = parseSdkToolResult(await mcpClient!.callTool({
        name: 'set_breakpoint',
        arguments: { sessionId, file: testJavaFile, line: 14 }
      }));
      expect(bp1Result.success).toBe(true);

      // 3. Attach to JVM
      console.log(`[Attach BP-While-Paused] Attaching to JVM on port ${jdwpPort}...`);
      const attachResult = parseSdkToolResult(await mcpClient!.callTool({
        name: 'attach_to_process',
        arguments: { sessionId, port: jdwpPort, host: '127.0.0.1', sourcePaths: [testClassDir] }
      }));
      expect(attachResult.success).toBe(true);

      // 4. Continue (VM starts suspended with suspend=y)
      console.log('[Attach BP-While-Paused] Continuing to start program...');
      const cont1 = parseSdkToolResult(await mcpClient!.callTool({
        name: 'continue_execution',
        arguments: { sessionId }
      }));
      expect(cont1.success).toBe(true);

      // 5. Wait for FIRST breakpoint hit at compute():14
      console.log('[Attach BP-While-Paused] Waiting for first breakpoint (line 14)...');
      const stack1 = await waitForPausedState(mcpClient!, sessionId, 20, 500);
      expect(stack1).not.toBeNull();
      const frames1 = stack1!.stackFrames!;
      expect(frames1.length).toBeGreaterThan(0);
      expect(frames1[0].name?.toLowerCase()).toContain('compute');
      expect(frames1[0].line).toBe(14);
      console.log('[Attach BP-While-Paused] Hit first breakpoint at compute():14');

      // 6. While PAUSED, set SECOND breakpoint on line 19 (format: String text = ...)
      console.log('[Attach BP-While-Paused] Setting second breakpoint on line 19 (format) while paused...');
      const bp2Result = parseSdkToolResult(await mcpClient!.callTool({
        name: 'set_breakpoint',
        arguments: { sessionId, file: testJavaFile, line: 19 }
      }));
      expect(bp2Result.success).toBe(true);

      // 7. Continue — should finish compute(), then hit format() at line 19
      console.log('[Attach BP-While-Paused] Continuing to second breakpoint...');
      const cont2 = parseSdkToolResult(await mcpClient!.callTool({
        name: 'continue_execution',
        arguments: { sessionId }
      }));
      expect(cont2.success).toBe(true);

      // 8. Wait for SECOND breakpoint hit at format():19
      console.log('[Attach BP-While-Paused] Waiting for second breakpoint (line 19)...');
      const stack2 = await waitForPausedState(mcpClient!, sessionId, 20, 500);

      // HARD ASSERTION: Second breakpoint must fire
      expect(stack2).not.toBeNull();
      const frames2 = stack2!.stackFrames!;
      expect(frames2.length).toBeGreaterThan(0);
      expect(frames2[0].name?.toLowerCase()).toContain('format');
      expect(frames2[0].line).toBe(19);
      console.log('[Attach BP-While-Paused] Hit second breakpoint at format():19');

      // 9. Verify variables in format() — label="Sum", value=100
      const localsRaw = await mcpClient!.callTool({
        name: 'get_local_variables',
        arguments: { sessionId }
      });
      const localsResponse = parseSdkToolResult(localsRaw) as {
        success?: boolean;
        variables?: Array<{ name: string; value: string }>;
      };
      expect(localsResponse.success).toBe(true);
      const localsByName = new Map(
        (localsResponse.variables ?? []).map(v => [v.name, v.value])
      );
      console.log('[Attach BP-While-Paused] Variables:', Object.fromEntries(localsByName));
      expect(localsByName.get('label')).toBe('"Sum"');
      expect(localsByName.get('value')).toBe('100');

      // 10. Continue to finish
      const cont3 = parseSdkToolResult(await mcpClient!.callTool({
        name: 'continue_execution',
        arguments: { sessionId }
      }));
      expect(cont3.success).toBe(true);

      console.log('[Attach BP-While-Paused] TEST PASSED — breakpoint added while paused was hit');

    } finally {
      try {
        const classFile = path.resolve(testClassDir, 'InfiniteWait.class');
        if (fs.existsSync(classFile)) fs.unlinkSync(classFile);
      } catch { /* ignore */ }
      if (jvmProcess && !jvmProcess.killed) {
        jvmProcess.kill('SIGKILL');
        jvmProcess = null;
      }
    }
  }, 60000);
});
