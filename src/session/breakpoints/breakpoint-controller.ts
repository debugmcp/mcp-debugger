/**
 * Breakpoint tooling: the store-of-record for a session's breakpoints, and the
 * DAP re-sends that push it at a live debuggee.
 *
 * The invariant the whole slice is built around: the session store is the
 * source of truth and every mutation lands there first. DAP setBreakpoints is
 * replace-all per file (and setFunctionBreakpoints replace-all per session), so
 * a change is expressed by re-sending the surviving set; and a failed re-send
 * is reported as a `warning`, never thrown, because the stored set is still
 * correct and gets re-applied on the next launch.
 *
 * Set, remove and clear all work in every lifecycle state short of
 * close_debug_session: before the first launch and after the program has
 * exited (or a dry run) the mutation is stored and waits for the next launch;
 * only a RUNNING or PAUSED session with a live proxy triggers a re-send
 * (issues #793, #806).
 */
import { getErrorMessage } from '../../errors/debug-errors.js';
import { v4 as uuidv4 } from 'uuid';
import {
  Breakpoint,
  FunctionBreakpoint,
  SessionState,
  toFunctionBreakpoint,
  toSourceBreakpoint,
  type AdapterPolicy,
  type DebugLanguage
} from '@debugmcp/shared';
import { DebugProtocol } from '@vscode/debugprotocol';
import { consumeChildSourced } from '../../utils/child-origin-events.js';
import { DapResponseError } from '../../proxy/dap-response-error.js';
import type { ManagedSession } from '../session-store.js';
import type { BreakpointContext } from '../operations-context.js';
import { buildFunctionBreakpointLaunchWarning, fileLabel } from './launch-warnings.js';
import {
  applyBoundLocation,
  keepHitProven,
  mirrorsBreakpointsToChild,
  setAdapterMessage,
  stampRefusalMessage
} from './hit-verification.js';

/**
 * Labels for a set of files in one sentence: the basename, unless two files
 * share it — then those keep their full path so the reader can tell them
 * apart.
 */
function fileLabels(files: string[]): string[] {
  const labels = files.map(fileLabel);
  return files.map((file, i) => (labels.indexOf(labels[i]) === labels.lastIndexOf(labels[i]) ? labels[i] : file));
}

/** How a DAP re-send failed (issue #754). */
export interface BreakpointSyncFailure {
  /** The error text: the adapter's own answer, or the transport's. */
  message: string;
  /**
   * The adapter itself declined the request (a DapResponseError): its words
   * were stamped onto the unverified records the re-send covered. A transport
   * failure, a timeout or a shutdown is not the adapter's answer and leaves
   * every record as it was.
   */
  refused: boolean;
}

/** Outcome of a DAP re-send: whether it reached the adapter, and why not. */
export interface BreakpointSyncOutcome {
  synced: boolean;
  warning?: string;
  failure?: BreakpointSyncFailure;
}

/** What `resyncAll` hands back for the launch/attach result (issue #754). */
export interface ResyncOutcome {
  /** One sentence per distinct failure, in send order. */
  warnings: string[];
  /**
   * The function-breakpoint re-send failed — refused or never answered: the
   * unbound-at-launch symptom warning is withheld, the cause being reported
   * (the #710 rule: a known cause displaces the symptom).
   */
  functionBreakpointsFailed: boolean;
}

/**
 * The name a function-breakpoint request actually addresses, plus everything
 * the adapter policy had to say about the name the caller supplied.
 *
 * `effectiveName` is what the store is keyed on and what the response
 * discloses; `normalized` is set only when a policy-certain rewrite changed
 * the name (issue #467), and `hint` only when there was no rewrite and the
 * policy still has an advisory about the name (issues #303/#308).
 */
export interface FunctionBreakpointNameResolution {
  requestedName: string;
  effectiveName: string;
  normalized?: { name: string; note: string };
  hint?: string;
}

/**
 * Outcome of a by-name function-breakpoint removal, in the same vocabulary as
 * the name resolution it is built from: `functionName` is the effective name,
 * `requestedName` is what the caller asked for, and `normalized` is set only
 * when a policy-certain rewrite changed the name — which is the condition the
 * response discloses `requestedName` on (issue #550).
 *
 * `warning` is the one advisory channel: the live-sync failure on the success
 * path, and on the not-found path the policy advisory that explains why
 * nothing matched (issues #303/#308).
 */
export interface FunctionBreakpointRemoval {
  removed: FunctionBreakpoint[];
  functionName: string;
  requestedName: string;
  normalized?: { name: string; note: string };
  warning?: string;
}

export class BreakpointController {
  constructor(private readonly ctx: BreakpointContext) {}

  async setBreakpoint(
    sessionId: string,
    bp: {
      /** Validated/translated by server.ts before reaching here */
      file: string;
      /** Resolved line (anchors are resolved to a line in the server layer) */
      line: number;
      condition?: string;
      suspendPolicy?: 'all' | 'thread';
      logMessage?: string;
      /** Set only in assert/content addressing modes (loud snapping, #271) */
      requestedLine?: number;
      /** Content anchor for restart re-resolution (content mode, #271) */
      anchor?: { statement: string; nearLine?: number };
    }
  ): Promise<{ breakpoint: Breakpoint; warning?: string }> {
    const session = this.ctx.getSession(sessionId);

    const bpId = uuidv4();

    this.ctx.logger.info(
      `[SessionManager setBreakpoint] Using validated file path "${bp.file}" for session ${sessionId}`
    );

    const newBreakpoint: Breakpoint = {
      id: bpId,
      file: bp.file,
      line: bp.line,
      condition: bp.condition,
      suspendPolicy: bp.suspendPolicy,
      logMessage: bp.logMessage,
      verified: false
    };
    if (bp.requestedLine !== undefined) {
      newBreakpoint.requestedLine = bp.requestedLine;
    }
    if (bp.anchor !== undefined) {
      newBreakpoint.anchor = bp.anchor;
    }

    if (!session.breakpoints) session.breakpoints = new Map();
    session.breakpoints.set(bpId, newBreakpoint);
    this.ctx.logger.info(
      `[SessionManager] Breakpoint ${bpId} queued for ${bp.file}:${bp.line} in session ${sessionId}.`
    );

    const sync = await this.syncBreakpointsForFile(session, bp.file);
    // A refused re-send has marked the new record (messageOrigin 'refusal');
    // the handler reads that to say the adapter's words once.
    return { breakpoint: newBreakpoint, warning: sync.warning };
  }

  /**
   * Re-send the session's full breakpoint set for one file to the adapter
   * (DAP setBreakpoints is replace-all per file) and merge the response back
   * into the stored breakpoints (positional match). No-op unless the proxy is
   * live and the session is RUNNING or PAUSED. Never throws: a DAP failure is
   * logged and reported via `warning` — the store remains the source of truth
   * and the set is re-applied on the next launch.
   */
  async syncBreakpointsForFile(
    session: ManagedSession,
    file: string,
    options?: { forceFreshEcho?: boolean }
  ): Promise<BreakpointSyncOutcome> {
    const sessionId = session.id;
    if (
      !session.proxyManager ||
      !session.proxyManager.isRunning() ||
      (session.state !== SessionState.RUNNING && session.state !== SessionState.PAUSED)
    ) {
      return { synced: false };
    }

    // Collect ALL breakpoints for this source file (DAP setBreakpoints is replace-all)
    const allBpsForFile = Array.from(session.breakpoints.values())
      .filter(bp => bp.file === file);
    // For child-mirroring adapters (js-debug), setBreakpoints responses
    // come from the parent session, which owns no runtime: its verified
    // flags are pessimistic and its ids belong to a different id space
    // than the child events that carry the real verification. Treat the
    // child as authoritative — never let a parent response downgrade
    // verified state or clobber child adapter ids.
    const childAuthoritative = this.mirrorsToChild(session);

    try {
      this.ctx.logger.info(
        `[SessionManager] Active proxy for session ${sessionId}, sending ${allBpsForFile.length} breakpoint(s) for ${file}.`
      );
      const response =
        await session.proxyManager.sendDapRequest<DebugProtocol.SetBreakpointsResponse>(
          'setBreakpoints',
          {
            source: { path: file },
            breakpoints: allBpsForFile.map(toSourceBreakpoint),
            // Reserved key, stripped by the proxy before the adapter sees
            // it: asks a child-mirroring proxy for an authoritative echo
            // even when the set is unchanged (issue #500).
            ...(options?.forceFreshEcho === true ? { __mcpForceFreshEcho: true } : {}),
          }
        );
      if (
        response &&
        response.body &&
        response.body.breakpoints
      ) {
        const responseBps = response.body.breakpoints;
        // A response the proxy marked child-sourced (issue #500) carries the
        // child session's own answer — the authoritative one — so it stamps
        // fully instead of upgrade-only.
        const childSourced = consumeChildSourced(response);
        // Update ALL breakpoints from response (positional match)
        for (let i = 0; i < Math.min(responseBps.length, allBpsForFile.length); i++) {
          const bpInfo = responseBps[i];
          const record = allBpsForFile[i];
          // The parent's answer for a mirroring policy is not authoritative;
          // a child-sourced one, or any non-mirroring adapter's, is.
          const authoritative = !childAuthoritative || childSourced;
          const keepChildState = !authoritative && record.verified === true;
          // A stop already proved this breakpoint bound (issue #673): an
          // "unbound" answer for a location the adapter cannot map is not
          // evidence it stopped firing. Keep the id current and nothing else.
          const hitProven = authoritative && keepHitProven(record, bpInfo);
          if (!authoritative) {
            record.verified = record.verified || bpInfo.verified;
          } else if (!hitProven) {
            record.verified = bpInfo.verified;
            record.verifiedBy = record.verified ? 'adapter' : undefined;
            // The child's ids — provisional included — are the real ids for
            // these records (see handleBreakpoint); so are a non-mirroring
            // adapter's.
            if (typeof bpInfo.id === 'number') {
              record.adapterId = bpInfo.id;
            }
            // Where it bound: a different file is reported as
            // boundFile/boundLine, a same-file move lands in `line`.
            applyBoundLocation(record, bpInfo.source?.path, bpInfo.line);
            if (!record.verified) {
              // An unverified record claims no binding location.
              record.boundFile = undefined;
              record.boundLine = undefined;
            }
          }
          if (!keepChildState && !hitProven) {
            // The adapter's own verdict, normalized (issue #471): raw l10n
            // keys like js-debug's "breakpoint.provisionalBreakpoint" must
            // never sit in the store, a provisional note must not survive
            // verification, and it displaces a stamped refusal (#754).
            setAdapterMessage(allBpsForFile[i], bpInfo.message, allBpsForFile[i].verified);
          }
          // Enhance "no symbols" message for .NET with PDB format guidance
          if (bpInfo.message && session.language === 'dotnet' &&
              bpInfo.message.toLowerCase().includes('no symbols')) {
            allBpsForFile[i].message += ' (Hint: netcoredbg requires Portable PDB format. Compile with /debug:portable or convert with Pdb2Pdb.)';
          }
          this.ctx.logger.info(
            `[SessionManager] Breakpoint ${allBpsForFile[i].id} response received. Verified: ${allBpsForFile[i].verified}${
              bpInfo.message ? `, Message: ${bpInfo.message}` : ''
            }`
          );

          // Log breakpoint verification with structured logging
          if (allBpsForFile[i].verified) {
            this.ctx.logger.info('debug:breakpoint', {
              event: 'verified',
              sessionId: sessionId,
              sessionName: session.name,
              breakpointId: allBpsForFile[i].id,
              file: allBpsForFile[i].file,
              line: allBpsForFile[i].line,
              verified: true,
              timestamp: Date.now(),
            });
          }
        }
      }
      return { synced: true };
    } catch (error) {
      this.ctx.logger.error(
        `[SessionManager] Error sending setBreakpoints to proxy for session ${sessionId}:`,
        error
      );
      return this.failedSync(session, error, allBpsForFile, childAuthoritative);
    }
  }

  /**
   * Whether the session's policy mirrors breakpoints to a child session
   * (js-debug). Never throws — the sync methods it feeds promise the same —
   * so a policy without client behaviour, or one that throws, reads as "no".
   */
  private mirrorsToChild(session: ManagedSession): boolean {
    return mirrorsBreakpointsToChild(() => this.ctx.selectPolicy(session.language));
  }

  /**
   * The outcome of a re-send the proxy rejected. Only the adapter's own
   * answer (a DapResponseError — the adapter declined the request) is
   * stamped onto the unverified records the re-send covered (issue #754),
   * the way the worker's breakpoints_synced echo stamps a refused pre-launch
   * set (#750), so list_breakpoints and the exit summary carry the
   * debugger's words rather than a bare verified:false. A transport failure,
   * a timeout or a shutdown is not the adapter's answer: the previous set
   * may well still be armed, so those leave the records alone and are only
   * reported.
   */
  private failedSync(
    session: ManagedSession,
    error: unknown,
    records: Array<Breakpoint | FunctionBreakpoint>,
    childAuthoritative: boolean
  ): BreakpointSyncOutcome {
    const message = getErrorMessage(error);
    const refused = error instanceof DapResponseError;
    if (refused) {
      this.stampRefusal(records, message, childAuthoritative);
    }
    return {
      synced: false,
      warning: this.buildLiveSyncWarning(session, message),
      failure: { message, refused }
    };
  }

  /**
   * Stamp the adapter's refusal onto the UNVERIFIED records the re-send
   * covered. A refusal answers the request, not any one breakpoint: a record
   * the adapter verified before — or a stop proved bound (#673), or a
   * child-mirroring policy's child verified (#500) — stands, since the
   * adapter never said it was gone and its previous set may still be armed,
   * and a verified record needs no explanation beside it. An unverified
   * record claims no binding location (as the breakpoint-event handler
   * clears it) — unless a child-mirroring policy's child owns those facts
   * (#500), where the parent's refusal is no more authoritative than its
   * answers — and the stamp never displaces a curated note.
   */
  private stampRefusal(
    records: Array<Breakpoint | FunctionBreakpoint>,
    message: string,
    childAuthoritative: boolean
  ): void {
    for (const record of records) {
      if (record.verified === true) {
        continue;
      }
      if (!childAuthoritative) {
        record.verifiedBy = undefined;
        record.boundFile = undefined;
        record.boundLine = undefined;
      }
      stampRefusalMessage(record, message);
    }
  }

  /**
   * Topology guidance for a ruby attach session whose refusal is rdbg's
   * "<path> is not available" (issue #357): the path was rejected on the
   * debug TARGET's filesystem (e.g. container server + host rdbg, or vice
   * versa) — expected behavior, not a debugger fault. Appended to the live
   * warning and the resync report alike.
   */
  private liveSyncHint(session: ManagedSession, message: string): string {
    if (session.attachMode && session.language === 'ruby' && /is not available/.test(message)) {
      return "Hint: attach sessions send breakpoint paths to the remote debugger verbatim; the path must be valid on the debug target's filesystem. Use target-side paths, or pass localfsMap in the attach config to map local paths to remote ones.";
    }
    return '';
  }

  /**
   * Compose the live-sync failure warning, hint appended — same style as the
   * netcoredbg no-symbols guidance above.
   */
  private buildLiveSyncWarning(session: ManagedSession, message: string): string {
    const hint = this.liveSyncHint(session, message);
    return `Breakpoint state updated, but live sync failed: ${message}${hint ? ` (${hint})` : ''}`;
  }

  /**
   * Resolve the function-breakpoint name a request addresses, through the
   * session's adapter policy (issue #559 — the set and remove paths share one
   * answer, so a name that was rewritten on the way in is removable on the way
   * out). Throws only for an unknown session id, like every other entry point
   * here; policy failures are swallowed, so a name advisory can never break a
   * breakpoint request. The hint is skipped when a rewrite already happened —
   * the rewrite note says everything the caller needs, and the hook therefore
   * only ever sees the requested name.
   */
  resolveFunctionBreakpointName(
    sessionId: string,
    requestedName: string
  ): FunctionBreakpointNameResolution {
    const { language } = this.ctx.getSession(sessionId);
    // Policy-certain rewrite (issue #467), then the per-adapter advisory
    // (issues #303/#308) for the names that got none.
    const normalized = this.policyHook(language, (policy) =>
      policy.normalizeFunctionBreakpointName?.(requestedName)
    );
    const hint = normalized
      ? undefined
      : this.policyHook(language, (policy) =>
          policy.functionBreakpointNameHint?.(requestedName)
        );
    return {
      requestedName,
      effectiveName: normalized?.name ?? requestedName,
      normalized,
      hint
    };
  }

  /**
   * Read one thing off a language's adapter policy, degrading to undefined
   * when the store's lookup throws (unknown language) OR the hook itself
   * does. Neither a name advisory nor a launch warning is worth failing a
   * request over, so both failures collapse to the same "no policy" answer
   * the callers already handle.
   */
  private policyHook<T>(
    language: DebugLanguage,
    read: (policy: AdapterPolicy) => T | undefined
  ): T | undefined {
    try {
      return read(this.ctx.selectStorePolicy(language));
    } catch {
      return undefined;
    }
  }

  /**
   * Set a function (symbol-addressed) breakpoint (issue #271 phase 3).
   * Session-global — no file. Queued like line breakpoints when no debuggee
   * is live; synced immediately otherwise. The name is stored exactly as
   * given: the caller resolves it through resolveFunctionBreakpointName first.
   */
  async setFunctionBreakpoint(
    sessionId: string,
    bp: {
      functionName: string;
      condition?: string;
    }
  ): Promise<{ breakpoint: FunctionBreakpoint; warning?: string }> {
    const session = this.ctx.getSession(sessionId);

    const newBreakpoint: FunctionBreakpoint = {
      id: uuidv4(),
      functionName: bp.functionName,
      condition: bp.condition,
      verified: false
    };

    if (!session.functionBreakpoints) session.functionBreakpoints = new Map();
    session.functionBreakpoints.set(newBreakpoint.id, newBreakpoint);
    this.ctx.logger.info(
      `[SessionManager] Function breakpoint ${newBreakpoint.id} queued for ${bp.functionName} in session ${sessionId}.`
    );

    const sync = await this.syncFunctionBreakpoints(session);
    // A refused re-send has marked the new record (messageOrigin 'refusal');
    // the handler reads that to say the adapter's words once.
    return { breakpoint: newBreakpoint, warning: sync.warning };
  }

  /**
   * Re-send every stored breakpoint at the live debuggee: the line
   * breakpoints file by file (replace-all per file), then the function
   * breakpoints (replace-all per session). This is the belt-and-braces
   * re-sync launch and attach both run once the debuggee-owning session is
   * provably live (issues #236/#439, #500): the worker's initial send reports
   * back through the breakpoints_synced status, and a live re-send heals a
   * status lost to an IPC hiccup. Replace-all with the identical set is
   * idempotent; the per-file sync never throws and no-ops unless live.
   * `forceFreshEcho` is forwarded to every per-file send (attach needs it —
   * see the call site).
   */
  async resyncAll(
    session: ManagedSession,
    options?: { forceFreshEcho?: boolean }
  ): Promise<ResyncOutcome> {
    // The per-send failures, phrased for the launch/attach result (issue
    // #754): a refused re-send is stamped on the records by the send itself,
    // and its answer used to be discarded here. The files an adapter refused
    // with the same words share one sentence — one that refuses every file
    // says the same thing each time — and distinct answers keep their own.
    const lineFailures = new Map<string, { failure: BreakpointSyncFailure; files: string[] }>();
    const key = (failure: BreakpointSyncFailure): string => `${failure.refused ? 'refused' : 'failed'}:${failure.message}`;
    let hint = '';
    if (session.breakpoints.size > 0) {
      const files = [...new Set(Array.from(session.breakpoints.values()).map((bp) => bp.file))];
      for (const file of files) {
        const outcome = await this.syncBreakpointsForFile(session, file, options);
        if (outcome.failure === undefined) {
          continue;
        }
        const entry = lineFailures.get(key(outcome.failure)) ?? { failure: outcome.failure, files: [] };
        entry.files.push(file);
        lineFailures.set(key(outcome.failure), entry);
        hint ||= this.liveSyncHint(session, outcome.failure.message);
      }
    }
    const warnings = [...lineFailures.values()].map(({ failure, files }) =>
      this.describeResendFailure(`the breakpoints for ${fileLabels(files).join(', ')}`, failure)
    );
    let functionBreakpointsFailed = false;
    if ((session.functionBreakpoints?.size ?? 0) > 0) {
      const outcome = await this.syncFunctionBreakpoints(session);
      if (outcome.failure !== undefined) {
        functionBreakpointsFailed = true;
        hint ||= this.liveSyncHint(session, outcome.failure.message);
        // The curated notes the records carry (capability drift, say) used to
        // reach the launch result through the symptom warning this failure
        // now withholds; they ride along with the cause instead.
        const curated = [
          ...new Set(
            Array.from(session.functionBreakpoints.values())
              .filter((bp) => bp.messageOrigin === 'curated' && bp.message !== undefined)
              .map((bp) => bp.message as string)
          )
        ];
        warnings.push(
          this.describeResendFailure('the function breakpoints', outcome.failure) +
            (curated.length > 0 ? ` (${curated.join('; ')})` : '')
        );
      }
    }
    // The topology hint once, however many files the target refused (rdbg
    // names the path, so every file is a distinct answer).
    if (hint) {
      warnings.push(hint);
    }
    return { warnings, functionBreakpointsFailed };
  }

  /** One sentence for a failed re-send: the adapter's refusal, or the transport's failure. */
  private describeResendFailure(what: string, failure: BreakpointSyncFailure): string {
    return failure.refused
      ? `The debugger refused the re-send of ${what}: ${failure.message}`
      : `The re-send of ${what} failed: ${failure.message}`;
  }

  /**
   * Re-send the session's FULL function-breakpoint set to the adapter (DAP
   * setFunctionBreakpoints is replace-all for the whole session, not per
   * file). Same live-session guard and never-throws contract as
   * syncBreakpointsForFile.
   */
  async syncFunctionBreakpoints(session: ManagedSession): Promise<BreakpointSyncOutcome> {
    const sessionId = session.id;
    if (
      !session.proxyManager ||
      !session.proxyManager.isRunning() ||
      (session.state !== SessionState.RUNNING && session.state !== SessionState.PAUSED)
    ) {
      return { synced: false };
    }

    const allFnBps = Array.from(session.functionBreakpoints.values());

    try {
      this.ctx.logger.info(
        `[SessionManager] Active proxy for session ${sessionId}, sending ${allFnBps.length} function breakpoint(s).`
      );
      const response =
        await session.proxyManager.sendDapRequest<DebugProtocol.SetFunctionBreakpointsResponse>(
          'setFunctionBreakpoints',
          { breakpoints: allFnBps.map(toFunctionBreakpoint) }
        );
      const responseBps = response?.body?.breakpoints;
      if (responseBps) {
        // Positional match, same DAP guarantee as setBreakpoints
        for (let i = 0; i < Math.min(responseBps.length, allFnBps.length); i++) {
          const bpInfo = responseBps[i];
          const record = allFnBps[i];
          // A stop already proved this breakpoint bound (issue #673): an
          // "unbound" answer keeps the id current and nothing else — the
          // same rule the line path applies.
          if (keepHitProven(record, bpInfo)) {
            continue;
          }
          record.verified = bpInfo.verified;
          record.verifiedBy = record.verified ? 'adapter' : undefined;
          record.adapterId = bpInfo.id ?? record.adapterId;
          setAdapterMessage(record, bpInfo.message, record.verified);
          if (record.verified) {
            if (typeof bpInfo.line === 'number') {
              record.boundLine = bpInfo.line;
            }
            if (bpInfo.source?.path) {
              record.boundFile = bpInfo.source.path;
            }
          } else {
            // An unverified record claims no binding location.
            record.boundFile = undefined;
            record.boundLine = undefined;
          }
          if (allFnBps[i].verified) {
            this.ctx.logger.info('debug:breakpoint', {
              event: 'verified',
              sessionId,
              sessionName: session.name,
              breakpointId: allFnBps[i].id,
              functionName: allFnBps[i].functionName,
              line: allFnBps[i].boundLine,
              verified: true,
              timestamp: Date.now(),
            });
          }
        }
      }
      return { synced: true };
    } catch (error) {
      this.ctx.logger.error(
        `[SessionManager] Error sending setFunctionBreakpoints to proxy for session ${sessionId}:`,
        error
      );
      // Function breakpoints are never child-mirrored (js-debug's are
      // CDP-delivered, issue #295): the answer is always authoritative.
      return this.failedSync(session, error, allFnBps, false);
    }
  }

  /**
   * The launch-time unbound-function-breakpoint warning, with the policy
   * resolved from the session store. The lookup goes through the same guard
   * the name hooks use, so an unknown language degrades to "no policy" —
   * which is exactly what the pure builder expects.
   */
  functionBreakpointLaunchWarning(session: ManagedSession): string | undefined {
    return buildFunctionBreakpointLaunchWarning(
      session,
      this.policyHook(session.language, (policy) => policy)
    );
  }

  /**
   * Remove one breakpoint by its id (the id returned by setBreakpoint).
   * The removal always takes effect in the session's breakpoint store; if the
   * debuggee is live the file's remaining set is re-sent immediately.
   * Deliberately works after the debuggee exits — the surviving set is
   * re-applied on the next launch. Checks line and function breakpoints
   * alike (shared UUID namespace).
   */
  async removeBreakpoint(
    sessionId: string,
    breakpointId: string
  ): Promise<{ removed?: Breakpoint | FunctionBreakpoint; warning?: string }> {
    const session = this.ctx.getSession(sessionId);

    const functionBreakpoint = session.functionBreakpoints?.get(breakpointId);
    if (functionBreakpoint) {
      this.deleteFunctionBreakpointRecord(session, sessionId, functionBreakpoint);
      const { warning } = await this.syncFunctionBreakpoints(session);
      return { removed: functionBreakpoint, warning };
    }

    const breakpoint = session.breakpoints.get(breakpointId);
    if (!breakpoint) {
      return { removed: undefined };
    }

    session.breakpoints.delete(breakpointId);
    this.ctx.logger.info('debug:breakpoint', {
      event: 'removed',
      sessionId,
      sessionName: session.name,
      breakpointId,
      file: breakpoint.file,
      line: breakpoint.line,
      timestamp: Date.now(),
    });

    const { warning } = await this.syncBreakpointsForFile(session, breakpoint.file);
    return { removed: breakpoint, warning };
  }

  /**
   * Remove every function breakpoint a name addresses, in ONE DAP re-send
   * (issue #559). The literal name is matched alongside the policy-resolved
   * one, so a record stored un-rewritten (policy lookup failure, or set
   * through another path) stays removable.
   *
   * Removing the matches one at a time would re-send the session's whole
   * function-breakpoint set per match (setFunctionBreakpoints is replace-all
   * for the session), joining N copies of any live-sync warning and leaving
   * the debuggee armed with the not-yet-deleted duplicates in between. Every
   * match is therefore deleted from the store first and the surviving set
   * re-sent once.
   */
  async removeFunctionBreakpointsByName(
    sessionId: string,
    requestedName: string
  ): Promise<FunctionBreakpointRemoval> {
    const session = this.ctx.getSession(sessionId);
    const { effectiveName, normalized, hint } = this.resolveFunctionBreakpointName(
      sessionId,
      requestedName
    );
    // The resolution's own vocabulary, forwarded rather than re-encoded: the
    // caller discloses `requestedName` only when `normalized` says a rewrite
    // happened, the same rule set_breakpoint applies (issue #550).
    const disclosure = { functionName: effectiveName, requestedName, normalized };

    const removed = Array.from(session.functionBreakpoints.values())
      .filter(bp => bp.functionName === effectiveName || bp.functionName === requestedName)
      // The order list_breakpoints reports function breakpoints in; the
      // store's insertion order is not part of the contract.
      .sort((a, b) => a.functionName.localeCompare(b.functionName));
    if (removed.length === 0) {
      // The policy advisory IS the warning here — it is what explains why
      // nothing matched (issues #303/#308).
      return { removed, ...disclosure, warning: hint || undefined };
    }

    for (const bp of removed) {
      this.deleteFunctionBreakpointRecord(session, sessionId, bp);
    }

    const { warning } = await this.syncFunctionBreakpoints(session);
    return { removed, ...disclosure, warning };
  }

  /**
   * Delete one function-breakpoint record from the store and log the removal.
   * The by-id and the by-name path are the only producers of function-breakpoint
   * 'removed' records and must produce the identical record. The DAP re-send
   * stays with the caller: setFunctionBreakpoints is replace-all for the whole
   * session, so a batch removal deletes every match first and sends once.
   */
  private deleteFunctionBreakpointRecord(
    session: ManagedSession,
    sessionId: string,
    bp: FunctionBreakpoint
  ): void {
    session.functionBreakpoints.delete(bp.id);
    this.ctx.logger.info('debug:breakpoint', {
      event: 'removed',
      sessionId,
      sessionName: session.name,
      breakpointId: bp.id,
      functionName: bp.functionName,
      timestamp: Date.now(),
    });
  }

  /**
   * Remove ALL breakpoints at a file:line location (duplicates at one line —
   * e.g. with different conditions — are removed together; DAP replace-all
   * semantics cannot distinguish them anyway). Same lifecycle behavior as
   * removeBreakpoint.
   */
  async removeBreakpointsByLocation(
    sessionId: string,
    file: string,
    line: number
  ): Promise<{ removed: Breakpoint[]; warning?: string }> {
    const session = this.ctx.getSession(sessionId);

    const removed = Array.from(session.breakpoints.values())
      .filter(bp => bp.file === file && bp.line === line);
    if (removed.length === 0) {
      return { removed: [] };
    }

    for (const bp of removed) {
      session.breakpoints.delete(bp.id);
      this.ctx.logger.info('debug:breakpoint', {
        event: 'removed',
        sessionId,
        sessionName: session.name,
        breakpointId: bp.id,
        file: bp.file,
        line: bp.line,
        timestamp: Date.now(),
      });
    }

    const { warning } = await this.syncBreakpointsForFile(session, file);
    return { removed, warning };
  }

  /**
   * Remove all of the session's breakpoints, or all breakpoints in one file.
   * Clearing zero breakpoints is success, not an error. Works in every
   * lifecycle state; live sessions get one empty/remaining setBreakpoints
   * re-send per affected file.
   */
  async clearBreakpoints(
    sessionId: string,
    file?: string
  ): Promise<{ cleared: number; files: string[]; warning?: string }> {
    const session = this.ctx.getSession(sessionId);

    const toClear = Array.from(session.breakpoints.values())
      .filter(bp => file === undefined || bp.file === file);
    const files = [...new Set(toClear.map(bp => bp.file))];

    // Function breakpoints are not file-scoped: only an unscoped clear
    // touches them (issue #271 phase 3).
    const fnToClear = file === undefined
      ? Array.from(session.functionBreakpoints?.values() ?? [])
      : [];

    for (const bp of toClear) {
      session.breakpoints.delete(bp.id);
    }
    for (const bp of fnToClear) {
      session.functionBreakpoints.delete(bp.id);
    }
    if (toClear.length > 0 || fnToClear.length > 0) {
      this.ctx.logger.info('debug:breakpoint', {
        event: 'cleared',
        sessionId,
        sessionName: session.name,
        cleared: toClear.length + fnToClear.length,
        files,
        functionBreakpoints: fnToClear.length,
        timestamp: Date.now(),
      });
    }

    const warnings: string[] = [];
    for (const clearedFile of files) {
      const { warning } = await this.syncBreakpointsForFile(session, clearedFile);
      if (warning) warnings.push(warning);
    }
    if (fnToClear.length > 0) {
      const { warning } = await this.syncFunctionBreakpoints(session);
      if (warning) warnings.push(warning);
    }

    return {
      cleared: toClear.length + fnToClear.length,
      files,
      ...(warnings.length > 0 ? { warning: warnings.join('; ') } : {})
    };
  }
}
