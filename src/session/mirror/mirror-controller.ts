/**
 * `expose_session` / `unexpose_session`: the read-only DAP mirror an IDE can
 * attach to while the agent drives the session (issue #217).
 *
 * The listener itself lives in the proxy worker; this side owns only the
 * session's record of it. Both operations are written so the caller's desired
 * end-state holds either way — exposing twice returns the existing endpoint,
 * and unexposing something that was never exposed is a success — because the
 * record and reality can disagree (a dead worker takes its listener with it)
 * and the worker no-ops safely on a redundant request.
 */
import { MIRROR_EXPOSE_COMMAND, MIRROR_UNEXPOSE_COMMAND } from '../../proxy/dap-proxy-interfaces.js';
import { withTimeoutHint } from '../dap-request-helpers.js';
import type { SessionState } from '@debugmcp/shared';
import type { MirrorContext } from '../operations-context.js';

/** Result of expose_session (issue #217). */
export interface ExposeSessionResult {
  success: boolean;
  state: SessionState;
  host?: string;
  port?: number;
  token?: string;
  error?: string;
}

/** Result of unexpose_session (issue #217). */
export interface UnexposeSessionResult {
  success: boolean;
  state: SessionState;
  wasExposed?: boolean;
  closedClients?: number;
  error?: string;
}

export class MirrorController {
  constructor(private readonly ctx: MirrorContext) {}

  /**
   * Expose the session's live DAP connection as a read-only mirror endpoint
   * for IDE attach (issue #217). Idempotent: the worker returns the existing
   * endpoint (token unrotated) when already exposed. Allowed while RUNNING
   * as well as PAUSED — a paused-only gate would race the debuggee anyway.
   */
  async exposeSession(sessionId: string): Promise<ExposeSessionResult> {
    const session = this.ctx.getSession(sessionId);

    if (!session.proxyManager || !session.proxyManager.isRunning()) {
      return {
        success: false,
        state: session.state,
        error: 'No active debug session to expose — start_debugging or attach_to_process first'
      };
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await session.proxyManager.sendDapRequest<any>(MIRROR_EXPOSE_COMMAND, {});
      const body = response?.body;
      if (!body || typeof body.port !== 'number' || typeof body.token !== 'string') {
        return { success: false, state: session.state, error: 'Malformed mirrorExpose response from debug proxy' };
      }
      const host = typeof body.host === 'string' ? body.host : '127.0.0.1';
      this.ctx.updateSession(sessionId, {
        exposure: { host, port: body.port, token: body.token, exposedAt: Date.now() }
      });
      // The token is an attach capability — log the endpoint, never the token.
      this.ctx.logger.info(`[SM exposeSession ${sessionId}] Mirror listening on ${host}:${body.port}`);
      return { success: true, state: session.state, host, port: body.port, token: body.token };
    } catch (error) {
      this.ctx.logger.error(`[SM exposeSession ${sessionId}] Error: ${error}`);
      return {
        success: false,
        state: session.state,
        error: withTimeoutHint(error instanceof Error ? error.message : String(error))
      };
    }
  }

  /**
   * Close the session's mirror endpoint (issue #217). A no-op success when
   * not exposed — the caller's desired end-state holds either way.
   */
  async unexposeSession(sessionId: string): Promise<UnexposeSessionResult> {
    const session = this.ctx.getSession(sessionId);
    const hadRecord = session.exposure !== undefined;

    if (!session.proxyManager || !session.proxyManager.isRunning()) {
      // Worker gone => listener gone; just clear any stale record.
      if (hadRecord) {
        this.ctx.updateSession(sessionId, { exposure: undefined });
      }
      return { success: true, state: session.state, wasExposed: false };
    }

    try {
      // Always forward even without a parent record — record and reality can
      // disagree, and the worker no-ops safely.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await session.proxyManager.sendDapRequest<any>(MIRROR_UNEXPOSE_COMMAND, {});
      this.ctx.updateSession(sessionId, { exposure: undefined });
      const body = response?.body;
      return {
        success: true,
        state: session.state,
        wasExposed: body?.closed === true || hadRecord,
        ...(typeof body?.closedClients === 'number' ? { closedClients: body.closedClients } : {})
      };
    } catch (error) {
      this.ctx.logger.error(`[SM unexposeSession ${sessionId}] Error: ${error}`);
      return {
        success: false,
        state: session.state,
        error: withTimeoutHint(error instanceof Error ? error.message : String(error))
      };
    }
  }
}
