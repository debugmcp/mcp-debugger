/**
 * Java Hot-Reload (redefine_classes) Smoke Test via MCP Interface
 *
 * Tests the redefine_classes tool by:
 * 1. Compiling RedefineTarget.java (getValue() returns 42)
 * 2. Starting a JVM with JDWP, attaching the debugger
 * 3. Hitting a breakpoint, verifying getValue() == 42
 * 4. Recompiling with RedefineTargetV2 (getValue() returns 99)
 * 5. Calling redefine_classes to hot-swap the class
 * 6. Continuing, hitting second breakpoint, verifying getValue() == 99
 *
 * Prerequisites: JDK installed (java + javac on PATH)
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

describe('Java Hot-Reload (redefine_classes) Smoke Test @requires-java', () => {
  let mcpClient: Client | null = null;
  let transport: StdioClientTransport | null = null;
  let sessionId: string | null = null;
  let jvmProcess: ChildProcess | null = null;

  const testJavaDir = path.resolve(ROOT, 'examples', 'java');
  const mainFile = path.resolve(testJavaDir, 'RedefineTarget.java');
  const v2File = path.resolve(testJavaDir, 'RedefineTargetV2.java');

  beforeAll(async () => {
    transport = new StdioClientTransport({
      command: process.execPath,
      args: [path.join(ROOT, 'dist', 'index.js'), '--log-level', 'info'],
      env: { ...process.env, NODE_ENV: 'test' }
    });

    mcpClient = new Client(
      { name: 'java-redefine-test', version: '1.0.0' },
      { capabilities: {} }
    );

    await mcpClient.connect(transport);
  }, 30000);

  afterAll(async () => {
    if (sessionId && mcpClient) {
      try { await callToolSafely(mcpClient, 'close_debug_session', { sessionId }); } catch { /* */ }
    }
    if (mcpClient) await mcpClient.close();
    if (transport) await transport.close();
    if (jvmProcess && !jvmProcess.killed) jvmProcess.kill('SIGKILL');
  });

  afterEach(async () => {
    if (sessionId && mcpClient) {
      try { await callToolSafely(mcpClient, 'close_debug_session', { sessionId }); } catch { /* */ }
      sessionId = null;
    }
    if (jvmProcess && !jvmProcess.killed) {
      jvmProcess.kill('SIGKILL');
      jvmProcess = null;
    }
  });

  it('should hot-swap a class and observe changed behavior via redefine_classes', async () => {
    // Check JDK availability
    try {
      execSync('java -version', { stdio: 'ignore' });
      execSync('javac -version', { stdio: 'ignore' });
    } catch {
      console.log('[Redefine] Skipping — JDK not installed');
      return;
    }

    // Compile original version (getValue() returns 42)
    execSync(`javac -g -d "${testJavaDir}" "${mainFile}"`, {
      cwd: testJavaDir,
      stdio: 'pipe'
    });
    console.log('[Redefine] Compiled RedefineTarget.java (getValue=42)');

    try {
      // Start JVM with JDWP
      const jdwpPort = await getFreePort();
      console.log(`[Redefine] Using JDWP port: ${jdwpPort}`);

      jvmProcess = spawn('java', [
        `-agentlib:jdwp=transport=dt_socket,server=y,address=${jdwpPort},suspend=y`,
        '-cp', testJavaDir,
        'RedefineTarget'
      ], {
        cwd: testJavaDir,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      // Wait for JDWP ready
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

      console.log('[Redefine] JVM is waiting for debugger');

      // 1. Create session
      const createResult = parseSdkToolResult(await mcpClient!.callTool({
        name: 'create_debug_session',
        arguments: { language: 'java', name: 'java-redefine' }
      }));
      expect(createResult.sessionId).toBeDefined();
      sessionId = createResult.sessionId as string;

      // 2. Set breakpoint on line 19 (first getValue() call)
      console.log('[Redefine] Setting breakpoint on line 19...');
      const bp1 = parseSdkToolResult(await mcpClient!.callTool({
        name: 'set_breakpoint',
        arguments: { sessionId, file: mainFile, line: 19 }
      }));
      expect(bp1.success).toBe(true);

      // 3. Attach to JVM
      console.log(`[Redefine] Attaching to JVM on port ${jdwpPort}...`);
      const attachResult = parseSdkToolResult(await mcpClient!.callTool({
        name: 'attach_to_process',
        arguments: {
          sessionId,
          port: jdwpPort,
          host: '127.0.0.1',
          sourcePaths: [testJavaDir]
        }
      }));
      expect(attachResult.success).toBe(true);

      // 4. Continue past initial suspend
      console.log('[Redefine] Continuing past initial suspend...');
      const cont1 = parseSdkToolResult(await mcpClient!.callTool({
        name: 'continue_execution',
        arguments: { sessionId }
      }));
      expect(cont1.success).toBe(true);

      // 5. Wait for breakpoint at line 19
      console.log('[Redefine] Waiting for breakpoint at line 19...');
      const stack1 = await waitForPausedState(mcpClient!, sessionId, 30, 500);
      expect(stack1).not.toBeNull();
      console.log('[Redefine] Hit breakpoint at line', stack1!.stackFrames![0].line);

      // 6. Evaluate getValue() BEFORE hot-reload — should return 42
      console.log('[Redefine] Evaluating getValue() before hot-reload...');
      const eval1 = parseSdkToolResult(await mcpClient!.callTool({
        name: 'evaluate_expression',
        arguments: { sessionId, expression: 'getValue()' }
      }));
      expect(eval1.success).toBe(true);
      expect(eval1.result).toBe('42');
      console.log('[Redefine] getValue() = 42 (original) ✓');

      // 7. Recompile with V2 (getValue() returns 99)
      //    Copy V2 content over the original file, compile, then restore
      const originalContent = fs.readFileSync(mainFile, 'utf-8');
      const v2Content = fs.readFileSync(v2File, 'utf-8');
      fs.writeFileSync(mainFile, v2Content);
      try {
        execSync(`javac -g -d "${testJavaDir}" "${mainFile}"`, {
          cwd: testJavaDir,
          stdio: 'pipe'
        });
        console.log('[Redefine] Recompiled with V2 (getValue=99)');
      } finally {
        // Restore original source immediately
        fs.writeFileSync(mainFile, originalContent);
      }

      // 8. Call redefine_classes — still paused at line 19
      console.log('[Redefine] Calling redefine_classes...');
      const redefineResult = parseSdkToolResult(await mcpClient!.callTool({
        name: 'redefine_classes',
        arguments: {
          sessionId,
          classesDir: testJavaDir,
          sinceTimestamp: 0
        }
      }));
      console.log('[Redefine] Result:', JSON.stringify(redefineResult));
      expect(redefineResult.success).toBe(true);
      expect(redefineResult.redefinedCount).toBeGreaterThanOrEqual(1);

      // Verify RedefineTarget is in the redefined list
      const redefined = redefineResult.redefined as string[];
      expect(redefined.some((name: string) => name.includes('RedefineTarget'))).toBe(true);
      console.log('[Redefine] Hot-swap succeeded:', redefined);

      // 9. Evaluate getValue() AFTER hot-reload — should now return 99
      //    Still paused at the same breakpoint, but the method bytecode has changed
      console.log('[Redefine] Evaluating getValue() after hot-reload...');
      const eval2 = parseSdkToolResult(await mcpClient!.callTool({
        name: 'evaluate_expression',
        arguments: { sessionId, expression: 'getValue()' }
      }));
      expect(eval2.success).toBe(true);
      expect(eval2.result).toBe('99');
      console.log('[Redefine] getValue() = 99 (hot-reloaded) ✓');

      // 10. Continue to finish
      const cont2 = parseSdkToolResult(await mcpClient!.callTool({
        name: 'continue_execution',
        arguments: { sessionId }
      }));
      expect(cont2.success).toBe(true);

      console.log('[Redefine] TEST PASSED — hot-reload changed getValue() from 42 to 99');

    } finally {
      // Cleanup compiled classes
      for (const cls of ['RedefineTarget.class']) {
        try {
          const f = path.resolve(testJavaDir, cls);
          if (fs.existsSync(f)) fs.unlinkSync(f);
        } catch { /* ignore */ }
      }

      if (jvmProcess && !jvmProcess.killed) {
        jvmProcess.kill('SIGKILL');
        jvmProcess = null;
      }
    }
  }, 90000);
});
