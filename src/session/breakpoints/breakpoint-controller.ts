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
 */
import { v4 as uuidv4 } from 'uuid';
import {
  Breakpoint,
  FunctionBreakpoint,
  SessionLifecycleState,
  SessionState,
  toFunctionBreakpoint,
  toSourceBreakpoint,
  type AdapterPolicy
} from '@debugmcp/shared';
import { DebugProtocol } from '@vscode/debugprotocol';
import { SessionTerminatedError } from '../../errors/debug-errors.js';
import { consumeChildSourced } from '../../utils/child-origin-events.js';
import { normalizeBreakpointMessage } from '../../utils/breakpoint-message.js';
import type { ManagedSession } from '../session-store.js';
import type { BreakpointContext } from '../operations-context.js';
import { buildFunctionBreakpointLaunchWarning } from './launch-warnings.js';

/** Outcome of a DAP re-send: whether it reached the adapter, and why not. */
export interface BreakpointSyncOutcome {
  synced: boolean;
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

    // Check if session is terminated
    if (session.sessionLifecycle === SessionLifecycleState.TERMINATED) {
      throw new SessionTerminatedError(sessionId);
    }

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
        // For child-mirroring adapters (js-debug), setBreakpoints responses
        // come from the parent session, which owns no runtime: its verified
        // flags are pessimistic and its ids belong to a different id space
        // than the child events that carry the real verification. Treat the
        // child as authoritative — never let a parent response downgrade
        // verified state or clobber child adapter ids.
        const childAuthoritative =
          !!this.ctx.selectPolicy(session.language)?.getDapClientBehavior?.().mirrorBreakpointsToChild;
        // A response the proxy marked child-sourced (issue #500) carries the
        // child session's own answer — the authoritative one — so it stamps
        // fully instead of upgrade-only.
        const childSourced = consumeChildSourced(response);
        // Update ALL breakpoints from response (positional match)
        for (let i = 0; i < Math.min(responseBps.length, allBpsForFile.length); i++) {
          const bpInfo = responseBps[i];
          const keepChildState =
            childAuthoritative && !childSourced && allBpsForFile[i].verified === true;
          if (childAuthoritative && childSourced) {
            allBpsForFile[i].verified = bpInfo.verified;
            // Only a VERIFIED child id enters the store: stub ids are
            // unstable across the pending→bound transition (issue #495).
            if (bpInfo.verified === true && typeof bpInfo.id === 'number') {
              allBpsForFile[i].adapterId = bpInfo.id;
            }
          } else if (childAuthoritative) {
            allBpsForFile[i].verified = allBpsForFile[i].verified || bpInfo.verified;
          } else {
            allBpsForFile[i].verified = bpInfo.verified;
            allBpsForFile[i].adapterId = bpInfo.id ?? allBpsForFile[i].adapterId;
          }
          allBpsForFile[i].line = bpInfo.line || allBpsForFile[i].line;
          if (!keepChildState) {
            // Normalize before storing (issue #471): raw l10n keys like
            // js-debug's "breakpoint.provisionalBreakpoint" must never sit in
            // the store, and a provisional note must not survive verification.
            allBpsForFile[i].message = normalizeBreakpointMessage(
              bpInfo.message,
              allBpsForFile[i].verified
            );
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
      const message = getErrorMessage(error);
      return { synced: false, warning: this.buildLiveSyncWarning(session, message) };
    }
  }

  /**
   * Compose the live-sync failure warning. For ruby attach sessions whose
   * error is rdbg's "<path> is not available", append topology guidance
   * (issue #357): the path was rejected on the debug TARGET's filesystem
   * (e.g. container server + host rdbg, or vice versa) — expected behavior,
   * not a debugger fault. Same hint-append style as the netcoredbg
   * no-symbols guidance above.
   */
  private buildLiveSyncWarning(session: ManagedSession, message: string): string {
    let warning = `Breakpoint state updated, but live sync failed: ${message}`;
    if (session.attachMode && session.language === 'ruby' && /is not available/.test(message)) {
      warning += ' (Hint: attach sessions send breakpoint paths to the remote debugger verbatim; the path must be valid on the debug target\'s filesystem. Use target-side paths, or pass localfsMap in the attach config to map local paths to remote ones.)';
    }
    return warning;
  }

  /**
   * Set a function (symbol-addressed) breakpoint (issue #271 phase 3).
   * Session-global — no file. Queued like line breakpoints when no debuggee
   * is live; synced immediately otherwise.
   */
  async setFunctionBreakpoint(
    sessionId: string,
    bp: {
      functionName: string;
      condition?: string;
    }
  ): Promise<{ breakpoint: FunctionBreakpoint; warning?: string }> {
    const session = this.ctx.getSession(sessionId);

    if (session.sessionLifecycle === SessionLifecycleState.TERMINATED) {
      throw new SessionTerminatedError(sessionId);
    }

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
    return { breakpoint: newBreakpoint, warning: sync.warning };
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
          allFnBps[i].verified = bpInfo.verified;
          allFnBps[i].adapterId = bpInfo.id ?? allFnBps[i].adapterId;
          allFnBps[i].message = bpInfo.message;
          if (typeof bpInfo.line === 'number') {
            allFnBps[i].boundLine = bpInfo.line;
          }
          if (bpInfo.source?.path) {
            allFnBps[i].boundFile = bpInfo.source.path;
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
      const message = getErrorMessage(error);
      return { synced: false, warning: this.buildLiveSyncWarning(session, message) };
    }
  }

  /**
   * The launch-time unbound-function-breakpoint warning, with the policy
   * resolved from the session store. The store's lookup throws for an unknown
   * language, and a warning is never worth failing a launch over, so the throw
   * degrades to "no policy" — which is also what the pure builder expects.
   */
  functionBreakpointLaunchWarning(session: ManagedSession): string | undefined {
    let policy: AdapterPolicy | undefined;
    try {
      policy = this.ctx.selectStorePolicy(session.language);
    } catch {
      policy = undefined;
    }
    return buildFunctionBreakpointLaunchWarning(session, policy);
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
      session.functionBreakpoints.delete(breakpointId);
      this.ctx.logger.info('debug:breakpoint', {
        event: 'removed',
        sessionId,
        sessionName: session.name,
        breakpointId,
        functionName: functionBreakpoint.functionName,
        timestamp: Date.now(),
      });
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
