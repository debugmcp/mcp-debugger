/**
 * Debuggee output tool: get_output.
 */
import type { ToolContext, ToolHandler } from '../tool-context.js';
import { jsonResult, type ToolResult } from '../tool-result.js';
import { redactionSummary } from './shared.js';

export async function handleGetOutput(ctx: ToolContext, args: { sessionId: string; since?: number; limit?: number }): Promise<ToolResult> {
  // Deliberately no validateSession(): that rejects TERMINATED sessions, but
  // reading output after the program finished is the primary use case.
  // Output stays readable until close_debug_session removes the session.
  const session = ctx.sessionManager.getSession(args.sessionId);
  if (!session) {
    return jsonResult({ success: false, error: `Session not found: ${args.sessionId}` });
  }
  const since = Math.max(0, args.since ?? 0);
  const limit = Math.min(Math.max(1, args.limit ?? 100), 1000);
  const read = session.outputBuffer
    ? session.outputBuffer.read(since, limit)
    : { entries: [], nextSince: since, hasMore: false, dropped: 0 }; // session created but never launched
  const redaction = redactionSummary(read.entries);
  return jsonResult({
    success: true,
    sessionId: args.sessionId,
    entries: read.entries,
    nextSince: read.nextSince,
    hasMore: read.hasMore,
    dropped: read.dropped,
    ...(redaction ? { redaction } : {})
  });
}

export const getOutputTool: ToolHandler = async (ctx, args) => {
  return await handleGetOutput(ctx, args as { sessionId: string; since?: number; limit?: number });
};
