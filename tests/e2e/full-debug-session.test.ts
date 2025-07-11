/**
 * Comprehensive End-to-End Debug Session Tests
 * Tests the complete debugging workflow for all supported languages
 */
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import * as path from 'path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { parseSdkToolResult, ParsedToolResult } from './smoke-test-utils.js';
import { 
  waitForSessionState, 
  waitForBreakpointHit,
  smartWaitAfterOperation,
  EventRecorder,
  PYTHON_TIMEOUT,
  DEFAULT_TIMEOUT
} from './test-event-utils.js';

const TEST_TIMEOUT = 30000;

// Test configurations for each language
const testConfigs = {
  python: {
    language: 'python',
    scriptPath: 'tests/fixtures/debug-scripts/simple.py',
    breakpoints: [4, 6, 8],  // Lines with actual code
    expectedVariables: { x: '10', y: '20', result: '30' },
    requiresRuntime: true  // Tags test with @requires-python
  },
  mock: {
    language: 'mock',
    scriptPath: 'tests/fixtures/debug-scripts/simple-mock.js',  // Mock "script"
    breakpoints: [4, 6, 8],  // Simulated breakpoints
    expectedVariables: { x: '10', y: '20', result: '30' },  // Mock will return these
    requiresRuntime: false  // Always available
  }
};

// MCP client instance
let mcpClient: Client | null = null;
let debugSessionIds: string[] = [];


/**
 * Helper to create a debug session
 */
async function createDebugSession(language: string, name?: string): Promise<string> {
  const response = await mcpClient!.callTool({
    name: 'create_debug_session',
    arguments: { language, name: name || `${language}-e2e-test` }
  });
  const result = parseSdkToolResult(response);
  expect(result.success).toBe(true);
  expect(result.sessionId).toBeDefined();
  debugSessionIds.push(result.sessionId!);
  return result.sessionId!;
}

/**
 * Helper to set breakpoints
 */
async function setBreakpoints(sessionId: string, scriptPath: string, lines: number[]): Promise<void> {
  const fullPath = path.join(process.cwd(), scriptPath);
  for (const line of lines) {
    const response = await mcpClient!.callTool({
      name: 'set_breakpoint',
      arguments: { sessionId, file: fullPath, line }
    });
    const result = parseSdkToolResult(response);
    expect(result.success).toBe(true);
    // Breakpoints are not verified until debugging starts
    expect(result.breakpointId).toBeDefined();
  }
}

/**
 * Helper to start debugging
 */
async function startDebugging(sessionId: string, scriptPath: string): Promise<ParsedToolResult> {
  const fullPath = path.join(process.cwd(), scriptPath);
  const response = await mcpClient!.callTool({
    name: 'start_debugging',
    arguments: {
      sessionId,
      scriptPath: fullPath,
      dapLaunchArgs: { stopOnEntry: true }
    }
  });
  return parseSdkToolResult(response);
}

/**
 * Helper to get variables
 */
async function getVariables(sessionId: string, scope: number): Promise<Record<string, string>> {
  const response = await mcpClient!.callTool({
    name: 'get_variables',
    arguments: { sessionId, scope }
  });
  const result = parseSdkToolResult(response);
  expect(result.success).toBe(true);
  
  const variables = result.variables as Array<{ name: string; value: string }>;
  const varMap: Record<string, string> = {};
  variables.forEach(v => {
    varMap[v.name] = v.value;
  });
  return varMap;
}

/**
 * Helper to continue execution
 */
async function continueExecution(sessionId: string): Promise<void> {
  const response = await mcpClient!.callTool({
    name: 'continue_execution',
    arguments: { sessionId }
  });
  const result = parseSdkToolResult(response);
  expect(result.success).toBe(true);
}

/**
 * Helper to step over
 */
async function stepOver(sessionId: string): Promise<void> {
  const response = await mcpClient!.callTool({
    name: 'step_over',
    arguments: { sessionId }
  });
  const result = parseSdkToolResult(response);
  expect(result.success).toBe(true);
}

/**
 * Helper to step into
 */
async function stepInto(sessionId: string): Promise<void> {
  const response = await mcpClient!.callTool({
    name: 'step_into',
    arguments: { sessionId }
  });
  const result = parseSdkToolResult(response);
  expect(result.success).toBe(true);
}

/**
 * Helper to step out
 */
async function stepOut(sessionId: string): Promise<void> {
  const response = await mcpClient!.callTool({
    name: 'step_out',
    arguments: { sessionId }
  });
  const result = parseSdkToolResult(response);
  expect(result.success).toBe(true);
}

interface StackFrame {
  id: number;
  name: string;
  line: number;
  source?: { path: string };
}

/**
 * Helper to get stack trace
 */
async function getStackTrace(sessionId: string): Promise<StackFrame[]> {
  const response = await mcpClient!.callTool({
    name: 'get_stack_trace',
    arguments: { sessionId }
  });
  const result = parseSdkToolResult(response);
  expect(result.success).toBe(true);
  return result.stackFrames as StackFrame[];
}

interface Scope {
  name: string;
  variablesReference: number;
  expensive?: boolean;
}

/**
 * Helper to get scopes
 */
async function getScopes(sessionId: string, frameId: number): Promise<Scope[]> {
  const response = await mcpClient!.callTool({
    name: 'get_scopes',
    arguments: { sessionId, frameId }
  });
  const result = parseSdkToolResult(response);
  expect(result.success).toBe(true);
  return result.scopes as Scope[];
}

/**
 * Helper to close debug session
 */
async function closeDebugSession(sessionId: string): Promise<void> {
  const response = await mcpClient!.callTool({
    name: 'close_debug_session',
    arguments: { sessionId }
  });
  const result = parseSdkToolResult(response);
  expect(result.success).toBe(true);
  
  // Remove from tracking
  debugSessionIds = debugSessionIds.filter(id => id !== sessionId);
}

describe('Full Debug Session E2E', () => {
  beforeEach(async () => {
    console.log('[E2E Full Debug] Setting up MCP client...');
    debugSessionIds = [];
    
    mcpClient = new Client({ name: "e2e-full-debug-test", version: "0.1.0" });
    
    const transport = new StdioClientTransport({
      command: 'node',
      args: [path.join(process.cwd(), 'dist', 'index.js'), 'stdio'],
    });
    
    // Capture stderr for debugging
    transport.onerror = (error) => {
      console.error('[E2E Full Debug] Transport error:', error);
    };
    
    await mcpClient.connect(transport);
    console.log('[E2E Full Debug] MCP client connected.');
  });

  afterEach(async () => {
    // Clean up any remaining sessions
    for (const sessionId of debugSessionIds) {
      try {
        await closeDebugSession(sessionId);
      } catch (e) {
        console.error(`[E2E Full Debug] Error cleaning up session ${sessionId}:`, e);
      }
    }
    
    // Close MCP client
    if (mcpClient) {
      await mcpClient.close();
      mcpClient = null;
    }
  });

  // Test each language configuration
  Object.entries(testConfigs).forEach(([langName, config]) => {
    describe(`${langName} debugging`, () => {
      // TODO: Add tags when Vitest supports them properly: ['@requires-python', '@requires-real-debugpy']
      it('should complete full debugging workflow', async () => {
        console.log(`\n[E2E Full Debug] Testing ${langName} debugging workflow...`);
        const eventRecorder = new EventRecorder();
        
        // 1. Create debug session
        console.log(`[E2E Full Debug] Creating ${langName} session...`);
        const sessionId = await createDebugSession(config.language);
        console.log(`[E2E Full Debug] Session created: ${sessionId}`);
        
        // 2. Set breakpoints
        console.log(`[E2E Full Debug] Setting breakpoints at lines: ${config.breakpoints.join(', ')}`);
        await setBreakpoints(sessionId, config.scriptPath, config.breakpoints);
        
        // 3. Start debugging
        console.log(`[E2E Full Debug] Starting debugging...`);
        const debugResult = await startDebugging(sessionId, config.scriptPath);
        expect(debugResult.success).toBe(true);
        expect(debugResult.state).toBe('paused'); // Should be paused due to stopOnEntry
        
        // 4. Continue to first breakpoint
        console.log(`[E2E Full Debug] Continuing to first breakpoint...`);
        await continueExecution(sessionId);
        
        // Wait for the debugger to stop at breakpoint (event-based)
        const stoppedAtBreakpoint = await waitForBreakpointHit(mcpClient!, sessionId, {
          timeout: config.language === 'python' ? PYTHON_TIMEOUT : DEFAULT_TIMEOUT,
          eventRecorder
        });
        expect(stoppedAtBreakpoint).toBe(true);
        
        // 5. Get stack trace
        console.log(`[E2E Full Debug] Getting stack trace...`);
        const stackFrames = await getStackTrace(sessionId);
        expect(stackFrames.length).toBeGreaterThan(0);
        const topFrame = stackFrames[0];
        console.log(`[E2E Full Debug] Top frame: ${topFrame.name} at line ${topFrame.line}`);
        
        // 6. Get scopes
        console.log(`[E2E Full Debug] Getting scopes for frame ${topFrame.id}...`);
        const scopes = await getScopes(sessionId, topFrame.id);
        expect(scopes.length).toBeGreaterThan(0);
        const localScope = scopes.find((s) => s.name === 'Locals' || s.name === 'Local');
        expect(localScope).toBeDefined();
        
        // 7. Inspect variables
        if (localScope) {
          console.log(`[E2E Full Debug] Inspecting variables...`);
          const variables = await getVariables(sessionId, localScope.variablesReference);
          console.log(`[E2E Full Debug] Variables:`, variables);
          
          // Check for expected variables (may not all be present at first breakpoint)
          if (variables.x) {
            expect(variables.x).toBe(config.expectedVariables.x);
          }
        }
        
        // 8. Step over
        console.log(`[E2E Full Debug] Stepping over...`);
        await stepOver(sessionId);
        
        // Wait for step to complete
        const steppedOver = await smartWaitAfterOperation(mcpClient!, sessionId, 'step_over', {
          timeout: DEFAULT_TIMEOUT,
          eventRecorder
        });
        expect(steppedOver.success).toBe(true);
        expect(steppedOver.finalState).toBe('paused');
        
        // 9. Continue to next breakpoint
        console.log(`[E2E Full Debug] Continuing to next breakpoint...`);
        await continueExecution(sessionId);
        
        // Wait for next breakpoint or program end
        const continuedResult = await smartWaitAfterOperation(mcpClient!, sessionId, 'continue', {
          timeout: config.language === 'python' ? PYTHON_TIMEOUT : DEFAULT_TIMEOUT,
          eventRecorder
        });
        expect(continuedResult.success).toBe(true);
        
        // 10. Step operations (only if still paused)
        if (continuedResult.finalState === 'paused') {
          console.log(`[E2E Full Debug] Testing step into...`);
          await stepInto(sessionId);
          
          const steppedInto = await smartWaitAfterOperation(mcpClient!, sessionId, 'step_into', {
            timeout: DEFAULT_TIMEOUT,
            eventRecorder
          });
          expect(steppedInto.success).toBe(true);
          
          console.log(`[E2E Full Debug] Testing step out...`);
          await stepOut(sessionId);
          
          const steppedOut = await smartWaitAfterOperation(mcpClient!, sessionId, 'step_out', {
            timeout: DEFAULT_TIMEOUT,
            eventRecorder
          });
          expect(steppedOut.success).toBe(true);
        }
        
        // 11. Continue to completion
        console.log(`[E2E Full Debug] Continuing to completion...`);
        await continueExecution(sessionId);
        
        // Wait for program to terminate
        const terminated = await waitForSessionState(mcpClient!, sessionId, 'stopped', {
          timeout: config.language === 'python' ? PYTHON_TIMEOUT : DEFAULT_TIMEOUT,
          eventRecorder
        });
        
        // It's OK if the program was already terminated
        if (!terminated) {
          console.log(`[E2E Full Debug] Program may have already completed`);
        }
        
        // 12. Close session
        console.log(`[E2E Full Debug] Closing session...`);
        await closeDebugSession(sessionId);
        
        console.log(`[E2E Full Debug] ${langName} debugging workflow completed successfully!`);
        
        // If test failed, dump events for debugging
        if (eventRecorder.getEventSequence().length > 0) {
          console.log(`[E2E Full Debug] Event sequence:`, eventRecorder.getEventSequence());
        }
      }, TEST_TIMEOUT);
      
      it('should handle multiple breakpoints correctly', async () => {
        console.log(`\n[E2E Full Debug] Testing ${langName} multiple breakpoints...`);
        const eventRecorder = new EventRecorder();
        
        const sessionId = await createDebugSession(config.language);
        
        // Set all breakpoints
        await setBreakpoints(sessionId, config.scriptPath, config.breakpoints);
        
        // Start debugging without stopOnEntry
        const fullPath = path.join(process.cwd(), config.scriptPath);
        const response = await mcpClient!.callTool({
          name: 'start_debugging',
          arguments: {
            sessionId,
            scriptPath: fullPath,
            dapLaunchArgs: { stopOnEntry: false }
          }
        });
        const result = parseSdkToolResult(response);
        expect(result.success).toBe(true);
        
        // Should run to first breakpoint
        const hitFirstBreakpoint = await waitForBreakpointHit(mcpClient!, sessionId, {
          timeout: config.language === 'python' ? PYTHON_TIMEOUT : DEFAULT_TIMEOUT,
          eventRecorder
        });
        expect(hitFirstBreakpoint).toBe(true);
        
        // Continue through all breakpoints
        for (let i = 0; i < config.breakpoints.length - 1; i++) {
          console.log(`[E2E Full Debug] At breakpoint ${i + 1}/${config.breakpoints.length}`);
          await continueExecution(sessionId);
          
          // Wait for next breakpoint or program end
          const result = await smartWaitAfterOperation(mcpClient!, sessionId, 'continue', {
            timeout: config.language === 'python' ? PYTHON_TIMEOUT : DEFAULT_TIMEOUT,
            eventRecorder
          });
          expect(result.success).toBe(true);
          
          // If program ended, we're done
          if (result.finalState === 'stopped') {
            console.log(`[E2E Full Debug] Program completed after breakpoint ${i + 1}`);
            break;
          }
        }
        
        // Final continue to exit (if not already exited)
        const currentState = await waitForSessionState(mcpClient!, sessionId, 'paused', { timeout: 100 });
        if (currentState) {
          console.log(`[E2E Full Debug] Session still paused, continuing to completion...`);
          await continueExecution(sessionId);
          
          // Wait for either stopped or terminated state
          const result = await smartWaitAfterOperation(mcpClient!, sessionId, 'continue', {
            timeout: DEFAULT_TIMEOUT,
            eventRecorder
          });
          
          console.log(`[E2E Full Debug] Final continue result: ${JSON.stringify(result)}`);
          expect(result.success).toBe(true);
        } else {
          console.log(`[E2E Full Debug] Session already completed`);
        }
        
        await closeDebugSession(sessionId);
        console.log(`[E2E Full Debug] Multiple breakpoints test completed!`);
      }, TEST_TIMEOUT);
    });
  });
  
  // Language-agnostic tests
  describe('Language support', () => {
    it('should list supported languages including python and mock', async () => {
      const response = await mcpClient!.callTool({
        name: 'list_supported_languages',
        arguments: {}
      });
      const result = parseSdkToolResult(response);
      expect(result.success).toBe(true);
      
      const languages = result.languages as Array<{ id: string }>;
      const languageIds = languages.map(l => l.id);
      
      expect(languageIds).toContain('python');
      expect(languageIds).toContain('mock');
      expect(languageIds).not.toContain('javascript'); // Should not be registered anymore
    });
  });
});
