/**
 * Docker JavaScript Smoke Tests
 * 
 * Tests JavaScript debugging functionality when running in a Docker container.
 * These tests should FAIL initially due to the known regression, then PASS after the fix.
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

// Skip in CI due to container connection issues
const describeTest = process.env.CI === 'true' ? describe.skip : describe;

describeTest('Docker: JavaScript Debugging Smoke Tests', () => {
  let mcpClient: Client | null = null;
  let cleanup: (() => Promise<void>) | null = null;
  let sessionId: string | null = null;
  let containerName: string | null = null;

  beforeAll(async () => {
    console.log('[Docker JS] Building Docker image...');
    await buildDockerImage({ imageName: 'mcp-debugger:test' });
    
    console.log('[Docker JS] Starting MCP server in Docker container...');
    containerName = `mcp-debugger-js-test-${Date.now()}`;
    const result = await createDockerMcpClient({
      imageName: 'mcp-debugger:test',
      containerName,
      logLevel: 'debug'
    });
    
    mcpClient = result.client;
    cleanup = result.cleanup;
    
    console.log('[Docker JS] MCP client connected to Docker container');
  }, 60000);

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
      console.log('[Docker JS] Container logs:');
      const logs = await getDockerLogs(containerName);
      console.log(logs);
    }

    console.log('[Docker JS] Cleanup completed');
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

  it('should complete full JavaScript debugging cycle in Docker', async () => {
    // Use container path for script
    const hostScriptPath = path.join(ROOT, 'examples', 'javascript', 'mcp_target.js');
    const scriptPath = hostToContainerPath(hostScriptPath);
    
    console.log(`[Docker JS] Host path: ${hostScriptPath}`);
    console.log(`[Docker JS] Container path: ${scriptPath}`);
    
    // Step 1: Create session - just verify we get a session ID
    console.log('[Docker JS] Creating session...');
    const createResult = await mcpClient!.callTool({
      name: 'create_debug_session',
      arguments: {
        language: 'javascript',
        name: 'docker-js-smoke'
      }
    });
    
    const createResponse = parseSdkToolResult(createResult);
    expect(createResponse.sessionId).toBeDefined();
    expect(typeof createResponse.sessionId).toBe('string');
    sessionId = createResponse.sessionId as string;
    console.log('[Docker JS] ✓ Session created');

    // Step 2: Set breakpoint - use container path
    console.log('[Docker JS] Setting breakpoint...');
    const bpResult = await mcpClient!.callTool({
      name: 'set_breakpoint',
      arguments: {
        sessionId,
        file: scriptPath,
        line: 44
      }
    });
    
    const bpResponse = parseSdkToolResult(bpResult);
    expect(bpResponse.success).toBe(true);
    console.log('[Docker JS] ✓ Breakpoint set');

    // Step 3: Start debugging - verify we get a state back
    console.log('[Docker JS] Starting debugging...');
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
      console.log('[Docker JS] Start response:', JSON.stringify(startResponse, null, 2));
      
      // If state is error, get more details
      if (startResponse.state === 'error') {
        console.error('[Docker JS] Debug start failed with error state');
        console.error('[Docker JS] Full response:', startResponse);
        
        // Get Docker logs to help diagnose
        if (containerName) {
          const logs = await getDockerLogs(containerName);
          console.log('[Docker JS] Container logs (last 200 lines):');
          // Try to get more logs
          try {
            const { stdout } = await (await import('child_process')).exec(
              `docker logs ${containerName} --tail 200 2>&1`,
              { encoding: 'utf8' }
            );
            console.log(stdout);
          } catch (e) {
            console.log(logs);
          }
        }
        
        // Also check if we can get the actual log file from container
        try {
          const { stdout: logFileContent } = await (await import('child_process')).exec(
            `docker exec ${containerName} cat /tmp/docker-test.log 2>&1`,
            { encoding: 'utf8' }
          );
          console.log('[Docker JS] Debug log file from container:');
          console.log(logFileContent);
        } catch (e) {
          console.log('[Docker JS] Could not retrieve log file:', e);
        }
      }
      
      expect(startResponse.state).toBeDefined();
      // Should be paused at breakpoint
      expect(startResponse.state).toContain('paused');
      console.log('[Docker JS] ✓ Paused at breakpoint');
    } catch (error) {
      // Log error details for debugging
      console.error('[Docker JS] Failed to start debugging:', error);
      
      // Get Docker logs to help diagnose
      if (containerName) {
        const logs = await getDockerLogs(containerName);
        console.log('[Docker JS] Container logs at failure:');
        console.log(logs);
      }
      
      throw error;
    }

    // Wait briefly for session to stabilize
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Step 4: Get stack - verify we can retrieve it
    console.log('[Docker JS] Getting stack trace...');
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
    console.log('[Docker JS] ✓ Stack trace retrieved');

    // Step 5: Get variables - verify we can access them
    console.log('[Docker JS] Getting local variables...');
    const varsResult = await mcpClient!.callTool({
      name: 'get_local_variables',
      arguments: {
        sessionId,
        includeSpecial: false
      }
    });
    
    const varsResponse = parseSdkToolResult(varsResult);
    expect(varsResponse.variables).toBeDefined();
    expect(Array.isArray(varsResponse.variables)).toBe(true);
    console.log('[Docker JS] ✓ Variables accessible');

    // Step 6: Step over - verify we can control execution
    console.log('[Docker JS] Stepping over...');
    const stepResult = await mcpClient!.callTool({
      name: 'step_over',
      arguments: { sessionId }
    });
    
    const stepResponse = parseSdkToolResult(stepResult);
    expect(stepResponse.success).toBe(true);
    console.log('[Docker JS] ✓ Step executed');

    // Wait for step to complete
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Step 7: Evaluate expression - verify we can execute code
    console.log('[Docker JS] Evaluating expression...');
    const evalResult = await mcpClient!.callTool({
      name: 'evaluate_expression',
      arguments: {
        sessionId,
        expression: '1 + 2'
      }
    });
    
    const evalResponse = parseSdkToolResult(evalResult);
    expect(evalResponse.result).toBeDefined();
    const resultStr = String(evalResponse.result);
    expect(resultStr).toMatch(/3/);
    console.log('[Docker JS] ✓ Expression evaluated');

    // Step 8: Continue execution
    console.log('[Docker JS] Continuing execution...');
    const continueResult = await mcpClient!.callTool({
      name: 'continue_execution',
      arguments: { sessionId }
    });
    
    const continueResponse = parseSdkToolResult(continueResult);
    expect(continueResponse.success).toBe(true);
    console.log('[Docker JS] ✓ Execution continued');

    // Wait for script to complete
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 9: Close session
    console.log('[Docker JS] Closing session...');
    const closeResult = await mcpClient!.callTool({
      name: 'close_debug_session',
      arguments: { sessionId }
    });
    
    const closeResponse = parseSdkToolResult(closeResult);
    expect(closeResponse.success).toBe(true);
    sessionId = null;
    console.log('[Docker JS] ✓ Session closed');

    console.log('[Docker JS] ✅ All checks passed');
  }, 120000);  // Increased timeout for Docker operations

  it('should step into nested JavaScript frames in Docker', async () => {
    const hostScriptPath = path.join(ROOT, 'examples', 'javascript', 'mcp_target.js');
    const scriptPath = hostToContainerPath(hostScriptPath);

    const createResult = await mcpClient!.callTool({
      name: 'create_debug_session',
      arguments: {
        language: 'javascript',
        name: 'docker-js-step-into'
      }
    });

    sessionId = parseSdkToolResult(createResult).sessionId as string;

    const breakpointResult = await mcpClient!.callTool({
      name: 'set_breakpoint',
      arguments: {
        sessionId,
        file: scriptPath,
        line: 48
      }
    });
    expect(parseSdkToolResult(breakpointResult).success).toBe(true);

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

    const startResponse = parseSdkToolResult(startResult);
    expect(startResponse.state).toBeDefined();
    expect(startResponse.state).toContain('paused');

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const stackBefore = parseSdkToolResult(
      await mcpClient!.callTool({
        name: 'get_stack_trace',
        arguments: { sessionId, includeInternals: false }
      })
    );

    const topBefore = Array.isArray(stackBefore.stackFrames)
      ? (stackBefore.stackFrames as Array<{ name?: string; line?: number }>)[0]
      : null;
    expect(topBefore).toBeTruthy();
    expect(topBefore?.line).toBe(48);

    const stepResult = await mcpClient!.callTool({
      name: 'step_into',
      arguments: { sessionId }
    });

    const stepResponse = parseSdkToolResult(stepResult);
    expect(stepResponse.success).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const stackAfter = parseSdkToolResult(
      await mcpClient!.callTool({
        name: 'get_stack_trace',
        arguments: { sessionId, includeInternals: false }
      })
    );

    const topAfter = Array.isArray(stackAfter.stackFrames)
      ? (stackAfter.stackFrames as Array<{ name?: string; line?: number }>)[0]
      : null;

    expect(topAfter).toBeTruthy();
    expect(topAfter?.name?.toLowerCase()).toContain('deepfunction');
    expect(topAfter?.line).toBeLessThan(48);

    const continueResult = await mcpClient!.callTool({
      name: 'continue_execution',
      arguments: { sessionId }
    });
    const continueParsed = parseSdkToolResult(continueResult);
    expect(continueParsed.success).toBe(true);

    const closeResult = await mcpClient!.callTool({
      name: 'close_debug_session',
      arguments: { sessionId }
    });
    expect(parseSdkToolResult(closeResult).success).toBe(true);

    sessionId = null;
  }, 120000);

  it('should step over top-level const declarations in Docker', async () => {
    const hostScriptPath = path.join(ROOT, 'examples', 'javascript', 'test-simple.js');
    const scriptPath = hostToContainerPath(hostScriptPath);

    const createResult = await mcpClient!.callTool({
      name: 'create_debug_session',
      arguments: {
        language: 'javascript',
        name: 'docker-js-step-over-const'
      }
    });

    sessionId = parseSdkToolResult(createResult).sessionId as string;

    const breakpointResult = await mcpClient!.callTool({
      name: 'set_breakpoint',
      arguments: {
        sessionId,
        file: scriptPath,
        line: 3
      }
    });
    expect(parseSdkToolResult(breakpointResult).success).toBe(true);

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

    const startResponse = parseSdkToolResult(startResult);
    expect(startResponse.state).toBeDefined();
    expect(startResponse.state).toContain('paused');

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const stepResult = await mcpClient!.callTool({
      name: 'step_over',
      arguments: { sessionId }
    });

    const stepResponse = parseSdkToolResult(stepResult);
    expect(stepResponse.success).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const stackAfter = parseSdkToolResult(
      await mcpClient!.callTool({
        name: 'get_stack_trace',
        arguments: { sessionId, includeInternals: false }
      })
    );

    const topAfter = Array.isArray(stackAfter.stackFrames)
      ? (stackAfter.stackFrames as Array<{ name?: string; line?: number }>)[0]
      : null;
    expect(topAfter).toBeTruthy();
    expect(topAfter?.line).toBe(4);

    const continueResult = await mcpClient!.callTool({
      name: 'continue_execution',
      arguments: { sessionId }
    });
    const continueParsed = parseSdkToolResult(continueResult);
    expect(continueParsed.success).toBe(true);

    const closeResult = await mcpClient!.callTool({
      name: 'close_debug_session',
      arguments: { sessionId }
    });
    expect(parseSdkToolResult(closeResult).success).toBe(true);

    sessionId = null;
  }, 120000);

  it('should handle multiple breakpoints in Docker', async () => {
    const hostScriptPath = path.join(ROOT, 'examples', 'javascript', 'mcp_target.js');
    const scriptPath = hostToContainerPath(hostScriptPath);
    
    // Create session
    const createResult = await mcpClient!.callTool({
      name: 'create_debug_session',
      arguments: {
        language: 'javascript',
        name: 'docker-js-multi-bp'
      }
    });
    
    sessionId = parseSdkToolResult(createResult).sessionId as string;
    
    // Set multiple breakpoints with container paths
    const bp1 = await mcpClient!.callTool({
      name: 'set_breakpoint',
      arguments: { sessionId, file: scriptPath, line: 44 }
    });
    
    const bp2 = await mcpClient!.callTool({
      name: 'set_breakpoint',
      arguments: { sessionId, file: scriptPath, line: 53 }
    });
    
    // Both should succeed
    expect(parseSdkToolResult(bp1).success).toBe(true);
    expect(parseSdkToolResult(bp2).success).toBe(true);
    
    console.log('[Docker JS] ✓ Multiple breakpoints set');
    
    // Cleanup
    await mcpClient!.callTool({
      name: 'close_debug_session',
      arguments: { sessionId }
    });
    sessionId = null;
  }, 60000);

  it('should retrieve source context in Docker', async () => {
    const hostScriptPath = path.join(ROOT, 'examples', 'javascript', 'mcp_target.js');
    const scriptPath = hostToContainerPath(hostScriptPath);
    
    // Create session
    const createResult = await mcpClient!.callTool({
      name: 'create_debug_session',
      arguments: {
        language: 'javascript',
        name: 'docker-js-source'
      }
    });
    
    sessionId = parseSdkToolResult(createResult).sessionId as string;
    
    // Get source context with container path
    const sourceResult = await mcpClient!.callTool({
      name: 'get_source_context',
      arguments: {
        sessionId,
        file: scriptPath,
        line: 44,
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
    
    console.log('[Docker JS] ✓ Source context retrieved');
    
    // Cleanup
    await mcpClient!.callTool({
      name: 'close_debug_session',
      arguments: { sessionId }
    });
    sessionId = null;
  }, 60000);
});
