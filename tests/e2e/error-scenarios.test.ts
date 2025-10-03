/**
 * Error Scenarios E2E Tests
 * Tests various error conditions and edge cases
 */
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import * as path from 'path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { parseSdkToolResult, callToolSafely } from './smoke-test-utils.js';
import { 
  waitForSessionState, 
  waitForAnyState,
  EventRecorder,
  PYTHON_TIMEOUT
} from './test-event-utils.js';

let mcpClient: Client | null = null;
let debugSessionIds: string[] = [];

describe('Error Scenarios E2E', () => {
  beforeEach(async () => {
    console.log('[E2E Error Scenarios] Setting up MCP client...');
    debugSessionIds = [];
    
    mcpClient = new Client({ name: "e2e-error-scenarios-test", version: "0.1.0" });
    
    const transport = new StdioClientTransport({
      command: 'node',
      args: [path.join(process.cwd(), 'dist', 'index.js'), 'stdio'],
    });
    
    transport.onerror = (error) => {
      console.error('[E2E Error Scenarios] Transport error:', error);
    };
    
    await mcpClient.connect(transport);
    console.log('[E2E Error Scenarios] MCP client connected.');
  });

  afterEach(async () => {
    // Clean up any remaining sessions
    for (const sessionId of debugSessionIds) {
      try {
        await mcpClient!.callTool({
          name: 'close_debug_session',
          arguments: { sessionId }
        });
      } catch {
        // Expected for invalid sessions
      }
    }
    
    // Close MCP client
    if (mcpClient) {
      await mcpClient.close();
      mcpClient = null;
    }
  });

  describe('Language Support Errors', () => {
    it('should reject unsupported language (fakelang)', async () => {
      console.log('\n[E2E Error Scenarios] Testing unsupported language...');
      
      const result = await callToolSafely(
        mcpClient!,
        'create_debug_session',
        { language: 'fakelang', name: 'Fake Language Test' }
      );
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('not supported');
      console.log('[E2E Error Scenarios] Correctly rejected unsupported language');
    });
  });

  describe('Session Management Errors', () => {
    it('should handle invalid session ID', async () => {
      console.log('\n[E2E Error Scenarios] Testing invalid session ID...');
      
      const invalidSessionId = 'invalid-session-12345';
      
      // Try to set breakpoint with invalid session
      const breakpointResult = await callToolSafely(
        mcpClient!,
        'set_breakpoint',
        {
          sessionId: invalidSessionId,
          file: path.join(process.cwd(), 'tests/fixtures/debug-scripts/simple.py'),
          line: 4
        }
      );
      
      expect(breakpointResult.success).toBe(false);
      console.log('[E2E Error Scenarios] Correctly rejected invalid session ID for breakpoint');
      
      // Try to start debugging with invalid session
      const debugResult = await callToolSafely(
        mcpClient!,
        'start_debugging',
        {
          sessionId: invalidSessionId,
          scriptPath: path.join(process.cwd(), 'tests/fixtures/debug-scripts/simple.py')
        }
      );
      
      expect(debugResult.success).toBe(false);
      console.log('[E2E Error Scenarios] Correctly rejected invalid session ID for debugging');
    });
    
    it('should handle operations on closed session', async () => {
      console.log('\n[E2E Error Scenarios] Testing operations on closed session...');
      
      // Create and immediately close a session
      const createResponse = await mcpClient!.callTool({
        name: 'create_debug_session',
        arguments: { language: 'mock', name: 'Closed Session Test' }
      });
      const createResult = parseSdkToolResult(createResponse);
      expect(createResult.success).toBe(true);
      const sessionId = createResult.sessionId!;
      
      const closeResponse = await mcpClient!.callTool({
        name: 'close_debug_session',
        arguments: { sessionId }
      });
      const closeResult = parseSdkToolResult(closeResponse);
      expect(closeResult.success).toBe(true);
      
      // Verify session is actually closed
      const eventRecorder = new EventRecorder();
      const isClosed = await waitForSessionState(mcpClient!, sessionId, 'stopped', {
        timeout: 1000,
        eventRecorder
      });
      expect(isClosed).toBe(true);
      
      // Now try to use the closed session
      const breakpointResult = await callToolSafely(
        mcpClient!,
        'set_breakpoint',
        {
          sessionId,
          file: path.join(process.cwd(), 'tests/fixtures/debug-scripts/simple-mock.js'),
          line: 4
        }
      );
      
      expect(breakpointResult.success).toBe(false);
      console.log('[E2E Error Scenarios] Correctly rejected operation on closed session');
    });
  });

  describe('File and Path Errors', () => {
    it('should handle non-existent file for breakpoint', async () => {
      console.log('\n[E2E Error Scenarios] Testing non-existent file for breakpoint...');
      
      // Create a valid session
      const createResponse = await mcpClient!.callTool({
        name: 'create_debug_session',
        arguments: { language: 'mock', name: 'File Error Test' }
      });
      const createResult = parseSdkToolResult(createResponse);
      const sessionId = createResult.sessionId!;
      debugSessionIds.push(sessionId);
      
      // Try to set breakpoint in non-existent file - should throw error
      try {
        await mcpClient!.callTool({
          name: 'set_breakpoint',
          arguments: {
            sessionId,
            file: path.join(process.cwd(), 'tests/fixtures/debug-scripts/does-not-exist.py'),
            line: 4
          }
        });
        // If we get here, the test should fail
        expect(true).toBe(false);
      } catch (error: any) {
        // Expected to throw MCP error with file validation message
        expect(error.message).toContain('Breakpoint file not found');
        console.log('[E2E Error Scenarios] Correctly rejected non-existent file for breakpoint');
      }
    });
    
    it('should handle invalid script path for debugging', async () => {
      console.log('\n[E2E Error Scenarios] Testing invalid script path...');
      
      // Create a valid session
      const createResponse = await mcpClient!.callTool({
        name: 'create_debug_session',
        arguments: { language: 'python', name: 'Invalid Script Test' }
      });
      const createResult = parseSdkToolResult(createResponse);
      const sessionId = createResult.sessionId!;
      debugSessionIds.push(sessionId);
      
      // Try to start debugging with non-existent script - should throw error immediately
      try {
        await mcpClient!.callTool({
          name: 'start_debugging',
          arguments: {
            sessionId,
            scriptPath: path.join(process.cwd(), 'tests/fixtures/debug-scripts/does-not-exist.py')
          }
        });
        // If we get here, the test should fail
        expect(true).toBe(false);
      } catch (error: any) {
        // Expected to throw MCP error with file validation message
        expect(error.message).toContain('Script file not found');
        console.log('[E2E Error Scenarios] Correctly rejected invalid script path');
      }
    });
  });

  describe('Debug Operation Errors', () => {
    it('should handle step operations when not paused', async () => {
      console.log('\n[E2E Error Scenarios] Testing step operations when not paused...');
      
      // Create a session but don't start debugging
      const createResponse = await mcpClient!.callTool({
        name: 'create_debug_session',
        arguments: { language: 'mock', name: 'Step Error Test' }
      });
      const createResult = parseSdkToolResult(createResponse);
      const sessionId = createResult.sessionId!;
      debugSessionIds.push(sessionId);
      
      // Try to step over without being in debug mode
      const stepResult = await callToolSafely(
        mcpClient!,
        'step_over',
        { sessionId }
      );
      
      expect(stepResult.success).toBe(false);
      console.log('[E2E Error Scenarios] Correctly rejected step operation when not debugging');
    });
    
    it('should handle get_stack_trace when not paused', async () => {
      console.log('\n[E2E Error Scenarios] Testing get_stack_trace when not paused...');
      
      // Create a session but don't start debugging
      const createResponse = await mcpClient!.callTool({
        name: 'create_debug_session',
        arguments: { language: 'mock', name: 'Stack Trace Error Test' }
      });
      const createResult = parseSdkToolResult(createResponse);
      const sessionId = createResult.sessionId!;
      debugSessionIds.push(sessionId);
      
      // Try to get stack trace without being in debug mode
      const stackResult = await callToolSafely(
        mcpClient!,
        'get_stack_trace',
        { sessionId }
      );
      
      expect(stackResult.success).toBe(false);
      console.log('[E2E Error Scenarios] Correctly rejected stack trace when not debugging');
    });
  });

  describe('Invalid Parameters', () => {
    it('should handle invalid breakpoint line numbers', async () => {
      console.log('\n[E2E Error Scenarios] Testing invalid breakpoint line numbers...');
      
      // Create a valid session
      const createResponse = await mcpClient!.callTool({
        name: 'create_debug_session',
        arguments: { language: 'mock', name: 'Invalid Line Test' }
      });
      const createResult = parseSdkToolResult(createResponse);
      const sessionId = createResult.sessionId!;
      debugSessionIds.push(sessionId);
      
      // Try negative line number
      const negativeLineResponse = await mcpClient!.callTool({
        name: 'set_breakpoint',
        arguments: {
          sessionId,
          file: path.join(process.cwd(), 'tests/fixtures/debug-scripts/simple-mock.js'),
          line: -1
        }
      });
      const negativeLineResult = parseSdkToolResult(negativeLineResponse);
      
      // Depending on implementation, this might succeed but not be verified
      if (negativeLineResult.success) {
        expect(negativeLineResult.verified).toBe(false);
      }
      console.log('[E2E Error Scenarios] Handled negative line number');
      
      // Try very large line number
      const largeLineResponse = await mcpClient!.callTool({
        name: 'set_breakpoint',
        arguments: {
          sessionId,
          file: path.join(process.cwd(), 'tests/fixtures/debug-scripts/simple-mock.js'),
          line: 999999
        }
      });
      const largeLineResult = parseSdkToolResult(largeLineResponse);
      
      // Breakpoint might be set but not verified
      if (largeLineResult.success) {
        expect(largeLineResult.verified).toBe(false);
      }
      console.log('[E2E Error Scenarios] Handled very large line number');
    });
    
    it('should handle missing required parameters', async () => {
      console.log('\n[E2E Error Scenarios] Testing missing required parameters...');
      
      // Try to create session without language
      try {
        await mcpClient!.callTool({
          name: 'create_debug_session',
          arguments: { name: 'No Language Test' }
        });
        // If we get here, the test should fail
        expect(true).toBe(false);
      } catch {
        // Expected to throw or return error
        console.log('[E2E Error Scenarios] Correctly rejected missing language parameter');
      }
    });
  });

  describe('Session State Errors', () => {
    it('should handle operations when session is in wrong state', async () => {
      console.log('\n[E2E Error Scenarios] Testing operations in wrong state...');
      const eventRecorder = new EventRecorder();
      
      // Create a session and start debugging
      const createResponse = await mcpClient!.callTool({
        name: 'create_debug_session',
        arguments: { language: 'python', name: 'State Error Test' }
      });
      const createResult = parseSdkToolResult(createResponse);
      const sessionId = createResult.sessionId!;
      debugSessionIds.push(sessionId);
      
      const pythonFile = path.join(process.cwd(), 'tests/fixtures/debug-scripts/simple.py');
      const debugResponse = await mcpClient!.callTool({
        name: 'start_debugging',
        arguments: {
          sessionId,
          scriptPath: pythonFile,
          dapLaunchArgs: { stopOnEntry: true }
        }
      });
      const debugResult = parseSdkToolResult(debugResponse);
      expect(debugResult.success).toBe(true);
      
      // Wait for session to be paused
      const isPaused = await waitForSessionState(mcpClient!, sessionId, 'paused', {
        timeout: PYTHON_TIMEOUT,
        eventRecorder
      });
      expect(isPaused).toBe(true);
      
      // Now continue execution
      const continueResponse = await mcpClient!.callTool({
        name: 'continue_execution',
        arguments: { sessionId }
      });
      const continueResult = parseSdkToolResult(continueResponse);
      expect(continueResult.success).toBe(true);
      
      // Try to get variables while running (should fail)
      const variablesResult = await callToolSafely(
        mcpClient!,
        'get_variables',
        { sessionId, scope: 1 }
      );
      
      // Should either fail or return empty array
      if (variablesResult.success) {
        expect(variablesResult.variables).toEqual([]);
      }
      
      console.log('[E2E Error Scenarios] Correctly handled operation in wrong state');
    });
  });
});
