/**
 * MCP Debugger extensions to the DAP protocol
 * These are custom properties added by mcp-debugger for internal use
 */

import { DapCommandPayload } from './dap-proxy-interfaces.js';
import { AdapterSpecificState } from '@debugmcp/shared';

/**
 * Extended DapCommandPayload with optional silent flag
 * Used internally to inject commands without sending responses
 */
export interface SilentDapCommandPayload extends DapCommandPayload {
  __silent?: boolean;
}

/**
 * JavaScript adapter-specific state extensions
 */
export interface JsDebugAdapterState extends AdapterSpecificState {
  initializeResponded?: boolean;
}

/**
 * Helper function to safely extract error messages from unknown types
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

/**
 * Type guard to check if a response is an InitializeResponse
 */
export function isInitializeResponse(response: unknown): response is { body?: { capabilities?: Record<string, unknown> } } {
  return response !== null && 
         typeof response === 'object' && 
         'command' in response && 
         (response as { command: unknown }).command === 'initialize';
}

/**
 * Type guard to safely access thread information from responses
 */
export function hasThreadsBody(response: unknown): response is { body?: { threads?: Array<{ id?: number }> } } {
  if (!response || typeof response !== 'object') return false;
  if (!('body' in response)) return false;
  const body = (response as { body: unknown }).body;
  if (!body || typeof body !== 'object') return false;
  if (!('threads' in body)) return false;
  const threads = (body as { threads: unknown }).threads;
  return Array.isArray(threads);
}
