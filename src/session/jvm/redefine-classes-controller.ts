/**
 * `redefine_classes`: JVM hot swap (Java only).
 *
 * The DAP round trip is the easy half. The interesting half is what a hot swap
 * does to breakpoints: replacing a class's bytecode invalidates line numbers,
 * so statement anchors — which are content identities, not line numbers — are
 * re-resolved against the source now on disk and the affected files re-sent, so
 * the JDI replant binds against the NEW line table (issue #464). That ordering
 * is load-bearing and is why this lives next to the breakpoint controller
 * rather than inside it.
 */
import { resolveDapTimeoutOverride, withTimeoutHint } from '../dap-request-helpers.js';
import { reresolveAnchors, type AnchorResolution } from '../breakpoints/anchor-resolution.js';
import type { BreakpointController } from '../breakpoints/breakpoint-controller.js';
import type { HotSwapContext } from '../operations-context.js';

export interface RedefineClassesResult {
  success: boolean;
  redefined?: string[];
  redefinedCount?: number;
  skippedNotLoaded?: number;
  failedCount?: number;
  failed?: Array<{ fqcn: string; error: string }>;
  scannedFiles?: number;
  newestTimestamp?: number;
  /** Breakpoints re-planted after redefine (issue #370). */
  replantedBreakpoints?: number;
  /**
   * Statement-anchored breakpoints re-resolved against the new source after
   * the hot-swap (issue #464) — same shape restart_debugging returns.
   */
  anchorResolution?: AnchorResolution;
  warning?: string;
  error?: string;
}

export class RedefineClassesController {
  constructor(
    private readonly ctx: HotSwapContext,
    private readonly breakpoints: BreakpointController
  ) {}

  async redefineClasses(
    sessionId: string,
    classesDir: string,
    sinceTimestamp: number = 0,
    timeoutMs?: number
  ): Promise<RedefineClassesResult> {
    const session = this.ctx.getSession(sessionId);
    this.ctx.logger.info(
      `[SM redefineClasses ${sessionId}] classesDir: "${classesDir}", since: ${sinceTimestamp}`
    );

    const timeoutOverride = resolveDapTimeoutOverride(
      timeoutMs,
      `SM redefineClasses ${sessionId}`,
      this.ctx.logger
    );
    if (timeoutOverride.error) {
      this.ctx.logger.warn(`[SM redefineClasses ${sessionId}] ${timeoutOverride.error}`);
      return { success: false, error: timeoutOverride.error };
    }

    if (!session.proxyManager || !session.proxyManager.isRunning()) {
      return { success: false, error: 'No active debug session' };
    }

    try {
      const redefineArgs = { classesDir, sinceTimestamp };
      const response = timeoutOverride.timeoutMs !== undefined
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? await session.proxyManager.sendDapRequest<any>(
            'redefineClasses', redefineArgs, { timeoutMs: timeoutOverride.timeoutMs })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        : await session.proxyManager.sendDapRequest<any>(
            'redefineClasses', redefineArgs);

      const body = response?.body;
      if (!body) {
        return { success: false, error: 'No response body from redefineClasses' };
      }

      // Statement anchors are content identities and a hot-swap invalidates
      // line numbers (issue #464): re-resolve them against the new source —
      // which IS what is on disk in the edit -> recompile -> hot-swap loop —
      // and re-send the affected files so the JDI replant binds the moved
      // lines against the new line table. Ordered after the redefine
      // response, i.e. after vm.redefineClasses, by construction.
      let anchorResolution: AnchorResolution | undefined;
      const syncWarnings: string[] = [];
      if ((body.redefinedCount ?? 0) > 0) {
        anchorResolution = await reresolveAnchors(session, this.ctx);
        if (anchorResolution && anchorResolution.moved.length > 0) {
          const movedFiles = [...new Set(anchorResolution.moved.map(m => m.file))];
          for (const file of movedFiles) {
            const { warning } = await this.breakpoints.syncBreakpointsForFile(session, file);
            if (warning) {
              syncWarnings.push(warning);
            }
          }
        }
        if (anchorResolution && anchorResolution.stale.length > 0) {
          syncWarnings.push(
            `${anchorResolution.stale.length} statement-anchored breakpoint(s) could not be re-resolved ` +
            `against the new source and keep their previous line — see anchorResolution.stale`
          );
        }
      }

      return {
        success: true,
        redefined: body.redefined,
        redefinedCount: body.redefinedCount,
        skippedNotLoaded: body.skippedNotLoaded,
        failedCount: body.failedCount,
        failed: body.failed,
        scannedFiles: body.scannedFiles,
        newestTimestamp: body.newestTimestamp,
        replantedBreakpoints: body.replantedBreakpoints,
        ...(anchorResolution ? { anchorResolution } : {}),
        ...(syncWarnings.length > 0 ? { warning: syncWarnings.join('; ') } : {}),
      };
    } catch (error) {
      this.ctx.logger.error(`[SM redefineClasses ${sessionId}] Error: ${error}`);
      return {
        success: false,
        error: withTimeoutHint(error instanceof Error ? error.message : String(error)),
      };
    }
  }
}
