/**
 * Session lifecycle tools: create_debug_session, list_debug_sessions,
 * close_debug_session.
 */
import { DebugLanguage, DebugSessionInfo } from '@debugmcp/shared';
import { UnsupportedLanguageError } from '../../errors/debug-errors.js';
import { ErrorMessages } from '../../utils/error-messages.js';
import { checkLaunchToolchain } from '../../utils/language-availability.js';
import { isContainerRuntime } from '../../utils/container-path-utils.js';
import type { ToolContext, ToolHandler } from '../tool-context.js';
import { assertPlainObjectArg, requireSessionId } from '../tool-validation.js';
import { successWarning } from './shared.js';
import { failureResult, jsonResult, rethrowAsMcpError, type ToolResult } from '../tool-result.js';

export const createDebugSessionTool: ToolHandler = async (ctx, args) => {
  // Validate before creating the session so a bad argument does
  // not leave an orphan session behind (issue #336).
  assertPlainObjectArg(args.adapterConfig, 'adapterConfig');

  // Ensure requested language is among dynamically supported ones
  const supported = await ctx.getSupportedLanguagesAsync();
  const lang = (args.language || DebugLanguage.PYTHON) as DebugLanguage;
  const requested = lang as unknown as string;
  // Reads MCP_CONTAINER live rather than through the IEnvironment in scope: the
  // gating tests stub it with `vi.stubEnv` after a ProcessEnvironment has already
  // snapshotted process.env, so only the live read sees them.
  const allowInContainer = isContainerRuntime() && requested === DebugLanguage.PYTHON;
  if (!allowInContainer && !supported.includes(lang)) {
    throw new UnsupportedLanguageError(lang, supported);
  }

  // Fail fast when the adapter can't do ANYTHING here (issue
  // #360). A failed launch-toolchain probe alone must not block
  // session creation: the caller may intend to attach (with or
  // without a port at create time), and direct-connect attach
  // needs no local toolchain — e.g. ruby attach works in the
  // container image without a launch toolchain. Launch itself is
  // still gated at start_debugging.
  {
    const launchGate = await checkLaunchToolchain(
      requested,
      ctx.getAdapterRegistry(),
      ctx.validationCache,
      ctx.logger
    );
    if (!launchGate.available) {
      const registry = ctx.getAdapterRegistry();
      const attachMechanism = await (async () => {
        try {
          const factory = typeof registry?.getFactory === 'function'
            ? await registry.getFactory(requested)
            : undefined;
          return factory?.getMetadata?.().modes?.attach ?? 'none';
        } catch {
          return 'none';
        }
      })();
      // 'direct-connect' attach runs inside the debuggee — usable
      // even when the local toolchain probe failed. 'spawn' attach
      // shares the failing toolchain; 'none' has no attach at all.
      if (attachMechanism !== 'direct-connect') {
        return failureResult(ErrorMessages.launchUnavailable(requested, launchGate.reason));
      }
      ctx.logger.warn(
        `[Server] create_debug_session(${requested}): launch toolchain unavailable (${launchGate.reason}); ` +
          `allowing session creation because direct-connect attach remains usable.`
      );
    }
  }

  const sessionInfo = await ctx.createDebugSession({
    language: lang,
    name: args.name,
    executablePath: args.executablePath
  });

  // Log session creation
  ctx.logger.info('session:created', {
    sessionId: sessionInfo.id,
    sessionName: sessionInfo.name,
    language: sessionInfo.language,
    executablePath: args.executablePath,
    timestamp: Date.now()
  });

  // A new output resource is now listable (issue #218)
  ctx.outputResources.notifyListChanged();

  // Check if attach mode is requested (host/port provided)
  const isAttachMode = args.port !== undefined;

  if (isAttachMode) {
    // Attach mode: immediately attach to the running process
    ctx.logger.info('session:attach-mode', {
      sessionId: sessionInfo.id,
      host: args.host || 'localhost',
      port: args.port,
      timestamp: Date.now()
    });

    try {
      const attachResult = await ctx.sessionManager.attachToProcess(sessionInfo.id, {
        port: args.port as number,
        host: (args.host as string) || 'localhost',
        timeout: (args.timeout as number) || 30000,
        stopOnEntry: args.stopOnEntry,
        verifyTimeout: args.verifyTimeout,
        adapterConfig: args.adapterConfig,
      });

      // Forward the attach payload the same way attach_to_process
      // does: structured failure diagnostics (initProgress /
      // proxyLogPath, issue #551) and the dropped-adapterConfig
      // warning (issue #450) must reach this entry point too.
      const attachData = attachResult.data;
      const warning = successWarning(attachResult);
      return jsonResult({
        success: attachResult.success,
        sessionId: sessionInfo.id,
        state: attachResult.state,
        message: attachResult.success
          ? `Created and attached ${sessionInfo.language} debug session: ${sessionInfo.name}`
          : `Created session but attach failed: ${attachResult.error || 'Unknown error'}`,
        ...(attachData ? { data: attachData } : {}),
        ...(warning ? { warning } : {})
      });
    } catch (error) {
      ctx.logger.error('session:attach-failed', {
        sessionId: sessionInfo.id,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now()
      });

      return jsonResult({
        success: false,
        sessionId: sessionInfo.id,
        state: 'error',
        message: `Created session but failed to attach: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  } else {
    // Launch mode: just create the session
    return jsonResult({
      success: true,
      sessionId: sessionInfo.id,
      message: `Created ${sessionInfo.language} debug session: ${sessionInfo.name}`
    });
  }
};

export async function handleListDebugSessions(ctx: ToolContext): Promise<ToolResult> {
  try {
    const sessionsInfo: DebugSessionInfo[] = ctx.sessionManager.getAllSessions();
    const sessionData = sessionsInfo.map((session: DebugSessionInfo) => {
      const mappedSession: Record<string, unknown> = { 
          id: session.id, 
          name: session.name, 
          language: session.language as DebugLanguage, 
          state: session.state, 
          createdAt: session.createdAt.toISOString(),
      };
      if (session.updatedAt) {
          mappedSession.updatedAt = session.updatedAt.toISOString();
      }
      if (session.lastStop) {
          mappedSession.lastStop = session.lastStop;
      }
      if (session.exitCode !== undefined) {
          mappedSession.exitCode = session.exitCode;
      }
      if (session.exposure) {
          // Mirror endpoint host/port; the token never leaves expose_session.
          mappedSession.exposure = session.exposure;
      }
      return mappedSession;
    });
    return jsonResult({ success: true, sessions: sessionData, count: sessionData.length });
  } catch (error) {
    ctx.logger.error('Failed to list debug sessions', { error });
    rethrowAsMcpError(error, 'Failed to list debug sessions');
  }
}

export const listDebugSessionsTool: ToolHandler = async (ctx) => {
  return handleListDebugSessions(ctx);
};

export const closeDebugSessionTool: ToolHandler = async (ctx, args) => {
  requireSessionId(args);

  const sessionName = ctx.getSessionName(args.sessionId);
  const closed = await ctx.closeDebugSession(args.sessionId);

  if (closed) {
    // Log session closure
    ctx.logger.info('session:closed', {
      sessionId: args.sessionId,
      sessionName: sessionName,
      timestamp: Date.now()
    });

    // The session's output resource is gone (issue #218)
    ctx.outputResources.forgetSession(args.sessionId);
    ctx.outputResources.notifyListChanged();
  }

  return jsonResult({ success: closed, message: closed ? `Closed debug session: ${args.sessionId}` : `Failed to close debug session: ${args.sessionId}` });
};
