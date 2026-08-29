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
 * How a catch block recognizes "the session is gone / not usable" — the two
 * dialects in this server are NOT interchangeable and must never be unified:
 *
 * - 'typed'  matches the typed error classes, so ProxyNotRunningError counts
 *            (its message, `Cannot X: no active proxy...`, matches no sniff).
 * - 'session-state' string-sniffs an McpError the way the breakpoint and
 *            launch tools do: terminated / closed / (not found AND Session).
 * - 'session-state-or-not-paused' is the looser sniff used by
 *            evaluate_expression and get_local_variables: bare `not found`
 *            counts, and so does `not paused`.
 */
export type SessionErrorSniff = 'typed' | 'session-state' | 'session-state-or-not-paused';

/** The typed session-lifecycle errors thrown by the session layer. */
export function isTypedSessionError(
  error: unknown
): error is SessionTerminatedError | SessionNotFoundError | ProxyNotRunningError {
  return error instanceof SessionTerminatedError ||
    error instanceof SessionNotFoundError ||
    error instanceof ProxyNotRunningError;
}

/** The string-sniffing dialects, applied to McpError messages only. */
export function isSessionStateError(
  error: unknown,
  sniff: Exclude<SessionErrorSniff, 'typed'>
): error is McpError {
  if (!(error instanceof McpError)) {
    return false;
  }
  if (error.message.includes('terminated') || error.message.includes('closed')) {
    return true;
  }
  if (sniff === 'session-state-or-not-paused') {
    return error.message.includes('not found') || error.message.includes('not paused');
  }
  return error.message.includes('not found') && error.message.includes('Session');
}

/**
 * A {success: false} result for a session-lifecycle failure, or undefined when
 * the error is not one under this dialect (the caller applies its own fallback).
 */
export function sessionErrorToResult(
  error: unknown,
  sniff: SessionErrorSniff,
  extra?: Record<string, unknown>
): ToolResult | undefined {
  const matched = sniff === 'typed'
    ? isTypedSessionError(error)
    : isSessionStateError(error, sniff);
  return matched ? failureResult((error as Error).message, extra) : undefined;
}

/**
 * sessionErrorToResult with the most common fallback: re-throw anything the
 * dialect does not recognize.
 */
export function sessionErrorResultOrThrow(
  error: unknown,
  sniff: SessionErrorSniff,
  extra?: Record<string, unknown>
): ToolResult {
  const result = sessionErrorToResult(error, sniff, extra);
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
  throw new McpError(
    McpErrorCode.InternalError,
    `${prefix}: ${error instanceof Error ? error.message : String(error)}`
  );
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
