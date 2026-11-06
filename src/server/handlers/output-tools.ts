/**
 * Debuggee output tool: get_output.
 */
import type { ToolContext, ToolHandler } from '../tool-context.js';
import { failureResult, jsonResult, type ToolResult } from '../tool-result.js';
import { redactionSummary } from './shared.js';

export async function handleGetOutput(ctx: ToolContext, args: { sessionId: string; since?: number; limit?: number }): Promise<ToolResult> {
  // Deliberately no validateSession(): that rejects TERMINATED sessions, but
  // reading output after the program finished is the primary use case.
  // Output stays readable until close_debug_session removes the session.
  const session = ctx.sessionManager.getSession(args.sessionId);
  if (!session) {
    return failureResult(`Session not found: ${args.sessionId}`);
  }
  const since = Math.max(0, args.since ?? 0);
  const limit = Math.min(Math.max(1, args.limit ?? 100), 1000);
  const read = session.outputBuffer
    ? session.outputBuffer.read(since, limit)
    : { entries: [], nextSince: since, hasMore: false, dropped: 0 }; // session created but never launched
  const redaction = redactionSummary(read.entries);
  // A child whose adapter delivers the tree's output on the launch session
  // only (js-debug, issue #1082): say where to read instead of answering an
  // empty page as if the process printed nothing.
  const outputOn = ctx.sessionManager.outputOnFor(args.sessionId);
  return jsonResult({
    success: true,
    sessionId: args.sessionId,
    entries: read.entries,
    nextSince: read.nextSince,
    hasMore: read.hasMore,
    dropped: read.dropped,
    ...(redaction ? { redaction } : {}),
    ...(outputOn ? { outputOn, note: outputOnNote(outputOn) } : {})
  });
}

/** The one sentence a child answers with when its output lives on the launch session (issue #1082). */
export function outputOnNote(outputOn: string): string {
  return `This process's output is on its launch session's buffer (session ${outputOn}); this adapter attributes none of it to the child.`;
}

export const getOutputTool: ToolHandler = async (ctx, args) => {
  return await handleGetOutput(ctx, args as { sessionId: string; since?: number; limit?: number });
};
