/**
 * Tool result shape and the plumbing every handler shares: the JSON result
 * envelopes, the catch-block helpers that turn session-lifecycle failures into
 * {success: false} payloads, and the request/response helpers used by the
 * CallTool dispatch (request sanitizing for logs, payload-success extraction
 * for the tool:response log line).
 */
import { ErrorCode as McpErrorCode, McpError, ServerResult } from '@modelcontextprotocol/sdk/types.js';
import path from 'path';
import {
  getErrorMessage,
  SessionNotFoundError,
  SessionTerminatedError,
  ProxyNotRunningError
} from '../errors/debug-errors.js';

/** The single text-content result every tool handler produces. */
export type ToolResult = { content: [{ type: 'text'; text: string }] };

/** Wrap a JSON-serializable payload as a tool result. */
export function jsonResult(payload: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(payload) }] };
}

/** Wrap a JSON-serializable payload as a pretty-printed (2-space) tool result. */
export function prettyJsonResult(payload: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
}

/**
 * The standard failure payload: {success: false, error} plus any tool-specific
 * fields, which follow `error` so key order matches the hand-written literals
 * these helpers replaced.
 */
export function failureResult(message: string, extra?: Record<string, unknown>): ToolResult {
  return jsonResult({ success: false, error: message, ...extra });
}

/**
 * The typed session-lifecycle errors thrown by the session layer.
 * @internal exported for the classification tests; handlers go through
 * sessionErrorToResult / sessionErrorResultOrThrow.
 */
export function isTypedSessionError(
  error: unknown
): error is SessionTerminatedError | SessionNotFoundError | ProxyNotRunningError {
  return error instanceof SessionTerminatedError ||
    error instanceof SessionNotFoundError ||
    error instanceof ProxyNotRunningError;
}

/**
 * A {success: false} result for a session-lifecycle failure, or undefined when
 * the error is not a typed session failure (the caller applies its own fallback).
 */
export function sessionErrorToResult(
  error: unknown,
  extra?: Record<string, unknown>
): ToolResult | undefined {
  return isTypedSessionError(error) ? failureResult(error.message, extra) : undefined;
}

/**
 * sessionErrorToResult with the most common fallback: re-throw anything the
 * dialect does not recognize.
 */
export function sessionErrorResultOrThrow(
  error: unknown,
  extra?: Record<string, unknown>
): ToolResult {
  const result = sessionErrorToResult(error, extra);
  if (result) {
    return result;
  }
  throw error;
}

/**
 * Fallback for the tools that report unexpected failures as an MCP protocol
 * error: an McpError passes through untouched, anything else is wrapped as
 * InternalError with the tool's own prefix.
 */
export function rethrowAsMcpError(error: unknown, prefix: string): never {
  if (error instanceof McpError) {
    throw error;
  }
  throw new McpError(McpErrorCode.InternalError, `${prefix}: ${getErrorMessage(error)}`);
}

/**
 * Sanitize request data for logging (remove sensitive information)
 */
export function sanitizeRequest(args: Record<string, unknown>): Record<string, unknown> {
  const sanitized = { ...args };
  // Remove absolute paths from executablePath
  if (sanitized.executablePath && typeof sanitized.executablePath === 'string' && path.isAbsolute(sanitized.executablePath)) {
    sanitized.executablePath = '<absolute-path>';
  }
  // Truncate long arrays
  if (sanitized.args && Array.isArray(sanitized.args) && sanitized.args.length > 5) {
    sanitized.args = [...sanitized.args.slice(0, 5), `... +${sanitized.args.length - 5} more`];
  }
  return sanitized;
}

/**
 * Derive the success flag for the tool:response log line from the tool's own
 * payload. Handlers report failures as { success: false } inside the JSON
 * text content without throwing; the log line must agree with the payload
 * rather than meaning merely "the handler didn't throw" (issue #397).
 */
export function extractPayloadSuccess(result: ServerResult): boolean {
  try {
    const content = (result as { content?: Array<{ type?: string; text?: string }> }).content;
    const first = content?.[0];
    if (first?.type === 'text' && typeof first.text === 'string') {
      const payload = JSON.parse(first.text) as unknown;
      if (payload && typeof payload === 'object' && typeof (payload as { success?: unknown }).success === 'boolean') {
        return (payload as { success: boolean }).success;
      }
    }
  } catch {
    // Non-JSON payloads carry no success flag; treat handler completion as success.
  }
  return true;
}
