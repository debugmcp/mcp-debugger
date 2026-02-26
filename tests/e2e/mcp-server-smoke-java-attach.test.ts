/**
 * Java Attach-Mode Smoke Tests via MCP Interface
 *
 * Tests Java attach debugging: spawn a JVM with JDWP agent,
 * then use attach_to_process to connect the debugger.
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

  it('should attach to a running JVM and debug', async () => {
    // Skip if java/javac not available
    let javaAvailable = false;
    let javacAvailable = false;

    try {
      execSync('java -version', { stdio: 'ignore' });
      javaAvailable = true;
    } catch {
      console.log('[Java Attach Test] Java not available, skipping');
    }

    try {
      execSync('javac -version', { stdio: 'ignore' });
      javacAvailable = true;
    } catch {
      console.log('[Java Attach Test] javac not available, skipping');
    }

    if (!javaAvailable || !javacAvailable) {
      console.log('[Java Attach Test] Skipping — JDK not installed');
      return;
    }

    const testJavaFile = path.resolve(ROOT, 'examples', 'java', 'InfiniteWait.java');
    const testClassDir = path.resolve(ROOT, 'examples', 'java');

    // Compile
    try {
      execSync(`javac "${testJavaFile}"`, { cwd: testClassDir, stdio: 'pipe' });
      console.log('[Java Attach Test] Compiled InfiniteWait.java');
    } catch (error) {
      console.log('[Java Attach Test] Failed to compile, skipping');
      return;
    }

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
      // (JDK 21+ prints this to stdout, older JDKs use stderr)
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

      // 2. Set breakpoint on the compute() call line (line 22)
      console.log('[Java Attach Test] Setting breakpoint...');
      const bpResult = await mcpClient!.callTool({
        name: 'set_breakpoint',
        arguments: {
          sessionId,
          file: testJavaFile,
          line: 22
        }
      });

      const bpResponse = parseSdkToolResult(bpResult);
      console.log('[Java Attach Test] Breakpoint response:', bpResponse);

      // 3. Attach to the running JVM
      console.log(`[Java Attach Test] Attaching to JVM on port ${jdwpPort}...`);
      const attachResult = await mcpClient!.callTool({
        name: 'attach_to_process',
        arguments: {
          sessionId,
          port: jdwpPort,
          host: '127.0.0.1'
        }
      });

      const attachResponse = parseSdkToolResult(attachResult);
      expect(attachResponse.state).toBeDefined();
      console.log('[Java Attach Test] Attach response state:', attachResponse.state);

      // Wait for breakpoint hit — the JVM resumes from suspend=y once configurationDone is sent
      await new Promise(resolve => setTimeout(resolve, 3000));

      // 4. Get stack trace
      console.log('[Java Attach Test] Getting stack trace...');
      const stackResult = await callToolSafely(mcpClient!, 'get_stack_trace', { sessionId });

      if (stackResult.stackFrames) {
        const frames = stackResult.stackFrames as any[];
        console.log(`[Java Attach Test] Stack has ${frames.length} frames`);
        expect(frames.length).toBeGreaterThan(0);
        if (frames.length > 0) {
          console.log('[Java Attach Test] Top frame:', frames[0].name, 'line:', frames[0].line);
        }
      }

      // 5. Get local variables
      console.log('[Java Attach Test] Getting local variables...');
      const varsResult = await callToolSafely(mcpClient!, 'get_local_variables', { sessionId });
      console.log('[Java Attach Test] Variables result:', JSON.stringify(varsResult).slice(0, 300));

      // 6. Continue execution
      console.log('[Java Attach Test] Continuing execution...');
      await callToolSafely(mcpClient!, 'continue_execution', { sessionId });

      // Wait for program to finish
      await new Promise(resolve => setTimeout(resolve, 2000));

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
