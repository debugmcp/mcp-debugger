/**
 * Docker Python Smoke Tests
 * 
 * Tests Python debugging functionality when running in a Docker container.
 * These tests should PASS since Python debugging is known to work in Docker.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildDockerImage, createDockerMcpClient, hostToContainerPath, getDockerLogs } from './docker-test-utils.js';
import { parseSdkToolResult } from '../smoke-test-utils.js';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../../..');

const SKIP_DOCKER = process.env.SKIP_DOCKER_TESTS === 'true';

describe.skipIf(SKIP_DOCKER)('Docker: Python Debugging Smoke Tests', () => {
  let mcpClient: Client | null = null;
  let cleanup: (() => Promise<void>) | null = null;
  let sessionId: string | null = null;
  let containerName: string | null = null;

  beforeAll(async () => {
    console.log('[Docker Python] Building Docker image...');
    await buildDockerImage({ imageName: 'mcp-debugger:test' });
    
    console.log('[Docker Python] Starting MCP server in Docker container...');
    containerName = `mcp-debugger-py-test-${Date.now()}`;
    const result = await createDockerMcpClient({
      imageName: 'mcp-debugger:test',
      containerName,
      logLevel: 'debug'
    });
    
    mcpClient = result.client;
    cleanup = result.cleanup;
    
    console.log('[Docker Python] MCP client connected to Docker container');
  }, 240000);

  afterAll(async () => {
    if (sessionId && mcpClient) {
      try {
        await mcpClient.callTool({
          name: 'close_debug_session',
          arguments: { sessionId }
        });
      } catch {
        // Session may already be closed
      }
    }

    if (cleanup) {
      await cleanup();
    }
    
    // Print Docker logs for debugging if test failed
    if (containerName && process.env.VITEST_FAILED) {
      console.log('[Docker Python] Container logs:');
      const logs = await getDockerLogs(containerName);
      console.log(logs);
    }

    console.log('[Docker Python] Cleanup completed');
  });

  afterEach(async () => {
    if (sessionId && mcpClient) {
      try {
        await mcpClient.callTool({
          name: 'close_debug_session',
          arguments: { sessionId }
        });
      } catch {
        // Ignore cleanup errors
      }
      sessionId = null;
    }
  });

  it('should complete full Python debugging cycle in Docker', async () => {
    // Use container path for script
    const hostScriptPath = path.join(ROOT, 'examples', 'python', 'simple_test.py');
    const scriptPath = hostToContainerPath(hostScriptPath);
    
    console.log(`[Docker Python] Host path: ${hostScriptPath}`);
    console.log(`[Docker Python] Container path: ${scriptPath}`);
    
    // Step 1: Create session
    console.log('[Docker Python] Creating session...');
    const createResult = await mcpClient!.callTool({
      name: 'create_debug_session',
      arguments: {
        language: 'python',
        name: 'docker-python-smoke'
      }
    });
    
    const createResponse = parseSdkToolResult(createResult);
    expect(createResponse.sessionId).toBeDefined();
    expect(typeof createResponse.sessionId).toBe('string');
    sessionId = createResponse.sessionId as string;
    console.log('[Docker Python] ✓ Session created');

    // Step 2: Set breakpoint at the swap operation (line 11 - the actual swap line)
    console.log('[Docker Python] Setting breakpoint...');
    const bpResult = await mcpClient!.callTool({
      name: 'set_breakpoint',
      arguments: {
        sessionId,
        file: scriptPath,
        line: 11
      }
    });
    
    const bpResponse = parseSdkToolResult(bpResult);
    expect(bpResponse.success).toBe(true);
    console.log('[Docker Python] ✓ Breakpoint set');

    // Step 3: Start debugging
    console.log('[Docker Python] Starting debugging...');
    let startResponse: any;
    try {
      const startResult = await mcpClient!.callTool({
        name: 'start_debugging',
        arguments: {
          sessionId,
          scriptPath,
          args: [],
          dapLaunchArgs: {
            stopOnEntry: false,
            justMyCode: true
          }
        }
      });
      
      startResponse = parseSdkToolResult(startResult);
      console.log('[Docker Python] Start response:', JSON.stringify(startResponse, null, 2));
      
      expect(startResponse.state).toBeDefined();
      // Should be paused at breakpoint
      expect(startResponse.state).toContain('paused');
      console.log('[Docker Python] ✓ Paused at breakpoint');
    } catch (error) {
      // Log error details for debugging
      console.error('[Docker Python] Failed to start debugging:', error);
      
      // Get Docker logs to help diagnose
      if (containerName) {
        const logs = await getDockerLogs(containerName);
        console.log('[Docker Python] Container logs at failure:');
        console.log(logs);
      }
      
      throw error;
    }

    // Wait briefly for session to stabilize
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Step 4: Get stack trace
    console.log('[Docker Python] Getting stack trace...');
    const stackResult = await mcpClient!.callTool({
      name: 'get_stack_trace',
      arguments: {
        sessionId,
        includeInternals: false
      }
    });
    
    const stackResponse = parseSdkToolResult(stackResult);
    expect(stackResponse.stackFrames).toBeDefined();
    expect(Array.isArray(stackResponse.stackFrames)).toBe(true);
    expect((stackResponse.stackFrames as any[]).length).toBeGreaterThan(0);
    console.log('[Docker Python] ✓ Stack trace retrieved');

    // Step 5: Get variables before swap (should be a=1, b=2)
    console.log('[Docker Python] Getting local variables before swap...');
    const varsBeforeResult = await mcpClient!.callTool({
      name: 'get_local_variables',
      arguments: {
        sessionId,
        includeSpecial: false
      }
    });
    
    const varsBefore = parseSdkToolResult(varsBeforeResult);
    expect(varsBefore.variables).toBeDefined();
    expect(Array.isArray(varsBefore.variables)).toBe(true);
    
    // Find variables a and b
    const variables = varsBefore.variables as any[];
    const varA = variables.find(v => v.name === 'a');
    const varB = variables.find(v => v.name === 'b');
    
    expect(varA).toBeDefined();
    expect(varB).toBeDefined();
    expect(varA.value).toBe('1');
    expect(varB.value).toBe('2');
    
    console.log('[Docker Python] ✓ Variables before swap: a=1, b=2');

    // Step 6: Step over the swap operation
    console.log('[Docker Python] Stepping over swap operation...');
    const stepResult = await mcpClient!.callTool({
      name: 'step_over',
      arguments: { sessionId }
    });
    
    const stepResponse = parseSdkToolResult(stepResult);
    expect(stepResponse.success).toBe(true);
    console.log('[Docker Python] ✓ Step executed');

    // Wait for step to complete
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Step 7: Get variables after swap (should be a=2, b=1)
    console.log('[Docker Python] Getting local variables after swap...');
    const varsAfterResult = await mcpClient!.callTool({
      name: 'get_local_variables',
      arguments: {
        sessionId,
        includeSpecial: false
      }
    });
    
    const varsAfter = parseSdkToolResult(varsAfterResult);
    const variablesAfter = varsAfter.variables as any[];
    const varAAfter = variablesAfter.find(v => v.name === 'a');
    const varBAfter = variablesAfter.find(v => v.name === 'b');
    
    expect(varAAfter.value).toBe('2');
    expect(varBAfter.value).toBe('1');
    
    console.log('[Docker Python] ✓ Variables after swap: a=2, b=1 (correctly swapped)');

    // Step 8: Evaluate expression
    console.log('[Docker Python] Evaluating expression...');
    const evalResult = await mcpClient!.callTool({
      name: 'evaluate_expression',
      arguments: {
        sessionId,
        expression: 'a + b'
      }
    });
    
    const evalResponse = parseSdkToolResult(evalResult);
    expect(evalResponse.result).toBeDefined();
    // Should be "3" (2 + 1)
    const resultStr = String(evalResponse.result);
    expect(resultStr).toMatch(/3/);
    console.log('[Docker Python] ✓ Expression evaluated: a + b = 3');

    // Step 9: Continue execution
    console.log('[Docker Python] Continuing execution...');
    const continueResult = await mcpClient!.callTool({
      name: 'continue_execution',
      arguments: { sessionId }
    });
    
    const continueResponse = parseSdkToolResult(continueResult);
    expect(continueResponse.success).toBe(true);
    console.log('[Docker Python] ✓ Execution continued');

    // Wait for script to complete
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 10: Close session
    console.log('[Docker Python] Closing session...');
    const closeResult = await mcpClient!.callTool({
      name: 'close_debug_session',
      arguments: { sessionId }
    });
    
    const closeResponse = parseSdkToolResult(closeResult);
    expect(closeResponse.success).toBe(true);
    sessionId = null;
    console.log('[Docker Python] ✓ Session closed');

    console.log('[Docker Python] ✅ All checks passed');
  }, 120000);  // Increased timeout for Docker operations

  it('should handle multiple breakpoints in Docker', async () => {
    const hostScriptPath = path.join(ROOT, 'examples', 'python', 'simple_test.py');
    const scriptPath = hostToContainerPath(hostScriptPath);
    
    // Create session
    const createResult = await mcpClient!.callTool({
      name: 'create_debug_session',
      arguments: {
        language: 'python',
        name: 'docker-python-multi-bp'
      }
    });
    
    sessionId = parseSdkToolResult(createResult).sessionId as string;
    
    // Set multiple breakpoints
    const bp1 = await mcpClient!.callTool({
      name: 'set_breakpoint',
      arguments: { sessionId, file: scriptPath, line: 10 }
    });
    
    const bp2 = await mcpClient!.callTool({
      name: 'set_breakpoint',
      arguments: { sessionId, file: scriptPath, line: 11 }
    });
    
    // Both should succeed
    expect(parseSdkToolResult(bp1).success).toBe(true);
    expect(parseSdkToolResult(bp2).success).toBe(true);
    
    console.log('[Docker Python] ✓ Multiple breakpoints set');
    
    // Cleanup
    await mcpClient!.callTool({
      name: 'close_debug_session',
      arguments: { sessionId }
    });
    sessionId = null;
  }, 60000);

  it('should retrieve source context in Docker', async () => {
    const hostScriptPath = path.join(ROOT, 'examples', 'python', 'simple_test.py');
    const scriptPath = hostToContainerPath(hostScriptPath);
    
    // Create session
    const createResult = await mcpClient!.callTool({
      name: 'create_debug_session',
      arguments: {
        language: 'python',
        name: 'docker-python-source'
      }
    });
    
    sessionId = parseSdkToolResult(createResult).sessionId as string;
    
    // Get source context
    const sourceResult = await mcpClient!.callTool({
      name: 'get_source_context',
      arguments: {
        sessionId,
        file: scriptPath,
        line: 10,
        linesContext: 3
      }
    });
    
    const sourceResponse = parseSdkToolResult(sourceResult);
    expect(sourceResponse.success).toBe(true);
    expect(
      sourceResponse.lineContent || 
      sourceResponse.source || 
      sourceResponse.context
    ).toBeDefined();
    
    console.log('[Docker Python] ✓ Source context retrieved');
    
    // Cleanup
    await mcpClient!.callTool({
      name: 'close_debug_session',
      arguments: { sessionId }
    });
    sessionId = null;
  }, 60000);
});
