/**
 * Shared utilities for smoke tests
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { ServerResult } from '@modelcontextprotocol/sdk/types.js';

/**
 * Parse SDK tool results
 */
export interface ParsedToolResult {
  sessionId?: string;
  success?: boolean;
  state?: string;
  [key: string]: unknown;
}

export const parseSdkToolResult = (rawResult: ServerResult): ParsedToolResult => {
  const contentArray = (rawResult as { content?: Array<{ type: string; text: string }> }).content;
  if (!contentArray || !Array.isArray(contentArray) || contentArray.length === 0 || contentArray[0].type !== 'text') {
    console.error("Invalid ServerResult structure received from SDK:", rawResult);
    throw new Error('Invalid ServerResult structure from SDK or missing text content');
  }
  return JSON.parse(contentArray[0].text);
};

/**
 * Call MCP tool and handle errors gracefully
 */
export async function callToolSafely(
  mcpClient: Client,
  toolName: string,
  args: Record<string, unknown>
): Promise<ParsedToolResult> {
  try {
    const result = await mcpClient.callTool({
      name: toolName,
      arguments: args
    });
    return parseSdkToolResult(result);
  } catch (error) {
    // MCP errors have various formats
    const err = error as Error & { code?: string | number; data?: unknown };

    // Handle different error formats
    if (err.code ||
        err.message?.includes('MCP error') ||
        err.message?.includes('Session') ||
        err.message?.includes('not found') ||
        err.message?.includes('closed')) {
      return {
        success: false,
        message: err.message || 'Unknown MCP error',
        error: err.code
      };
    }

    // For any other error, assume it's an MCP-related error
    console.log('[callToolSafely] Caught error:', err.message);
    return {
      success: false,
      message: err.message || 'Unknown error'
    };
  }
}

/**
 * Execute common debug sequence for smoke tests
 */
export async function executeDebugSequence(
  mcpSdkClient: Client,
  scriptPath: string,
  sessionName: string,
  options?: {
    language?: string;
    breakpointLine?: number;
    breakpointFile?: string;
    dapLaunchArgs?: Record<string, unknown>;
  }
): Promise<{ sessionId: string; success: boolean }> {
  const language = options?.language ?? 'python';
  const breakpointLine = options?.breakpointLine ?? 32;
  const breakpointFile = options?.breakpointFile ?? scriptPath;
  const dapLaunchArgs = options?.dapLaunchArgs ?? { stopOnEntry: true };
  let debugSessionId: string | undefined;

  try {
    // 1. Create debug session
    console.log(`[Smoke Test] Creating debug session: ${sessionName}...`);
    const createCall = await mcpSdkClient.callTool({
      name: 'create_debug_session',
      arguments: { language, name: sessionName }
    });
    const createToolResponse = parseSdkToolResult(createCall);
    if (!createToolResponse.sessionId) {
      throw new Error('Failed to create debug session');
    }
    debugSessionId = createToolResponse.sessionId;
    console.log(`[Smoke Test] Debug session created: ${debugSessionId}`);

    // 2. Set breakpoint
    console.log('[Smoke Test] Setting breakpoint...');
    const breakpointCall = await mcpSdkClient.callTool({
      name: 'set_breakpoint',
      arguments: { sessionId: debugSessionId, file: breakpointFile, line: breakpointLine }
    });
    const breakpointResponse = parseSdkToolResult(breakpointCall);
    if (!breakpointResponse.success) {
      throw new Error('Failed to set breakpoint');
    }
    console.log('[Smoke Test] Breakpoint set.');

    // 3. Start debugging
    console.log('[Smoke Test] Starting debugging...');
    const debugCall = await mcpSdkClient.callTool({
      name: 'start_debugging',
      arguments: {
        sessionId: debugSessionId,
        scriptPath,
        dapLaunchArgs
      }
    });
    const debugResponse = parseSdkToolResult(debugCall);
    if (!debugResponse.success) {
      throw new Error(`Failed to start debugging: ${JSON.stringify(debugResponse)}`);
    }
    console.log(`[Smoke Test] Debugging started successfully. State: ${debugResponse.state}`);

    return { sessionId: debugSessionId, success: true };
  } catch (error) {
    console.error('[Smoke Test] Error during debug sequence:', error);
    // Clean up on error
    if (debugSessionId) {
      try {
        await mcpSdkClient.callTool({
          name: 'close_debug_session',
          arguments: { sessionId: debugSessionId }
        });
      } catch (e) {
        console.error(`[Smoke Test] Error closing debug session ${debugSessionId}:`, e);
      }
    }
    throw error;
  }
}

/**
 * Wait for SSE server to be ready by checking health endpoint
 */
export async function waitForHealthEndpoint(port: number, timeout: number = 10000): Promise<boolean> {
  const startTime = Date.now();
  const healthUrl = `http://localhost:${port}/health`;
  console.log(`[Smoke Test] Waiting for SSE server health at ${healthUrl}...`);

  while (Date.now() - startTime < timeout) {
    try {
      const response = await fetch(healthUrl);
      if (response.ok) {
        const healthStatus = await response.json();
        if (healthStatus.status === 'ok') {
          console.log('[Smoke Test] SSE server health check passed');
          return true;
        }
      }
    } catch {
      // Connection refused, server not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.error(`[Smoke Test] Timeout waiting for SSE server on port ${port}`);
  return false;
}
