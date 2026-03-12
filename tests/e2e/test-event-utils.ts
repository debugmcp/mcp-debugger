/**
 * Event-based waiting utilities for E2E tests
 * 
 * Since MCP server doesn't expose DAP events directly, these utilities
 * poll the session state intelligently to detect when events have occurred.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { parseSdkToolResult, ParsedToolResult } from './smoke-test-utils.js';

/**
 * Options for waiting functions
 */
export interface WaitOptions {
  timeout?: number;
  pollInterval?: number;
}

/**
 * Default timeout values
 */
export const DEFAULT_TIMEOUT = 5000;
export const PYTHON_TIMEOUT = 10000;  // Python operations can be slower
const DEFAULT_POLL_INTERVAL = 100;

// Get timeout multiplier from environment for CI
const TIMEOUT_MULTIPLIER = process.env.TEST_TIMEOUT_MULTIPLIER 
  ? parseFloat(process.env.TEST_TIMEOUT_MULTIPLIER) 
  : 1.0;

/**
 * Apply timeout multiplier for CI environments
 */
function getAdjustedTimeout(baseTimeout: number): number {
  return Math.round(baseTimeout * TIMEOUT_MULTIPLIER);
}

/**
 * Get session state from MCP server
 */
async function getSessionState(client: Client, sessionId: string): Promise<string | null> {
  try {
    const response = await client.callTool({
      name: 'list_debug_sessions',
      arguments: {}
    });
    const result = parseSdkToolResult(response);
    if (result.success && result.sessions) {
      const sessions = result.sessions as Array<{ id: string; state: string }>;
      const session = sessions.find(s => s.id === sessionId);
      if (!session) {
        console.log(`[EventUtils] Session ${sessionId} not found in sessions list. Available sessions:`, sessions.map(s => ({ id: s.id, state: s.state })));
      }
      return session?.state || null;
    }
    console.log('[EventUtils] Failed to get sessions list or no sessions found');
  } catch (error) {
    console.error('[EventUtils] Error getting session state:', error);
  }
  return null;
}

/**
 * Wait for session to reach a specific state
 */
export async function waitForSessionState(
  client: Client,
  sessionId: string,
  expectedState: string,
  options: WaitOptions = {}
): Promise<boolean> {
  const timeout = getAdjustedTimeout(options.timeout || DEFAULT_TIMEOUT);
  const pollInterval = options.pollInterval || DEFAULT_POLL_INTERVAL;
  const startTime = Date.now();
  
  console.log(`[EventUtils] Waiting for session ${sessionId} to reach state '${expectedState}'...`);
  
  while (Date.now() - startTime < timeout) {
    const currentState = await getSessionState(client, sessionId);

    if (currentState === expectedState) {
      console.log(`[EventUtils] Session ${sessionId} reached state '${expectedState}' after ${Date.now() - startTime}ms`);
      return true;
    }
    
    // Use exponential backoff for polling
    const elapsed = Date.now() - startTime;
    const backoffInterval = Math.min(pollInterval * (1 + elapsed / 1000), 500);
    await new Promise(resolve => setTimeout(resolve, backoffInterval));
  }
  
  // Timeout - get final state for error message
  const finalState = await getSessionState(client, sessionId);
  console.error(
    `[EventUtils] Timeout waiting for session ${sessionId} to reach state '${expectedState}'. ` +
    `Current state: '${finalState}'. Waited ${timeout}ms`
  );

  return false;
}

/**
 * Wait for a stopped event (session enters PAUSED state)
 */
export async function waitForStoppedEvent(
  client: Client,
  sessionId: string,
  options: WaitOptions = {}
): Promise<{ success: boolean; reason?: string }> {
  const success = await waitForSessionState(client, sessionId, 'paused', options);
  
  if (success) {
    // Try to determine the stop reason from the last operation
    // In a real implementation, we'd extract this from the DAP event
    return { success: true, reason: 'breakpoint' };  // Default assumption
  }
  
  return { success: false };
}

/**
 * Wait for continued event (session enters running state)
 */
export async function waitForContinuedEvent(
  client: Client,
  sessionId: string,
  options: WaitOptions = {}
): Promise<boolean> {
  return waitForSessionState(client, sessionId, 'running', options);
}

/**
 * Wait for terminated event (session enters stopped state)
 */
export async function waitForTerminatedEvent(
  client: Client,
  sessionId: string,
  options: WaitOptions = {}
): Promise<boolean> {
  return waitForSessionState(client, sessionId, 'stopped', options);
}

/**
 * Wait for any of multiple states
 */
export async function waitForAnyState(
  client: Client,
  sessionId: string,
  expectedStates: string[],
  options: WaitOptions = {}
): Promise<{ success: boolean; state?: string }> {
  const timeout = getAdjustedTimeout(options.timeout || DEFAULT_TIMEOUT);
  const pollInterval = options.pollInterval || DEFAULT_POLL_INTERVAL;
  const startTime = Date.now();
  
  console.log(`[EventUtils] Waiting for session ${sessionId} to reach any state: ${expectedStates.join(', ')}...`);
  
  while (Date.now() - startTime < timeout) {
    const currentState = await getSessionState(client, sessionId);

    if (currentState && expectedStates.includes(currentState)) {
      console.log(`[EventUtils] Session ${sessionId} reached state '${currentState}' after ${Date.now() - startTime}ms`);
      return { success: true, state: currentState };
    }
    
    // Use exponential backoff
    const elapsed = Date.now() - startTime;
    const backoffInterval = Math.min(pollInterval * (1 + elapsed / 1000), 500);
    await new Promise(resolve => setTimeout(resolve, backoffInterval));
  }
  
  // Timeout
  const finalState = await getSessionState(client, sessionId);
  console.error(
    `[EventUtils] Timeout waiting for session ${sessionId} to reach any of: ${expectedStates.join(', ')}. ` +
    `Current state: '${finalState}'. Waited ${timeout}ms`
  );

  return { success: false };
}

/**
 * Execute an operation and wait for the expected state change
 */
export async function executeAndWaitForState(
  client: Client,
  sessionId: string,
  operation: () => Promise<ParsedToolResult>,
  expectedState: string,
  options: WaitOptions = {}
): Promise<{ operationResult: ParsedToolResult; stateReached: boolean }> {
  // Record initial state
  const initialState = await getSessionState(client, sessionId);
  console.log(`[EventUtils] Initial state before operation: ${initialState}`);
  
  // Execute the operation
  const operationResult = await operation();
  
  // Wait for the expected state
  const stateReached = await waitForSessionState(client, sessionId, expectedState, options);
  
  return { operationResult, stateReached };
}

/**
 * Wait for a breakpoint to be hit after continue
 * This is a composite operation that waits for PAUSED state after continuing
 */
export async function waitForBreakpointHit(
  client: Client,
  sessionId: string,
  options: WaitOptions = {}
): Promise<boolean> {
  // After continue, we expect to hit a breakpoint and pause
  return waitForSessionState(client, sessionId, 'paused', {
    ...options,
    timeout: options.timeout || PYTHON_TIMEOUT  // Use longer timeout for Python
  });
}
