/**
 * DAP mirror tools: expose_session, unexpose_session (issue #217).
 */
import { isContainerMode } from '../../utils/container-path-utils.js';
import type { ToolContext, ToolHandler } from '../tool-context.js';
import { requireSessionId } from '../tool-validation.js';
import { rethrowAsMcpError, sessionErrorToResult, type ToolResult } from '../tool-result.js';

export async function handleExposeSession(ctx: ToolContext, sessionId: string): Promise<ToolResult> {
  try {
    ctx.validateSession(sessionId);
    const result = await ctx.sessionManager.exposeSession(sessionId);
    if (!result.success) {
      return { content: [{ type: 'text', text: JSON.stringify({
        success: false,
        state: result.state,
        error: result.error
      }) }] };
    }
    let message =
      `Session exposed for IDE attach at ${result.host}:${result.port}. ` +
      `VS Code: add a launch.json config {"name": "Mirror: agent debug session", ` +
      `"type": "<your language's debug type, e.g. python>", "request": "attach", ` +
      `"debugServer": ${result.port}, "mirrorToken": "${result.token}"} and start it. ` +
      `The mirror is inspect-only; execution control stays with this session. ` +
      `Full guidance: docs/tool-reference.md#expose_session.`;
    if (isContainerMode(ctx.environment)) {
      message +=
        ' Note: this server runs inside a container — the mirror listens on the ' +
        "container's loopback and is not reachable from your host IDE without extra " +
        'networking (e.g. docker run --network host on Linux, or a socat/ssh forward ' +
        'into the container).';
    }
    return { content: [{ type: 'text', text: JSON.stringify({
      success: true,
      state: result.state,
      host: result.host,
      port: result.port,
      token: result.token,
      message
    }) }] };
  } catch (error) {
    ctx.logger.error('Failed to expose session', { error });
    return sessionErrorToResult(error, 'typed') ??
      rethrowAsMcpError(error, 'Failed to expose session');
  }
}

export const exposeSessionTool: ToolHandler = async (ctx, args) => {
  requireSessionId(args);
  return await handleExposeSession(ctx, args.sessionId);
};

export async function handleUnexposeSession(ctx: ToolContext, sessionId: string): Promise<ToolResult> {
  try {
    ctx.validateSession(sessionId);
    const result = await ctx.sessionManager.unexposeSession(sessionId);
    const message = !result.success
      ? undefined
      : result.wasExposed
        ? `Mirror endpoint closed${typeof result.closedClients === 'number' ? ` (${result.closedClients} client${result.closedClients === 1 ? '' : 's'} disconnected)` : ''}`
        : 'Session was not exposed — nothing to close';
    return { content: [{ type: 'text', text: JSON.stringify({
      success: result.success,
      state: result.state,
      ...(result.wasExposed !== undefined ? { wasExposed: result.wasExposed } : {}),
      ...(message ? { message } : {}),
      ...(result.error ? { error: result.error } : {})
    }) }] };
  } catch (error) {
    ctx.logger.error('Failed to unexpose session', { error });
    return sessionErrorToResult(error, 'typed') ??
      rethrowAsMcpError(error, 'Failed to unexpose session');
  }
}

export const unexposeSessionTool: ToolHandler = async (ctx, args) => {
  requireSessionId(args);
  return await handleUnexposeSession(ctx, args.sessionId);
};
