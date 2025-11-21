/**
 * Simplified JavaScript Smoke Tests
 * 
 * High-level tests that verify core debugging functionality without
 * coupling to implementation details. These tests should survive refactoring
 * as long as the debugging behavior remains correct.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { parseSdkToolResult } from './smoke-test-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

describe('JavaScript Debugging - Simple Smoke Tests', () => {
  let mcpClient: Client | null = null;
  let transport: StdioClientTransport | null = null;
  let sessionId: string | null = null;

  beforeAll(async () => {
    console.log('[JS Simple Smoke] Starting MCP server...');
    
    const cliEntry = path.join(ROOT, 'packages', 'mcp-debugger', 'dist', 'cli.mjs');
    if (!existsSync(cliEntry)) {
      throw new Error(
        `mcp-debugger CLI bundle missing at ${cliEntry}. Run "pnpm --filter @debugmcp/mcp-debugger build" before executing this test.`
      );
    }

    transport = new StdioClientTransport({
      command: 'node',
      args: [cliEntry, 'stdio', '--log-level', 'info'],
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });

    mcpClient = new Client({
      name: 'js-simple-smoke-client',
      version: '1.0.0'
    }, {
      capabilities: {}
    });

    await mcpClient.connect(transport);
    console.log('[JS Simple Smoke] MCP client connected');
  }, 30000);

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

    if (mcpClient) {
      await mcpClient.close();
    }
    if (transport) {
      await transport.close();
    }

    console.log('[JS Simple Smoke] Cleanup completed');
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

  const JS_SCRIPT_PATH = path.join(ROOT, 'examples', 'javascript', 'simple_test.js');

  it('should complete full JavaScript debugging cycle', async () => {
    const scriptPath = JS_SCRIPT_PATH;
    // Step 1: Create session - just verify we get a session ID
    console.log('[JS Simple Smoke] Creating session...');
    const createResult = await mcpClient!.callTool({
      name: 'create_debug_session',
      arguments: {
        language: 'javascript',
        name: 'js-simple-smoke'
      }
    });
    
    const createResponse = parseSdkToolResult(createResult);
    expect(createResponse.sessionId).toBeDefined();
    expect(typeof createResponse.sessionId).toBe('string');
    sessionId = createResponse.sessionId as string;
    console.log('[JS Simple Smoke] ✓ Session created');

    // Step 2: Set breakpoint - just verify it was accepted
    console.log('[JS Simple Smoke] Setting breakpoint...');
    const bpResult = await mcpClient!.callTool({
      name: 'set_breakpoint',
      arguments: {
        sessionId,
        file: scriptPath,
        line: 14
      }
    });
    
    const bpResponse = parseSdkToolResult(bpResult);
    expect(bpResponse.success).toBe(true);
    console.log('[JS Simple Smoke] ✓ Breakpoint set');

    // Step 3: Start debugging - verify we get a state back
    console.log('[JS Simple Smoke] Starting debugging...');
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
    // Should be paused at breakpoint
    expect(startResponse.state).toContain('paused');
    console.log('[JS Simple Smoke] ✓ Paused at breakpoint');

    // Wait briefly for session to stabilize
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Step 4: Get stack - verify we can retrieve it
    console.log('[JS Simple Smoke] Getting stack trace...');
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
    console.log('[JS Simple Smoke] ✓ Stack trace retrieved');

    // Step 5: Get variables - verify we can access them
    console.log('[JS Simple Smoke] Getting local variables...');
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
    // Variables array might be empty at this line, but the mechanism works
    console.log('[JS Simple Smoke] ✓ Variables accessible');

    // Step 6: Step over - verify we can control execution
    console.log('[JS Simple Smoke] Stepping over...');
    const stepResult = await mcpClient!.callTool({
      name: 'step_over',
      arguments: { sessionId }
    });

    const stepResponse = parseSdkToolResult(stepResult);
    expect(stepResponse.success).toBe(true);
    console.log('[JS Simple Smoke] ✓ Step executed');

    // Verify location and context are provided
    if (stepResponse.location) {
      console.log('[JS Simple Smoke] Step result includes location:', stepResponse.location);
      expect(stepResponse.location).toHaveProperty('file');
      expect(stepResponse.location).toHaveProperty('line');
      expect(typeof (stepResponse.location as any).line).toBe('number');
    }

    if (stepResponse.context) {
      console.log('[JS Simple Smoke] Step result includes context');
      expect(stepResponse.context).toHaveProperty('lineContent');
      expect(stepResponse.context).toHaveProperty('surrounding');
      expect(Array.isArray((stepResponse.context as any).surrounding)).toBe(true);
    }

    // Wait for step to complete
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Step 7: Evaluate expression - verify we can execute code
    console.log('[JS Simple Smoke] Evaluating expression...');
    const evalResult = await mcpClient!.callTool({
      name: 'evaluate_expression',
      arguments: {
        sessionId,
        expression: '1 + 2'
      }
    });
    
    const evalResponse = parseSdkToolResult(evalResult);
    expect(evalResponse.result).toBeDefined();
    // Result should be "3" in some form
    const resultStr = String(evalResponse.result);
    expect(resultStr).toMatch(/3/);
    console.log('[JS Simple Smoke] ✓ Expression evaluated');

    // Step 8: Continue execution
    console.log('[JS Simple Smoke] Continuing execution...');
    const continueResult = await mcpClient!.callTool({
      name: 'continue_execution',
      arguments: { sessionId }
    });
    
    const continueResponse = parseSdkToolResult(continueResult);
    expect(continueResponse.success).toBe(true);
    console.log('[JS Simple Smoke] ✓ Execution continued');

    // Wait for script to complete
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 9: Close session
    console.log('[JS Simple Smoke] Closing session...');
    const closeResult = await mcpClient!.callTool({
      name: 'close_debug_session',
      arguments: { sessionId }
    });
    
    const closeResponse = parseSdkToolResult(closeResult);
    expect(closeResponse.success).toBe(true);
    sessionId = null;
    console.log('[JS Simple Smoke] ✓ Session closed');

    console.log('[JS Simple Smoke] ✅ All checks passed');
  }, 60000);

  it('should handle multiple breakpoints', async () => {
    const scriptPath = JS_SCRIPT_PATH;
    
    // Create session
    const createResult = await mcpClient!.callTool({
      name: 'create_debug_session',
      arguments: {
        language: 'javascript',
        name: 'js-multi-bp'
      }
    });
    
    sessionId = parseSdkToolResult(createResult).sessionId as string;
    
    // Set multiple breakpoints
    const bp1 = await mcpClient!.callTool({
      name: 'set_breakpoint',
      arguments: { sessionId, file: scriptPath, line: 11 }
    });
    
    const bp2 = await mcpClient!.callTool({
      name: 'set_breakpoint',
      arguments: { sessionId, file: scriptPath, line: 14 }
    });
    
    // Both should succeed
    expect(parseSdkToolResult(bp1).success).toBe(true);
    expect(parseSdkToolResult(bp2).success).toBe(true);
    
    console.log('[JS Simple Smoke] ✓ Multiple breakpoints set');
    
    // Cleanup
    await mcpClient!.callTool({
      name: 'close_debug_session',
      arguments: { sessionId }
    });
    sessionId = null;
  });

  it('should retrieve source context', async () => {
    const scriptPath = JS_SCRIPT_PATH;
    
    // Create session
    const createResult = await mcpClient!.callTool({
      name: 'create_debug_session',
      arguments: {
        language: 'javascript',
        name: 'js-source'
      }
    });
    
    sessionId = parseSdkToolResult(createResult).sessionId as string;
    
    // Get source context
    const sourceResult = await mcpClient!.callTool({
      name: 'get_source_context',
      arguments: {
        sessionId,
        file: scriptPath,
        line: 14,
        linesContext: 3
      }
    });
    
    const sourceResponse = parseSdkToolResult(sourceResult);
    // Just verify we got some source information back - tool succeeded
    expect(sourceResponse.success).toBe(true);
    // Verify we got some source content (don't care about exact format)
    expect(
      sourceResponse.lineContent || 
      sourceResponse.source || 
      sourceResponse.context
    ).toBeDefined();
    
    console.log('[JS Simple Smoke] ✓ Source context retrieved');
    
    // Cleanup
    await mcpClient!.callTool({
      name: 'close_debug_session',
      arguments: { sessionId }
    });
    sessionId = null;
  });
});
