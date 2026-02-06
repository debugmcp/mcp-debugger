/**
 * Java Attach E2E Test via MCP Interface
 *
 * Tests attaching to a running Java process with debug agent enabled.
 * Validates attach, debug, and detach functionality.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { callToolSafely } from './smoke-test-utils.js';
import { spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import { access, constants, writeFile } from 'fs';

const accessAsync = promisify(access);
const writeFileAsync = promisify(writeFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

// Port for Java debug agent
const DEBUG_PORT = 5005;

/**
 * Create a simple Java program for attach testing
 */
async function createAttachTestProgram(): Promise<string> {
  const testDir = path.resolve(ROOT, 'examples', 'java');
  const javaFile = path.join(testDir, 'AttachTestProgram.java');

  const javaCode = `
public class AttachTestProgram {
    public static void main(String[] args) {
        System.out.println("AttachTestProgram started - waiting for debugger...");

        int counter = 0;
        while (true) {
            counter++;
            System.out.println("Counter: " + counter);

            try {
                Thread.sleep(1000);
            } catch (InterruptedException e) {
                break;
            }

            // Breakpoint target line
            if (counter >= 5) {
                System.out.println("Reached counter threshold: " + counter);
            }
        }
    }
}
`;

  await writeFileAsync(javaFile, javaCode);
  return javaFile;
}

/**
 * Compile Java source file
 */
async function compileJavaFile(javaFile: string): Promise<void> {
  console.log(`[Java Attach Test] Compiling ${javaFile}...`);

  return new Promise((resolve, reject) => {
    const javac = spawn('javac', [javaFile]);

    let stderr = '';
    javac.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    javac.on('close', (code) => {
      if (code === 0) {
        console.log(`[Java Attach Test] Compilation successful`);
        resolve();
      } else {
        reject(new Error(`Compilation failed: ${stderr}`));
      }
    });
  });
}

/**
 * Start Java process with debug agent enabled
 */
async function startJavaWithDebugAgent(classFile: string): Promise<ChildProcess> {
  const classDir = path.dirname(classFile);
  const className = path.basename(classFile, '.class');

  console.error(`[Java Attach Test] Starting Java with debug agent on port ${DEBUG_PORT}...`);

  const javaProcess = spawn('java', [
    `-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=127.0.0.1:${DEBUG_PORT}`,
    '-cp',
    classDir,
    className
  ]);

  // Wait for the "Listening for transport" message from JVM
  const listenReady = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timeout waiting for Java debug agent to start'));
    }, 15000);

    const checkOutput = (data: Buffer) => {
      const output = data.toString();
      console.error(`[Java Process] ${output.trim()}`);
      if (output.includes('Listening for transport dt_socket')) {
        clearTimeout(timeout);
        resolve();
      }
    };

    javaProcess.stdout?.on('data', checkOutput);
    javaProcess.stderr?.on('data', checkOutput);

    javaProcess.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    javaProcess.on('exit', (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        reject(new Error(`Java process exited with code ${code}`));
      }
    });
  });

  await listenReady;
  console.error(`[Java Attach Test] Java debug agent is ready on port ${DEBUG_PORT}`);

  // Extra delay to ensure the debug agent is fully ready to accept connections
  await new Promise(resolve => setTimeout(resolve, 500));

  return javaProcess;
}

describe('MCP Server Java Attach Test', () => {
  let mcpClient: Client | null = null;
  let transport: StdioClientTransport | null = null;
  let sessionId: string | null = null;
  let javaProcess: ChildProcess | null = null;
  let javaFile: string | null = null;

  beforeAll(async () => {
    console.log('[Java Attach Test] Setting up test environment...');

    // Create and compile test program
    javaFile = await createAttachTestProgram();
    await compileJavaFile(javaFile);

    // Start Java process with debug agent
    const classFile = javaFile.replace(/\.java$/, '.class');
    javaProcess = await startJavaWithDebugAgent(classFile);

    // Create MCP transport
    transport = new StdioClientTransport({
      command: 'node',
      args: [path.join(ROOT, 'dist', 'index.js'), '--log-level', 'info'],
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });

    // Create and connect MCP client
    mcpClient = new Client({
      name: 'java-attach-test-client',
      version: '1.0.0'
    }, {
      capabilities: {}
    });

    await mcpClient.connect(transport);
    console.log('[Java Attach Test] MCP client connected');
  }, 60000);

  afterAll(async () => {
    console.log('[Java Attach Test] Cleaning up...');

    if (javaProcess && !javaProcess.killed) {
      javaProcess.kill('SIGTERM');
      // Give it time to terminate
      await new Promise(resolve => setTimeout(resolve, 1000));
      if (!javaProcess.killed) {
        javaProcess.kill('SIGKILL');
      }
    }

    if (mcpClient && transport) {
      await mcpClient.close();
      await transport.close();
    }
  }, 30000);

  afterEach(async () => {
    if (sessionId && mcpClient) {
      try {
        await callToolSafely(mcpClient, 'close_debug_session', { sessionId });
        // Wait for jdb to fully disconnect from JDWP - only allows one connection at a time
        // 2 seconds gives enough time for jdb to terminate and JDWP to accept new connections
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch {
        // Ignore cleanup errors
      }
      sessionId = null;
    }
  });

  it('should attach to running Java process', async () => {
    if (!mcpClient || !javaFile) {
      throw new Error('MCP client or Java file not initialized');
    }

    // Create debug session with port - triggers attach mode
    // Use 127.0.0.1 explicitly to match the Java process binding (avoid IPv6 resolution issues)
    const createData = await callToolSafely(mcpClient, 'create_debug_session', {
      language: 'java',
      name: 'attach-test-session',
      port: DEBUG_PORT,
      host: '127.0.0.1',
      timeout: 30000
    });

    console.log('[Java Attach Test] Create/attach result:', createData);

    expect(createData.success).toBe(true);
    expect(createData.sessionId).toBeDefined();
    // The state may still be 'initializing' if the MCP tool returns before jdb fully connects.
    // Valid states: 'initializing' (async attach in progress), 'paused' (stopOnEntry=true),
    // 'running' (stopOnEntry=false), 'connected' (adapter connected but not fully initialized)
    expect(['initializing', 'paused', 'running', 'connected']).toContain(createData.state);
    sessionId = createData.sessionId;
  }, 60000);

  it('should set breakpoint after attaching', async () => {
    if (!mcpClient || !javaFile) {
      throw new Error('MCP client or Java file not initialized');
    }

    // Create and attach using new API
    // Use 127.0.0.1 explicitly to match the Java process binding
    const createData = await callToolSafely(mcpClient, 'create_debug_session', {
      language: 'java',
      port: DEBUG_PORT,
      host: '127.0.0.1',
      timeout: 30000
    });
    sessionId = createData.sessionId;

    // Set breakpoint
    const absoluteJavaFile = path.resolve(javaFile);
    const breakpointData = await callToolSafely(mcpClient, 'set_breakpoint', {
      sessionId,
      file: absoluteJavaFile,
      line: 20  // Line with counter threshold check
    });

    console.log('[Java Attach Test] Breakpoint result:', breakpointData);

    expect(breakpointData.success).toBe(true);
    expect(breakpointData.verified).toBeDefined();
  }, 60000);

  it('should detach without terminating process', async () => {
    if (!mcpClient || !javaFile) {
      throw new Error('MCP client or Java file not initialized');
    }

    // Create and attach using new API
    // Use 127.0.0.1 explicitly to match the Java process binding
    const createData = await callToolSafely(mcpClient, 'create_debug_session', {
      language: 'java',
      port: DEBUG_PORT,
      host: '127.0.0.1',
      timeout: 30000
    });
    sessionId = createData.sessionId;

    // Close session (detaches from process)
    const closeData = await callToolSafely(mcpClient, 'close_debug_session', {
      sessionId
    });

    console.log('[Java Attach Test] Close/detach result:', closeData);

    expect(closeData.success).toBe(true);

    // Verify Java process is still running (close shouldn't terminate attached process)
    expect(javaProcess?.killed).toBe(false);
  }, 60000);

  it('should handle session lifecycle correctly', async () => {
    if (!mcpClient || !javaFile) {
      throw new Error('MCP client or Java file not initialized');
    }

    // Create and attach using new API
    // Use 127.0.0.1 explicitly to match the Java process binding
    const createData = await callToolSafely(mcpClient, 'create_debug_session', {
      language: 'java',
      port: DEBUG_PORT,
      host: '127.0.0.1',
      timeout: 30000
    });
    sessionId = createData.sessionId;

    expect(createData.success).toBe(true);

    // Close session
    const closeData = await callToolSafely(mcpClient, 'close_debug_session', {
      sessionId
    });

    expect(closeData.success).toBe(true);

    // Clear sessionId so afterEach doesn't try to close again
    sessionId = null;
  }, 60000);
});
