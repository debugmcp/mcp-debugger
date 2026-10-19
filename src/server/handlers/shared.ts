/**
 * Helpers shared by more than one tool handler: the best-effort line-context
 * read, the redaction notice, the get_variables / get_local_variables payload
 * extras, the attach warning both attach paths surface, and the one
 * AttachRequest both attach entry points send.
 */
import { isSettledSessionState, REDACTION_NOTICE, SessionState, Variable } from '@debugmcp/shared';
import type { LineContext } from '../../utils/line-reader.js';
import { buildTruncationNotice, VariableTruncationSummary } from '../../session/variable-caps.js';
import type { ToolContext } from '../tool-context.js';
import type { ToolArguments } from '../tool-arguments.js';
import { validateBreakOnExceptions } from '../tool-validation.js';
import { debuggerOffWhy } from '../../session/debugger-off.js';
import type { DebugResult, StopLandingFields } from '../../session/session-manager-core.js';
import type { AttachRequest } from '../../session/attach/attach-controller.js';
import type { ManagedSession } from '../../session/session-store.js';
import { ErrorMessages } from '../../utils/error-messages.js';

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
  return isSettledSessionState(state);
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
 * Whether a session is an attach whose target is not on this host, so a
 * file that exists here is not the debuggee's source (issue #899). A local
 * attach — by `processId` or to a loopback endpoint — is not foreign, and
 * neither is any launch. The one spelling for the breakpoint echo, the
 * stale-build check and the server's breakpoint path resolution.
 */
export function isForeignAttach(session: Pick<ManagedSession, 'attachMode' | 'attachLocality'>): boolean {
  return session.attachMode === true && session.attachLocality !== 'pid' && session.attachLocality !== 'loopback';
}

/**
 * The stale-build sentence for a location the session's adapter binds
 * through a compiled file (issues #938/#950), or nothing. Advisory like
 * `readLineContext`: every failure is a debug line under the caller's label.
 *
 * Nothing is said when the session is unknown or when the attach target is
 * not on this host (`isForeignAttach`); a policy that declares no generated
 * files is the checker's to answer (nothing, without a file touched). What
 * the engine runs — the transformed launch's program and config — goes to
 * the policy through the checker, and the policy says what it means:
 * js-debug declines a program that is itself a `.ts` or a runner under
 * `node_modules` (the sources run as they are, so there is no build to be
 * stale), the compiled languages name their artefact from it and have
 * nothing to name before a launch. The core knows no language. The launch is
 * read only while the session is a launch: an attach in the same session
 * debugs some other process, whatever was launched before.
 */
export async function describeStaleBuild(
  ctx: ToolContext,
  sessionId: string,
  file: string,
  logLabel: string
): Promise<string | undefined> {
  try {
    const session = ctx.sessionManager.getSession(sessionId);
    if (!session || isForeignAttach(session)) {
      return undefined;
    }
    const policy = ctx.sessionManager.getSessionPolicy(sessionId);
    const launch = session.attachMode === true ? undefined : session.transformedLaunch;
    const evidence = await ctx.buildStaleness.check(file, policy, launch);
    return evidence ? ErrorMessages.staleGeneratedFile(evidence) : undefined;
  } catch (error) {
    ctx.logger.debug(`Could not check build staleness for ${logLabel}`, { file, error });
    return undefined;
  }
}

/** Space-join `note` onto a response's existing `note`, or set it; nothing for an absent note. */
export function appendNote(response: Record<string, unknown>, note: string | undefined): void {
  if (!note) {
    return;
  }
  const existing = response.note;
  response.note = typeof existing === 'string' && existing.length > 0 ? `${existing} ${note}` : note;
}

/**
 * Hoist where a stop landed to the top level of a tool answer and annotate
 * it — the one shape every stop answer has: the step tools, pause_execution,
 * wait_for_stop, and a launch or relaunch that stopped (issue #951).
 *
 * Beyond the frame (issue #904): the thread the answer is anchored on when it
 * is not the reported one, and the note about it. Then the location, and two
 * reads of its file, overlapped: the source line around it, and whether the
 * running code may be an older build than the source it was read from
 * (issues #938/#950) — that sentence is appended to the note, so it always
 * comes after what the session layer had to say. Nothing happens without a
 * location: an answer that is pending or that reports a program's end keeps
 * exactly the fields it had.
 */
export async function hoistStopLanding(
  ctx: ToolContext,
  response: Record<string, unknown>,
  data: StopLandingFields | undefined,
  sessionId: string,
  logLabel: string
): Promise<void> {
  if (typeof data?.threadId === 'number') {
    response.threadId = data.threadId;
  }
  if (data?.note) {
    response.note = data.note;
  }
  const location = data?.location;
  if (!location) {
    return;
  }
  response.location = location;
  const [context, staleBuild] = await Promise.all([
    readLineContext(ctx, location.file, location.line, logLabel),
    describeStaleBuild(ctx, sessionId, location.file, logLabel)
  ]);
  if (context) {
    response.context = context;
  }
  appendNote(response, staleBuild);
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

/**
 * The one AttachRequest both attach entry points send — attach_to_process and
 * the create_debug_session shortcut (issue #905) — so they cannot drift again.
 * Every key is spelled and forwarded as given: no layer below defaults `host`
 * (every adapter does) or `timeout` (js-debug honours a forwarded one, its
 * own default being 10 s; forcing 30 s on it would out-wait the 20 s verify
 * window, and a dead port would answer the generic verify failure instead of
 * the adapter's own last word, issue #897). An invalid breakOnExceptions
 * throws here, before any session exists. The `satisfies` keeps every key of
 * AttachRequest spelled: a key added there and forgotten here fails to compile.
 */
export function attachRequestFromArgs(args: ToolArguments): AttachRequest {
  const request = {
    port: args.port,
    host: args.host,
    processId: args.processId,
    timeout: args.timeout,
    verifyTimeout: args.verifyTimeout,
    sourcePaths: args.sourcePaths,
    stopOnEntry: args.stopOnEntry,
    justMyCode: args.justMyCode,
    breakOnExceptions: validateBreakOnExceptions(args.breakOnExceptions),
    adapterConfig: args.adapterConfig
  } satisfies Record<keyof AttachRequest, unknown>;
  return request;
}
