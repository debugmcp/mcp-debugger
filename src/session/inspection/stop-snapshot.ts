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

/** A bare dotted identifier, the shape of an exception class name. */
function looksLikeTypeName(text: string): boolean {
  return /^[A-Za-z_$][\w$.]*$/.test(text.trim());
}

/** Own enumerable assignment that survives exotic names ('__proto__'). */
function setOwn<T>(target: Record<string, T>, key: string, value: T): void {
  Object.defineProperty(target, key, { value, enumerable: true, writable: true, configurable: true });
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
      // pair: adapters disagree on the pair's orientation — the repo's own
      // pins show debugpy and the JDI bridge putting the exception NAME in
      // `text` (the DAP-spec reading) while the mock adapter puts it in
      // `description` — but typeName / exceptionId / details.message are
      // unambiguous. Without exceptionInfo (not merged yet, or unsupported)
      // the pair is labeled by shape: the half that reads as a bare
      // identifier (a class name) is the type; two identifiers or two
      // sentences keep the model-comment order (description -> type).
      const details = source.exceptionInfo?.details;
      let rawType = source.description;
      let rawMessage = source.text;
      if (
        rawType !== undefined && rawMessage !== undefined &&
        looksLikeTypeName(rawMessage) && !looksLikeTypeName(rawType)
      ) {
        [rawType, rawMessage] = [rawMessage, rawType];
      }
      const type = capped(
        details?.fullTypeName ?? details?.typeName ?? source.exceptionInfo?.exceptionId ?? rawType
      );
      const message = capped(details?.message ?? rawMessage ?? source.exceptionInfo?.description);
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
    } else if (!stackResult.noProgramFrame && frames[0]) {
      // No gate on the top frame's own file: the #672 keep rule can put a
      // sourceless internal frame at frames[0] with program frames below,
      // and the walk-down (#468) exists exactly for that. A stack with no
      // program frame at all is caught by noProgramFrame above.
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
        } else if (ctx.getSession(sessionId).lastStop !== stop) {
          // The stop changed under the read: these locals belong to another
          // stop's world. No snapshot beats a mixed one.
          return undefined;
        } else {
          const cappedLocals = applyVariableCaps(raced.variables, snapshotLocalsLimits());
          if (cappedLocals.variables.length === 0 && stackResult.frames.length > SNAPSHOT_FRAMES) {
            // The capped probe may simply not have reached the frames that
            // have locals; silence here would be indistinguishable from
            // "locals-free frame" (review of #982).
            notes.push(
              `no locals in the top ${SNAPSHOT_FRAMES} frames; get_local_variables probes deeper frames`
            );
          }
          if (cappedLocals.variables.length > 0) {
            // First value wins on a duplicate name (scope merge order is the
            // policy's presentation order); defineProperty so exotic names
            // ('__proto__') land as own enumerable keys.
            const flat: Record<string, string> = {};
            for (const variable of cappedLocals.variables) {
              if (!Object.prototype.hasOwnProperty.call(flat, variable.name)) {
                setOwn(flat, variable.name, variable.value);
              }
            }
            // The diff cache (issue #983): a later stop in the same frame
            // reports only what changed since the locals were last SHOWN.
            // Identity rules, each load-bearing: the same stop re-answered
            // never diffs against itself (base untouched); a frame-key
            // mismatch — anchor name/file or visible depth — re-emits full
            // locals and rebases, never a wrong diff. Only a successful,
            // non-empty read touches the cache.
            const anchor = raced.frame ?? frames[0];
            const frameKey = `${anchor.name}|${anchor.file}|${stackResult.frames.length}`;
            const base = session.snapshotDiffBase;
            if (stop && base && base.stopRef === stop) {
              snapshot.locals = flat;
            } else if (stop && base && base.frameKey === frameKey) {
              const changed: Record<string, { before: string; after: string }> = {};
              for (const name of Object.keys(flat)) {
                const before = Object.prototype.hasOwnProperty.call(base.rendered, name)
                  ? base.rendered[name]
                  : '<undefined>';
                if (before !== flat[name]) {
                  setOwn(changed, name, { before, after: flat[name] });
                }
              }
              snapshot.changedVariables = changed;
              session.snapshotDiffBase = { stopRef: stop, frameKey, rendered: flat };
            } else {
              snapshot.locals = flat;
              if (stop) {
                session.snapshotDiffBase = { stopRef: stop, frameKey, rendered: flat };
              }
            }
          }
          // Omissions merge from both passes; CUTS count only at the
          // snapshot's own cap (a value cut upstream and re-cut here is one
          // cut value, not two); unread scopes come from the pipeline.
          const omitted =
            (raced.truncation?.omittedCount ?? 0) + (cappedLocals.truncation?.omittedCount ?? 0);
          const cut = cappedLocals.truncation?.valueTruncatedCount
            ?? raced.truncation?.valueTruncatedCount ?? 0;
          const scopesUnread = raced.truncation?.scopesSkipped ?? 0;
          const parts: string[] = [];
          if (omitted > 0) parts.push(`${omitted} variable(s) omitted`);
          if (cut > 0) parts.push(`${cut} value(s) cut`);
          if (scopesUnread > 0) parts.push(`${scopesUnread} scope(s) unread`);
          if (parts.length > 0) {
            snapshot.truncation = `${parts.join(', ')} — get_local_variables returns the full list`;
          }
          if (raced.anchorNote) {
            // The resolver's own note already rides on the answer as the
            // landing's note; the same sentence never ships twice. The data
            // layer always seeds anchorNote with that note first, so a
            // prefix strip is exact (the note itself may contain '; ').
            const resolverNote = stackResult.note;
            const fresh =
              resolverNote === undefined ? raced.anchorNote
              : raced.anchorNote === resolverNote ? ''
              : raced.anchorNote.startsWith(`${resolverNote}; `)
                ? raced.anchorNote.slice(resolverNote.length + 2)
                : raced.anchorNote;
            if (fresh) {
              notes.push(fresh);
            }
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
