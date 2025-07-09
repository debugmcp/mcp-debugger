/**
 * Adapter Switching E2E Tests
 * Tests multiple concurrent sessions with different languages
 */
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import * as path from 'path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { parseSdkToolResult } from './smoke-test-utils.js';
import { 
  waitForSessionState, 
  EventRecorder,
  PYTHON_TIMEOUT,
  DEFAULT_TIMEOUT
} from './test-event-utils.js';

const TEST_TIMEOUT = 20000;

let mcpClient: Client | null = null;
let debugSessionIds: string[] = [];

describe('Adapter Switching E2E', () => {
  beforeEach(async () => {
    console.log('[E2E Adapter Switch] Setting up MCP client...');
    debugSessionIds = [];
    
    mcpClient = new Client({ name: "e2e-adapter-switch-test", version: "0.1.0" });
    
    const transport = new StdioClientTransport({
      command: 'node',
      args: [path.join(process.cwd(), 'dist', 'index.js'), 'stdio'],
    });
    
    transport.onerror = (error) => {
      console.error('[E2E Adapter Switch] Transport error:', error);
    };
    
    await mcpClient.connect(transport);
    console.log('[E2E Adapter Switch] MCP client connected.');
  });

  afterEach(async () => {
    // Clean up any remaining sessions
    for (const sessionId of debugSessionIds) {
      try {
        const response = await mcpClient!.callTool({
          name: 'close_debug_session',
          arguments: { sessionId }
        });
        const result = parseSdkToolResult(response);
        if (!result.success) {
          console.error(`[E2E Adapter Switch] Failed to close session ${sessionId}`);
        }
      } catch (e) {
        console.error(`[E2E Adapter Switch] Error cleaning up session ${sessionId}:`, e);
      }
    }
    
    // Close MCP client
    if (mcpClient) {
      await mcpClient.close();
      mcpClient = null;
    }
  });

  it('should handle multiple language sessions concurrently', async () => {
    console.log('\n[E2E Adapter Switch] Testing multiple language sessions...');
    const eventRecorder = new EventRecorder();
    
    // 1. Create Python session
    console.log('[E2E Adapter Switch] Creating Python session...');
    const pythonResponse = await mcpClient!.callTool({
      name: 'create_debug_session',
      arguments: { language: 'python', name: 'Python E2E Test' }
    });
    const pythonResult = parseSdkToolResult(pythonResponse);
    expect(pythonResult.success).toBe(true);
    expect(pythonResult.sessionId).toBeDefined();
    const pythonSessionId = pythonResult.sessionId!;
    debugSessionIds.push(pythonSessionId);
    console.log(`[E2E Adapter Switch] Python session created: ${pythonSessionId}`);
    
    // 2. Create Mock session
    console.log('[E2E Adapter Switch] Creating Mock session...');
    const mockResponse = await mcpClient!.callTool({
      name: 'create_debug_session',
      arguments: { language: 'mock', name: 'Mock E2E Test' }
    });
    const mockResult = parseSdkToolResult(mockResponse);
    expect(mockResult.success).toBe(true);
    expect(mockResult.sessionId).toBeDefined();
    const mockSessionId = mockResult.sessionId!;
    debugSessionIds.push(mockSessionId);
    console.log(`[E2E Adapter Switch] Mock session created: ${mockSessionId}`);
    
    // 3. List all sessions - should show both
    console.log('[E2E Adapter Switch] Listing all sessions...');
    const listResponse = await mcpClient!.callTool({
      name: 'list_debug_sessions',
      arguments: {}
    });
    const listResult = parseSdkToolResult(listResponse);
    expect(listResult.success).toBe(true);
    
    const sessions = listResult.sessions as Array<{ id: string; language: string; name: string }>;
    expect(sessions.length).toBeGreaterThanOrEqual(2);
    
    const pythonSession = sessions.find(s => s.id === pythonSessionId);
    const mockSession = sessions.find(s => s.id === mockSessionId);
    
    expect(pythonSession).toBeDefined();
    expect(pythonSession?.language).toBe('python');
    expect(pythonSession?.name).toBe('Python E2E Test');
    
    expect(mockSession).toBeDefined();
    expect(mockSession?.language).toBe('mock');
    expect(mockSession?.name).toBe('Mock E2E Test');
    
    console.log(`[E2E Adapter Switch] Found ${sessions.length} sessions`);
    
    // 4. Set breakpoints in both sessions
    console.log('[E2E Adapter Switch] Setting breakpoints in Python session...');
    const pythonBreakpointResponse = await mcpClient!.callTool({
      name: 'set_breakpoint',
      arguments: {
        sessionId: pythonSessionId,
        file: path.join(process.cwd(), 'tests/fixtures/debug-scripts/simple.py'),
        line: 4
      }
    });
    const pythonBreakpointResult = parseSdkToolResult(pythonBreakpointResponse);
    expect(pythonBreakpointResult.success).toBe(true);
    
    console.log('[E2E Adapter Switch] Setting breakpoints in Mock session...');
    const mockBreakpointResponse = await mcpClient!.callTool({
      name: 'set_breakpoint',
      arguments: {
        sessionId: mockSessionId,
        file: path.join(process.cwd(), 'tests/fixtures/debug-scripts/simple-mock.js'),
        line: 4
      }
    });
    const mockBreakpointResult = parseSdkToolResult(mockBreakpointResponse);
    expect(mockBreakpointResult.success).toBe(true);
    
    // 5. Start debugging in both sessions
    console.log('[E2E Adapter Switch] Starting debugging in Python session...');
    const pythonDebugResponse = await mcpClient!.callTool({
      name: 'start_debugging',
      arguments: {
        sessionId: pythonSessionId,
        scriptPath: path.join(process.cwd(), 'tests/fixtures/debug-scripts/simple.py'),
        dapLaunchArgs: { stopOnEntry: true }
      }
    });
    const pythonDebugResult = parseSdkToolResult(pythonDebugResponse);
    expect(pythonDebugResult.success).toBe(true);
    
    // Wait for Python session to be paused
    const pythonPaused = await waitForSessionState(mcpClient!, pythonSessionId, 'paused', {
      timeout: PYTHON_TIMEOUT,
      eventRecorder
    });
    expect(pythonPaused).toBe(true);
    
    console.log('[E2E Adapter Switch] Starting debugging in Mock session...');
    const mockDebugResponse = await mcpClient!.callTool({
      name: 'start_debugging',
      arguments: {
        sessionId: mockSessionId,
        scriptPath: path.join(process.cwd(), 'tests/fixtures/debug-scripts/simple-mock.js'),
        dapLaunchArgs: { stopOnEntry: true }
      }
    });
    const mockDebugResult = parseSdkToolResult(mockDebugResponse);
    expect(mockDebugResult.success).toBe(true);
    
    // Wait for Mock session to be paused
    const mockPaused = await waitForSessionState(mcpClient!, mockSessionId, 'paused', {
      timeout: DEFAULT_TIMEOUT,
      eventRecorder
    });
    expect(mockPaused).toBe(true);
    
    // 6. Continue execution in both
    console.log('[E2E Adapter Switch] Continuing execution in both sessions...');
    
    const pythonContinueResponse = await mcpClient!.callTool({
      name: 'continue_execution',
      arguments: { sessionId: pythonSessionId }
    });
    const pythonContinueResult = parseSdkToolResult(pythonContinueResponse);
    expect(pythonContinueResult.success).toBe(true);
    
    const mockContinueResponse = await mcpClient!.callTool({
      name: 'continue_execution',
      arguments: { sessionId: mockSessionId }
    });
    const mockContinueResult = parseSdkToolResult(mockContinueResponse);
    expect(mockContinueResult.success).toBe(true);
    
    // 7. Close both sessions
    console.log('[E2E Adapter Switch] Closing both sessions...');
    
    const pythonCloseResponse = await mcpClient!.callTool({
      name: 'close_debug_session',
      arguments: { sessionId: pythonSessionId }
    });
    const pythonCloseResult = parseSdkToolResult(pythonCloseResponse);
    expect(pythonCloseResult.success).toBe(true);
    debugSessionIds = debugSessionIds.filter(id => id !== pythonSessionId);
    
    const mockCloseResponse = await mcpClient!.callTool({
      name: 'close_debug_session',
      arguments: { sessionId: mockSessionId }
    });
    const mockCloseResult = parseSdkToolResult(mockCloseResponse);
    expect(mockCloseResult.success).toBe(true);
    debugSessionIds = debugSessionIds.filter(id => id !== mockSessionId);
    
    console.log('[E2E Adapter Switch] Multiple language sessions test completed!');
  }, TEST_TIMEOUT);
  
  it('should maintain session isolation between languages', async () => {
    console.log('\n[E2E Adapter Switch] Testing session isolation...');
    const eventRecorder = new EventRecorder();
    
    // Create sessions
    const pythonResponse = await mcpClient!.callTool({
      name: 'create_debug_session',
      arguments: { language: 'python', name: 'Python Isolation Test' }
    });
    const pythonResult = parseSdkToolResult(pythonResponse);
    const pythonSessionId = pythonResult.sessionId!;
    debugSessionIds.push(pythonSessionId);
    
    const mockResponse = await mcpClient!.callTool({
      name: 'create_debug_session',
      arguments: { language: 'mock', name: 'Mock Isolation Test' }
    });
    const mockResult = parseSdkToolResult(mockResponse);
    const mockSessionId = mockResult.sessionId!;
    debugSessionIds.push(mockSessionId);
    
    // Try to use Python session ID with mock-specific operations (should still work as session tracks its language)
    const pythonFile = path.join(process.cwd(), 'tests/fixtures/debug-scripts/simple.py');
    const breakpointResponse = await mcpClient!.callTool({
      name: 'set_breakpoint',
      arguments: {
        sessionId: pythonSessionId,
        file: pythonFile,
        line: 4
      }
    });
    const breakpointResult = parseSdkToolResult(breakpointResponse);
    expect(breakpointResult.success).toBe(true);
    
    // Start debugging with correct script for each session
    const pythonDebugResponse = await mcpClient!.callTool({
      name: 'start_debugging',
      arguments: {
        sessionId: pythonSessionId,
        scriptPath: pythonFile,
        dapLaunchArgs: { stopOnEntry: false }
      }
    });
    const pythonDebugResult = parseSdkToolResult(pythonDebugResponse);
    expect(pythonDebugResult.success).toBe(true);
    
    // Wait for session to hit breakpoint or start running
    const sessionReady = await waitForSessionState(mcpClient!, pythonSessionId, 'paused', {
      timeout: PYTHON_TIMEOUT,
      eventRecorder
    }) || await waitForSessionState(mcpClient!, pythonSessionId, 'running', {
      timeout: 100,
      eventRecorder
    });
    expect(sessionReady).toBe(true);
    
    // Clean up
    await mcpClient!.callTool({
      name: 'close_debug_session',
      arguments: { sessionId: pythonSessionId }
    });
    await mcpClient!.callTool({
      name: 'close_debug_session',
      arguments: { sessionId: mockSessionId }
    });
    debugSessionIds = [];
    
    console.log('[E2E Adapter Switch] Session isolation test completed!');
  }, TEST_TIMEOUT);
});
