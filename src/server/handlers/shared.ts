/**
 * Helpers shared by more than one tool handler: the best-effort line-context
 * read, the redaction notice, the get_variables / get_local_variables payload
 * extras, and the attach warning both attach paths surface.
 */
import { isTerminalSessionState, REDACTION_NOTICE, SessionState, Variable } from '@debugmcp/shared';
import type { LineContext } from '../../utils/line-reader.js';
import { buildTruncationNotice, VariableTruncationSummary } from '../../session/variable-caps.js';
import type { ToolContext } from '../tool-context.js';
import { debuggerOffWhy } from '../../session/debugger-off.js';
import type { DebugResult } from '../../session/session-manager-core.js';

/**
 * Whether a session's recorded `lastStop` describes where it is now. The
 * model keeps the record across continue/step (the run-to-completion summary
 * and the PAUSED invariant depend on it), so a running session still holds
 * the stop it already left; only a paused session (the stop it is at) or a
 * terminal one (the last stop before it ended) should surface it (issue #720).
 *
 * `SessionStore.getAll()` already applies the same gate to the session
 * listing; this is the second line for handlers that read a ManagedSession
 * directly. `get_stack_trace` is one of those, and in practice only its
 * PAUSED arm can carry a stop: a terminal session is refused earlier
 * (SessionTerminatedError, or no proxy to ask), so that tool simply omits
 * `lastStop`/`stopReason` whenever the session is not paused.
 */
export function carriesLastStop(state: SessionState | undefined): boolean {
  return state === SessionState.PAUSED || isTerminalSessionState(state);
}

/**
 * The debugger-off why for a session the handler names by id (issue #749):
 * the gated sentence from `debuggerOffWhy`, or nothing when the session is
 * unknown or the decision does not apply.
 */
export function debuggerOffWhyFor(ctx: ToolContext, sessionId: string): string | undefined {
  const session = ctx.sessionManager.getSession(sessionId);
  return session ? debuggerOffWhy(session) : undefined;
}

/** The line-context slice the breakpoint and step payloads embed. */
export type EmbeddedLineContext = Pick<LineContext, 'lineContent' | 'surrounding'>;

/**
 * Read the source around a location for a response payload. Advisory: a
 * failure is logged at debug level (with the caller's label, so the two log
 * lines read the way they always have) and reported as no context, never as a
 * failed tool call.
 */
export async function readLineContext(
  ctx: ToolContext,
  file: string,
  line: number,
  logLabel: string
): Promise<EmbeddedLineContext | undefined> {
  try {
    const lineContext = await ctx.lineReader.getLineContext(file, line, { contextLines: 2 });
    if (lineContext) {
      return {
        lineContent: lineContext.lineContent,
        surrounding: lineContext.surrounding
      };
    }
  } catch (contextError) {
    // Log but don't fail if we can't get context
    ctx.logger.debug(`Could not get line context for ${logLabel}`, {
      file,
      line,
      error: contextError
    });
  }
  return undefined;
}

/**
 * Top-level `redaction` notice object for tool results (issue #237):
 * present when any returned item carries the session layer's `redacted`
 * flag, so the agent learns why values changed and how to opt out.
 */
export function redactionSummary(
  items: Array<{ redacted?: boolean }>
): { masked: number; notice: string } | undefined {
  const masked = items.filter(item => item.redacted).length;
  return masked > 0 ? { masked, notice: REDACTION_NOTICE } : undefined;
}

/**
 * The three optional decorations a variables payload carries: the names that
 * were asked for but not returned, the redaction notice, and the size-guard
 * summary with its advisory (issues #356/#359). Each is an independent
 * optional field, so a caller can splice them in one at a time: get_variables
 * spreads the whole object at the tail of its payload while
 * get_local_variables assigns the three in a different order. Neither key
 * order may change.
 */
export function variablePayloadExtras(
  variables: Variable[],
  names: string[] | undefined,
  truncation: VariableTruncationSummary | undefined
): {
  notFound?: string[];
  redaction?: { masked: number; notice: string };
  truncation?: VariableTruncationSummary & { notice: string };
} {
  const notFound = names
    ? names.filter(name => !variables.some(v => v.name === name))
    : undefined;
  const redaction = redactionSummary(variables);
  const truncationInfo = truncation
    ? { ...truncation, notice: buildTruncationNotice(truncation, variables) }
    : undefined;
  return {
    ...(notFound !== undefined ? { notFound } : {}),
    ...(redaction ? { redaction } : {}),
    ...(truncationInfo ? { truncation: truncationInfo } : {})
  };
}

/**
 * The advisory warning an operation's result carries, lifted to the top level
 * of the tool response — reported only on success, where it is advice rather
 * than the failure itself. On a failure the error is the message, and echoing
 * a warning beside it just competes with it.
 *
 * Shared by the two attach entry points (dropped adapterConfig keys, issue
 * #450) and by restart_debugging (stale anchors and unbound function
 * breakpoints), which is why it is named for the rule it applies rather than
 * for the first caller that needed it.
 */
export function successWarning(
  result: Pick<DebugResult, 'success' | 'data'>
): string | undefined {
  return result.success ? result.data?.warning : undefined;
}
