/**
 * The stop snapshot (issue #982): the bounded state payload every PAUSED
 * answer carries so reading crash state costs zero extra tool calls —
 * the exception the stop reported, the top visible frames, and the top
 * frame's locals, all composed from the landing read's own resolver result.
 *
 * Ground rules, each load-bearing:
 * - never re-resolve: no `stackResult` (a failed landing) means no snapshot;
 * - never await exceptionInfo: it merges fire-and-forget onto `lastStop`
 *   (session-manager-core) and is included only if already there;
 * - never outlive the answer: the locals read races a tunable window and the
 *   note says what expired;
 * - never bypass least-privilege: explicit-names mode withholds locals;
 * - never synthesize: every value shown is one the adapter reported;
 * - never fail the answer: any throw degrades to no snapshot, debug-logged
 *   (the describeStopLocation pattern).
 */
import { SessionState, redactStopInfo } from '@debugmcp/shared';
import type { OperationsContext } from '../operations-context.js';
import type { SnapshotException, StopSnapshot } from '../session-manager-core.js';
import type { StackTraceResult } from './frame-anchor-resolver.js';
import { frameSummary } from './frame-anchor-resolver.js';
import { applyVariableCaps, mergeTruncationSummaries, snapshotLocalsLimits } from '../variable-caps.js';

export type StopSnapshotContext = Pick<
  OperationsContext,
  | 'logger'
  | 'getSession'
  | 'tunables'
  | 'extractLocalsFromResolved'
  | 'redactionEnabled'
  | 'snapshotEnabled'
  | 'variableAccessMode'
>;

export interface ComposeSnapshotOptions {
  /**
   * Leave the exception out: wait_for_stop's answer already carries the
   * (redacted) `lastStop`, and the same message must never ship twice.
   */
  omitException?: boolean;
}

/** How many frames the snapshot shows, and how deep its locals read probes. */
const SNAPSHOT_FRAMES = 3;
/** Cap on each exception string; `frames` covers the stack, so no traceback. */
const EXCEPTION_FIELD_CAP = 500;

const TIMED_OUT: unique symbol = Symbol('snapshot-locals-timeout');
const FAILED: unique symbol = Symbol('snapshot-locals-failed');

function capped(text: string | undefined): string | undefined {
  if (text === undefined) return undefined;
  return text.length > EXCEPTION_FIELD_CAP ? `${text.slice(0, EXCEPTION_FIELD_CAP)}…` : text;
}

/**
 * Compose the snapshot for one answer. Call it once per ANSWER — a step that
 * repeats on the same line (Dart) reads the landing per attempt but composes
 * only from the final one. Returns undefined whenever there is nothing to
 * say or the snapshot is off; the caller spreads it conditionally.
 */
export async function composeStopSnapshot(
  ctx: StopSnapshotContext,
  sessionId: string,
  stackResult: StackTraceResult | undefined,
  logTag: string,
  opts: ComposeSnapshotOptions = {}
): Promise<StopSnapshot | undefined> {
  try {
    if (!ctx.snapshotEnabled() || !stackResult) {
      return undefined;
    }
    const session = ctx.getSession(sessionId);
    if (session.state !== SessionState.PAUSED) {
      return undefined;
    }
    const stop = session.lastStop;
    if (stop?.reason === 'entry') {
      // Locals at an entry stop are module scaffolding, not state worth paying for.
      return undefined;
    }

    const frames = stackResult.frames.slice(0, SNAPSHOT_FRAMES).map(frameSummary);

    let exception: SnapshotException | undefined;
    if (!opts.omitException && stop?.reason === 'exception') {
      // Redact a copy; the stored record keeps its identity (merge guards).
      const source = ctx.redactionEnabled() ? redactStopInfo(stop) : stop;
      // The merged exceptionInfo's typed fields win over the raw stopped-event
      // pair: adapters disagree on the pair's order (debugpy follows the DAP
      // spec reading — `text` is the exception NAME, `description` the message
      // — while the mock/JDI convention is the reverse), but typeName /
      // exceptionId / details.message are unambiguous. Without exceptionInfo
      // (not merged yet, or unsupported) the pair is passed through in the
      // model-comment order.
      const details = source.exceptionInfo?.details;
      const type = capped(
        details?.fullTypeName ?? details?.typeName ?? source.exceptionInfo?.exceptionId ?? source.description
      );
      const message = capped(details?.message ?? source.text ?? source.exceptionInfo?.description);
      const extra = capped(source.exceptionInfo?.description);
      const detailsOut = extra !== undefined && extra !== message ? extra : undefined;
      if (type !== undefined || message !== undefined || detailsOut !== undefined) {
        exception = {
          ...(type !== undefined ? { type } : {}),
          ...(message !== undefined ? { message } : {}),
          ...(detailsOut !== undefined ? { details: detailsOut } : {})
        };
      }
    }

    if (frames.length === 0 && !exception) {
      return undefined;
    }

    const snapshot: StopSnapshot = {
      ...(exception ? { exception } : {}),
      frames
    };
    const notes: string[] = [];

    if (ctx.variableAccessMode() === 'explicit') {
      notes.push(
        'locals withheld (DEBUG_MCP_VARIABLE_ACCESS=explicit); use get_local_variables with names'
      );
    } else if (!stackResult.noProgramFrame && frames[0] && !frames[0].file.startsWith('<')) {
      const timeoutMs = ctx.tunables.snapshotLocalsTimeoutMs;
      let timer: NodeJS.Timeout | undefined;
      try {
        // Failure folds into a sentinel so a read that loses the race can
        // never surface later as an unhandled rejection.
        const guardedRead = ctx
          .extractLocalsFromResolved(sessionId, stackResult, { maxFrames: SNAPSHOT_FRAMES })
          .catch((error: unknown): typeof FAILED => {
            ctx.logger.debug(`[SessionManager ${logTag} ${sessionId}] Snapshot locals read failed:`, error);
            return FAILED;
          });
        const raced = await Promise.race([
          guardedRead,
          new Promise<typeof TIMED_OUT>((resolve) => {
            timer = setTimeout(() => resolve(TIMED_OUT), timeoutMs);
          })
        ]);
        if (raced === TIMED_OUT) {
          notes.push(
            `locals omitted: the locals read exceeded ${timeoutMs}ms; get_local_variables reads them`
          );
        } else if (raced === FAILED) {
          notes.push('locals omitted: the locals read failed; get_local_variables reads them');
        } else {
          const cappedLocals = applyVariableCaps(raced.variables, snapshotLocalsLimits());
          if (cappedLocals.variables.length > 0) {
            // First value wins on a duplicate name (scope merge order is the
            // policy's presentation order); defineProperty so exotic names
            // ('__proto__') land as own enumerable keys.
            const flat: Record<string, string> = {};
            for (const variable of cappedLocals.variables) {
              if (!Object.prototype.hasOwnProperty.call(flat, variable.name)) {
                Object.defineProperty(flat, variable.name, {
                  value: variable.value,
                  enumerable: true,
                  writable: true,
                  configurable: true
                });
              }
            }
            snapshot.locals = flat;
          }
          const truncation = mergeTruncationSummaries([raced.truncation, cappedLocals.truncation]);
          if (truncation) {
            snapshot.truncation =
              `${truncation.omittedCount} variable(s) omitted, ` +
              `${truncation.valueTruncatedCount} value(s) cut — get_local_variables returns the full list`;
          }
          if (raced.anchorNote) {
            notes.push(raced.anchorNote);
          }
        }
      } finally {
        if (timer !== undefined) {
          clearTimeout(timer);
        }
      }
    }

    if (notes.length > 0) {
      snapshot.note = notes.join('; ');
    }
    return snapshot;
  } catch (error) {
    ctx.logger.debug(`[SessionManager ${logTag} ${sessionId}] Could not compose stop snapshot:`, error);
    return undefined;
  }
}
