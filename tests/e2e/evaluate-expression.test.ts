/**
 * End-to-End Test for evaluate_expression Tool
 * Tests the automatic frame detection and expression evaluation
 */
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import * as path from 'path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { parseSdkToolResult } from './smoke-test-utils.js';

const TEST_TIMEOUT = 20000;

describe('evaluate_expression E2E', () => {
  let mcpClient: Client | null = null;
  let sessionId: string | null = null;

  beforeEach(async () => {
    console.log('[E2E evaluate_expression] Setting up MCP client...');
    
    mcpClient = new Client({ name: "e2e-evaluate-test", version: "0.1.0" });
    
    const transport = new StdioClientTransport({
      command: 'node',
      args: [path.join(process.cwd(), 'dist', 'index.js'), 'stdio'],
    });
    
    await mcpClient.connect(transport);
    console.log('[E2E evaluate_expression] MCP client connected.');
  });

  afterEach(async () => {
    // Clean up session if it exists
    if (mcpClient && sessionId) {
      try {
        await mcpClient.callTool({
          name: 'close_debug_session',
          arguments: { sessionId }
        });
      } catch (e) {
        console.error(`[E2E evaluate_expression] Error cleaning up session:`, e);
      }
    }
    
    // Close MCP client
    if (mcpClient) {
      await mcpClient.close();
      mcpClient = null;
    }
  });

  it('should evaluate expressions without providing frameId', async () => {
    console.log('[E2E evaluate_expression] Starting test...');
    
    // 1. Create debug session
    const createResponse = await mcpClient!.callTool({
      name: 'create_debug_session',
      arguments: { language: 'python', name: 'evaluate-e2e-test' }
    });
    const createResult = parseSdkToolResult(createResponse);
    expect(createResult.success).toBe(true);
    sessionId = createResult.sessionId!;
    console.log(`[E2E evaluate_expression] Session created: ${sessionId}`);
    
    // 2. Set breakpoint
    const scriptPath = path.join(process.cwd(), 'tests/fixtures/debug-scripts/simple.py');
    const bpResponse = await mcpClient!.callTool({
      name: 'set_breakpoint',
      arguments: { sessionId, file: scriptPath, line: 7 }
    });
    const bpResult = parseSdkToolResult(bpResponse);
    expect(bpResult.success).toBe(true);
    console.log('[E2E evaluate_expression] Breakpoint set at line 7');
    
    // 3. Start debugging
    const startResponse = await mcpClient!.callTool({
      name: 'start_debugging',
      arguments: {
        sessionId,
        scriptPath,
        dapLaunchArgs: { stopOnEntry: false }
      }
    });
    const startResult = parseSdkToolResult(startResponse);
    expect(startResult.success).toBe(true);
    expect(startResult.state).toBe('paused');
    console.log('[E2E evaluate_expression] Debugging started and paused at breakpoint');
    
    // 4. Test evaluate_expression WITHOUT frameId (auto-detection)
    const evalResponse = await mcpClient!.callTool({
      name: 'evaluate_expression',
      arguments: {
        sessionId,
        expression: 'x + y'  // Should evaluate to 30
      }
    });
    const evalResult = parseSdkToolResult(evalResponse);
    
    // Verify the evaluation worked
    expect(evalResult.success).toBe(true);
    expect(evalResult.result).toBe('30');
    expect(evalResult.type).toBe('int');
    expect(evalResult.variablesReference).toBe(0);
    console.log('[E2E evaluate_expression] Expression evaluated successfully without frameId');
    
    // 5. Test error handling with invalid expression
    const errorResponse = await mcpClient!.callTool({
      name: 'evaluate_expression',
      arguments: {
        sessionId,
        expression: 'undefined_var'
      }
    });
    const errorResult = parseSdkToolResult(errorResponse);
    
    // Verify error handling
    expect(errorResult.success).toBe(false);
    expect(errorResult.error).toContain('NameError');
    console.log('[E2E evaluate_expression] Error handling verified');
    
    console.log('[E2E evaluate_expression] Test completed successfully!');
  }, TEST_TIMEOUT);
});
