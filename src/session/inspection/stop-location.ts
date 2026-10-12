/**
 * Where a stop landed, for the answers that name a location (issue #904):
 * pause, the steps, wait_for_stop and the attach. One read through the
 * frame-anchor resolver, so an answer sees the resolver's verdict — which
 * thread it is anchored on, whether any frame is program code, the note
 * that explains a switch — instead of the top frame alone, which used to be
 * copied three times and knew nothing (issues #898/#900).
 */
import type { OperationsContext } from '../operations-context.js';
import type { StopLandingFields } from '../session-manager-core.js';
import { ErrorMessages } from '../../utils/error-messages.js';
import { isProgramNeutralStopReason } from './stop-anchor.js';

/**
 * The landing as read: the answer's fields (`StopLandingFields`) plus the
 * flag the wording was built from.
 */
export interface StopLanding extends StopLandingFields {
  /** True when no frame of the shown stack is program code. */
  noProgramFrame?: true;
}

export type StopLandingContext = Pick<OperationsContext, 'getStackTraceDetailed' | 'getSession' | 'logger'>;

/**
 * Read the stop's landing. A program-neutral stop (a `pause`) is read with
 * the resolver's readiness option, so a frameless or internal-only thread
 * may be traded for a sibling in the program's code; a breakpoint, step,
 * exception or entry stop is read plainly — it belongs to its thread. A
 * failed read is logged and answers nothing: the location is advisory.
 */
export async function describeStopLocation(
  ctx: StopLandingContext,
  sessionId: string,
  logTag: string
): Promise<StopLanding> {
  try {
    // A brief settle after the stopped event, as every reader here always had.
    await new Promise((resolve) => setTimeout(resolve, 10));
    const stop = ctx.getSession(sessionId).lastStop;
    const result = isProgramNeutralStopReason(stop?.reason)
      ? await ctx.getStackTraceDetailed(sessionId, undefined, false, { ensureStackReady: true })
      : await ctx.getStackTraceDetailed(sessionId);
    const top = result.frames[0];
    const landing: StopLanding = {};
    if (top) {
      landing.location = { file: top.file, line: top.line, column: top.column };
    }
    if (
      typeof result.threadId === 'number' &&
      typeof stop?.threadId === 'number' &&
      result.threadId !== stop.threadId
    ) {
      landing.threadId = result.threadId;
    }
    const notes: string[] = [];
    if (result.note) {
      notes.push(result.note);
    }
    if (result.noProgramFrame && top) {
      landing.noProgramFrame = true;
      notes.push(ErrorMessages.stopWithoutProgramFrame(result.threadId, result.totalFrameCount, top));
    }
    if (notes.length > 0) {
      landing.note = notes.join(' ');
    }
    if (landing.location) {
      ctx.logger.debug(`[SessionManager ${logTag} ${sessionId}] Captured location: ${landing.location.file}:${landing.location.line}`);
    }
    return landing;
  } catch (error) {
    ctx.logger.debug(`[SessionManager ${logTag} ${sessionId}] Could not capture location:`, error);
    return {};
  }
}

/** The fields an answer spreads: everything but the internal flag. */
export function landingFields(landing: StopLanding): StopLandingFields {
  return {
    ...(landing.location ? { location: landing.location } : {}),
    ...(typeof landing.threadId === 'number' ? { threadId: landing.threadId } : {}),
    ...(landing.note ? { note: landing.note } : {})
  };
}
