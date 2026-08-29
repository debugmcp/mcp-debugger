/**
 * Tool result shape and the request/response plumbing helpers shared by the
 * CallTool dispatch: request sanitizing for logs and payload-success
 * extraction for the tool:response log line.
 */
import { ServerResult } from '@modelcontextprotocol/sdk/types.js';
import path from 'path';

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
