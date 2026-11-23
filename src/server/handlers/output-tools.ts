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
  // A child whose adapter delivers the tree's stdout and stderr on the
  // launch session only (js-debug, issue #1082): say where those are read
  // instead of answering as if the process printed nothing. What is listed
  // here is the debugger's own for that process (issue #1212).
  const outputOn = ctx.sessionManager.outputOnFor(args.sessionId);
  // The tree, as every tree answer lists it (issue #1212): a session's
  // logpoint lines are on the session that hit them, so a caller reading
  // one buffer is told in the same answer which other sessions exist.
  const children = ctx.sessionManager.treeChildrenOf(args.sessionId);
  return jsonResult({
    success: true,
    sessionId: args.sessionId,
    entries: read.entries,
    nextSince: read.nextSince,
    hasMore: read.hasMore,
    dropped: read.dropped,
    ...(redaction ? { redaction } : {}),
    ...(outputOn ? { outputOn, note: outputOnNote(outputOn) } : {}),
    ...(children ? { children } : {})
  });
}

/**
 * What a child answers with when its adapter attributes no program output
 * to it (js-debug, issue #1082): where what it writes can be read, and what
 * the entries of this answer are (issue #1212). Two cases, both said,
 * because the session cannot tell which one its process is: inherited
 * stdio lands on the launch session's buffer; a pipe (`fork` with
 * `silent: true`, `spawn` with `stdio: 'pipe'`) is read by the parent
 * process and by nobody else, the debugger included. The old sentence
 * said "on its launch session's buffer" for both, which was false for the
 * second.
 */
export function outputOnNote(outputOn: string): string {
  return `This adapter attributes no stdout or stderr to a child process: what this process writes to inherited stdio is on its launch session's buffer (session ${outputOn}), and what it writes to a pipe is read by its parent process only. The entries here are the debugger's own for this process: the lines of the logpoints it hit, and notices.`;
}

export const getOutputTool: ToolHandler = async (ctx, args) => {
  return await handleGetOutput(ctx, args as { sessionId: string; since?: number; limit?: number });
};
