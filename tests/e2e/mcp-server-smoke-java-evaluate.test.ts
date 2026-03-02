/**
 * Java Expression Evaluation Smoke Tests via MCP Interface
 *
 * Tests the ExprEvaluator in JdiDapServer through evaluate_expression MCP tool.
 * Uses ExprTest.java which has instance fields, arrays, methods, and boxed types.
 *
 * Breakpoint on line 37 of ExprTest.java (inside run()) where:
 *   int x = 10; double pi = 3.14; String msg = "hello"; Integer boxed = 42;
 * Instance fields: instanceField=42, name="test", numbers={10,20,30},
 *   matrix={{1,2},{3,4}}, flag=true, greeterRef=this
 * Methods: add(int,int), greet(String)
 * Interfaces: ExprTest implements FormalGreeter extends Greeter
 *
 * Prerequisites:
 * - JDK installed (java + javac on PATH)
 * - javac -g for LocalVariableTable
 *
 * Skips gracefully when JDK is not installed.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import fs from 'fs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { parseSdkToolResult, callToolSafely } from './smoke-test-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

/**
 * Poll for non-empty stack frames (breakpoint hit).
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

/**
 * Evaluate an expression and return the result string.
 */
async function evalExpr(
  client: Client,
  sessionId: string,
  expression: string
): Promise<string> {
  const raw = await client.callTool({
    name: 'evaluate_expression',
    arguments: { sessionId, expression }
  });
  const response = parseSdkToolResult(raw) as {
    success?: boolean;
    result?: string;
    type?: string;
    error?: string;
  };
  if (!response.success) {
    throw new Error(`Evaluation failed for "${expression}": ${response.error || JSON.stringify(response)}`);
  }
  return response.result ?? '';
}

describe('MCP Server Java Expression Evaluation Smoke Test @requires-java', () => {
  let mcpClient: Client | null = null;
  let transport: StdioClientTransport | null = null;
  let sessionId: string | null = null;

  beforeAll(async () => {
    // Check for JDK
    try {
      execSync('java -version', { stdio: 'ignore' });
      execSync('javac -version', { stdio: 'ignore' });
    } catch {
      console.log('[Java Eval Test] Skipping — JDK not installed');
      return;
    }

    console.log('[Java Eval Test] Starting MCP server...');

    transport = new StdioClientTransport({
      command: process.execPath,
      args: [path.join(ROOT, 'dist', 'index.js'), '--log-level', 'info'],
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });

    mcpClient = new Client({
      name: 'java-eval-test-client',
      version: '1.0.0'
    }, {
      capabilities: {}
    });

    await mcpClient.connect(transport);
    console.log('[Java Eval Test] MCP client connected');
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

    console.log('[Java Eval Test] Cleanup completed');
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
  });

  it('should evaluate expressions at a breakpoint in ExprTest', async () => {
    // Check for JDK
    try {
      execSync('java -version', { stdio: 'ignore' });
      execSync('javac -version', { stdio: 'ignore' });
    } catch {
      console.log('[Java Eval Test] Skipping — JDK not installed');
      return;
    }

    const testJavaFile = path.resolve(ROOT, 'examples', 'java', 'ExprTest.java');
    const testClassDir = path.resolve(ROOT, 'examples', 'java');

    // Compile with full debug info
    execSync(`javac -g -d "${testClassDir}" "${testJavaFile}"`, {
      cwd: testClassDir,
      stdio: 'pipe'
    });
    console.log('[Java Eval Test] Compiled ExprTest.java');

    try {
      // 1. Create session
      const createResult = await mcpClient!.callTool({
        name: 'create_debug_session',
        arguments: { language: 'java', name: 'java-eval-test' }
      });
      const createResponse = parseSdkToolResult(createResult);
      expect(createResponse.sessionId).toBeDefined();
      sessionId = createResponse.sessionId as string;
      console.log(`[Java Eval Test] Session created: ${sessionId}`);

      // 2. Set breakpoint on line 37 (println in run(), after all locals are assigned)
      const bpResult = parseSdkToolResult(await mcpClient!.callTool({
        name: 'set_breakpoint',
        arguments: { sessionId, file: testJavaFile, line: 37 }
      }));
      expect(bpResult.success).toBe(true);
      console.log('[Java Eval Test] Breakpoint set on line 37');

      // 3. Start debugging
      const startResult = parseSdkToolResult(await mcpClient!.callTool({
        name: 'start_debugging',
        arguments: {
          sessionId,
          scriptPath: testJavaFile,
          args: [],
          dapLaunchArgs: {
            mainClass: 'ExprTest',
            classpath: testClassDir,
            cwd: testClassDir,
            stopOnEntry: false
          }
        }
      }));
      expect(startResult.success).toBe(true);
      console.log('[Java Eval Test] Debugging started');

      // 4. Wait for breakpoint hit
      console.log('[Java Eval Test] Waiting for breakpoint hit...');
      const stackResponse = await waitForPausedState(mcpClient!, sessionId, 30, 500);
      expect(stackResponse).not.toBeNull();
      const frames = stackResponse!.stackFrames!;
      expect(frames.length).toBeGreaterThan(0);
      console.log(`[Java Eval Test] Hit breakpoint at ${frames[0].name}:${frames[0].line}`);
      expect(frames[0].name?.toLowerCase()).toContain('run');

      // === Expression evaluation tests ===

      // --- Literals ---
      console.log('[Java Eval Test] Testing literals...');
      expect(await evalExpr(mcpClient!, sessionId, '42')).toBe('42');
      expect(await evalExpr(mcpClient!, sessionId, '"hello"')).toBe('"hello"');
      expect(await evalExpr(mcpClient!, sessionId, 'true')).toBe('true');
      expect(await evalExpr(mcpClient!, sessionId, 'null')).toBe('null');
      console.log('[Java Eval Test] Literals OK');

      // --- Local variables ---
      console.log('[Java Eval Test] Testing local variables...');
      expect(await evalExpr(mcpClient!, sessionId, 'x')).toBe('10');
      expect(await evalExpr(mcpClient!, sessionId, 'msg')).toBe('"hello"');
      console.log('[Java Eval Test] Local variables OK');

      // --- this and instance fields ---
      console.log('[Java Eval Test] Testing this and fields...');
      const thisResult = await evalExpr(mcpClient!, sessionId, 'this');
      expect(thisResult).toBeTruthy();
      expect(await evalExpr(mcpClient!, sessionId, 'this.instanceField')).toBe('42');
      expect(await evalExpr(mcpClient!, sessionId, 'this.name')).toBe('"test"');
      expect(await evalExpr(mcpClient!, sessionId, 'this.flag')).toBe('true');
      console.log('[Java Eval Test] this/fields OK');

      // --- Implicit this field access ---
      console.log('[Java Eval Test] Testing implicit this...');
      expect(await evalExpr(mcpClient!, sessionId, 'instanceField')).toBe('42');
      expect(await evalExpr(mcpClient!, sessionId, 'flag')).toBe('true');
      console.log('[Java Eval Test] Implicit this OK');

      // --- Method invocation ---
      console.log('[Java Eval Test] Testing method invocation...');
      expect(await evalExpr(mcpClient!, sessionId, 'msg.length()')).toBe('5');
      expect(await evalExpr(mcpClient!, sessionId, 'msg.toUpperCase()')).toBe('"HELLO"');
      console.log('[Java Eval Test] Method invocation OK');

      // --- Instance method invocation (add, greet) ---
      console.log('[Java Eval Test] Testing instance methods...');
      expect(await evalExpr(mcpClient!, sessionId, 'add(1, 2)')).toBe('3');
      expect(await evalExpr(mcpClient!, sessionId, 'greet("World")')).toBe('"Hello, World"');
      console.log('[Java Eval Test] Instance methods OK');

      // --- Array access ---
      console.log('[Java Eval Test] Testing array access...');
      expect(await evalExpr(mcpClient!, sessionId, 'numbers[0]')).toBe('10');
      expect(await evalExpr(mcpClient!, sessionId, 'numbers[2]')).toBe('30');
      expect(await evalExpr(mcpClient!, sessionId, 'numbers.length')).toBe('3');
      console.log('[Java Eval Test] Array access OK');

      // --- 2D array access ---
      console.log('[Java Eval Test] Testing 2D array access...');
      expect(await evalExpr(mcpClient!, sessionId, 'matrix[0][0]')).toBe('1');
      expect(await evalExpr(mcpClient!, sessionId, 'matrix[1][1]')).toBe('4');
      console.log('[Java Eval Test] 2D array OK');

      // --- Arithmetic ---
      console.log('[Java Eval Test] Testing arithmetic...');
      expect(await evalExpr(mcpClient!, sessionId, 'x + 5')).toBe('15');
      expect(await evalExpr(mcpClient!, sessionId, 'x * 2 + 1')).toBe('21');
      expect(await evalExpr(mcpClient!, sessionId, '10 / 3')).toBe('3');
      expect(await evalExpr(mcpClient!, sessionId, '10 % 3')).toBe('1');
      console.log('[Java Eval Test] Arithmetic OK');

      // --- String concatenation ---
      console.log('[Java Eval Test] Testing string concatenation...');
      const concatResult = await evalExpr(mcpClient!, sessionId, '"Hello, " + name');
      expect(concatResult).toBe('"Hello, test"');
      console.log('[Java Eval Test] String concat OK');

      // --- Comparisons ---
      console.log('[Java Eval Test] Testing comparisons...');
      expect(await evalExpr(mcpClient!, sessionId, 'x > 5')).toBe('true');
      expect(await evalExpr(mcpClient!, sessionId, 'x < 5')).toBe('false');
      expect(await evalExpr(mcpClient!, sessionId, 'x == 10')).toBe('true');
      expect(await evalExpr(mcpClient!, sessionId, 'x != 10')).toBe('false');
      expect(await evalExpr(mcpClient!, sessionId, 'x >= 10')).toBe('true');
      expect(await evalExpr(mcpClient!, sessionId, 'x <= 9')).toBe('false');
      console.log('[Java Eval Test] Comparisons OK');

      // --- Boolean operators ---
      console.log('[Java Eval Test] Testing boolean operators...');
      expect(await evalExpr(mcpClient!, sessionId, 'flag && true')).toBe('true');
      expect(await evalExpr(mcpClient!, sessionId, 'flag && false')).toBe('false');
      expect(await evalExpr(mcpClient!, sessionId, 'flag || false')).toBe('true');
      expect(await evalExpr(mcpClient!, sessionId, '!flag')).toBe('false');
      console.log('[Java Eval Test] Boolean operators OK');

      // --- Grouping ---
      console.log('[Java Eval Test] Testing grouping...');
      expect(await evalExpr(mcpClient!, sessionId, '(x + 5) * 2')).toBe('30');
      expect(await evalExpr(mcpClient!, sessionId, '(2 + 3) * (4 + 1)')).toBe('25');
      console.log('[Java Eval Test] Grouping OK');

      // --- Unary minus ---
      console.log('[Java Eval Test] Testing unary minus...');
      expect(await evalExpr(mcpClient!, sessionId, '-x')).toBe('-10');
      expect(await evalExpr(mcpClient!, sessionId, '-42')).toBe('-42');
      console.log('[Java Eval Test] Unary minus OK');

      // --- instanceof with interface hierarchies (Issue 14) ---
      console.log('[Java Eval Test] Testing instanceof with interface hierarchies...');
      expect(await evalExpr(mcpClient!, sessionId, 'this instanceof ExprTest')).toBe('true');
      expect(await evalExpr(mcpClient!, sessionId, 'this instanceof Greeter')).toBe('true');
      expect(await evalExpr(mcpClient!, sessionId, 'this instanceof FormalGreeter')).toBe('true');
      expect(await evalExpr(mcpClient!, sessionId, 'greeterRef instanceof FormalGreeter')).toBe('true');
      expect(await evalExpr(mcpClient!, sessionId, 'msg instanceof String')).toBe('true');
      console.log('[Java Eval Test] instanceof OK');

      // 5. Continue execution to finish
      console.log('[Java Eval Test] Continuing execution...');
      const contResult = await callToolSafely(mcpClient!, 'continue_execution', { sessionId });
      expect(contResult.success).toBe(true);

      console.log('[Java Eval Test] ALL EXPRESSION TESTS PASSED');

    } finally {
      // Clean up compiled class files
      try {
        const classFile = path.resolve(testClassDir, 'ExprTest.class');
        if (fs.existsSync(classFile)) fs.unlinkSync(classFile);
      } catch { /* ignore */ }
    }
  }, 120000);
});
