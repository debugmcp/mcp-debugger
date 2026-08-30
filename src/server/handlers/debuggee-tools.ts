/**
 * Debuggee lifecycle tools: start_debugging, restart_debugging,
 * attach_to_process, detach_from_process, redefine_classes.
 */
import { ErrorCode as McpErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import type { ToolHandler } from '../tool-context.js';
import { attachWarning } from './shared.js';
import {
  assertPlainObjectArg,
  normalizeStartDebuggingArgs,
  requireSessionId,
  validateBreakOnExceptions
} from '../tool-validation.js';
import { jsonResult, prettyJsonResult, sessionErrorResultOrThrow } from '../tool-result.js';

export const startDebuggingTool: ToolHandler = async (ctx, args) => {
  if (!args.sessionId || !args.scriptPath) {
    throw new McpError(McpErrorCode.InvalidParams, 'Missing required parameters');
  }

  try {
    assertPlainObjectArg(args.adapterLaunchConfig, 'adapterLaunchConfig');

    const intake = normalizeStartDebuggingArgs(args.dapLaunchArgs, args.breakOnExceptions);
    const debugResult = await ctx.startDebugging(
      args.sessionId,
      args.scriptPath,
      args.args,
      intake.dapLaunchArgs,
      args.dryRunSpawn,
      args.adapterLaunchConfig,
      validateBreakOnExceptions(intake.breakOnExceptions)
    );
    const responsePayload: Record<string, unknown> = {
      success: debugResult.success,
      state: debugResult.state,
      message: debugResult.error ? debugResult.error : debugResult.data?.message || `Operation status for ${args.scriptPath}`,
    };
    if (debugResult.data) {
      responsePayload.data = debugResult.data;
    }
    // Top-level warning join (set_breakpoint pattern): intake
    // normalization notes (issue #305) plus any session-manager
    // warning (unbound function breakpoints, issue #308).
    const dataWarning = debugResult.data?.warning;
    const startWarnings = [...intake.warnings, dataWarning].filter(Boolean);
    if (debugResult.success && startWarnings.length > 0) {
      responsePayload.warning = startWarnings.join('; ');
    }
    return jsonResult(responsePayload);
  } catch (error) {
    // The 'session-state' sniff reads the McpError MESSAGE: terminated,
    // closed, or ('not found' AND 'Session') becomes {success: false};
    // everything else is re-thrown. Being a message sniff it also catches
    // errors that merely echo user text -- a script path containing
    // "Sessions" makes "Script file not found: ..." match -- so it is wider
    // than "session-lifecycle failures only". Preserved verbatim from before
    // the extraction; classifying by error code instead is a follow-up.
    return sessionErrorResultOrThrow(error, 'session-state', { state: 'stopped' });
  }
};

export const restartDebuggingTool: ToolHandler = async (ctx, args) => {
  requireSessionId(args);
  try {
    const debugResult = await ctx.restartDebugging(args.sessionId);
    const responsePayload: Record<string, unknown> = {
      success: debugResult.success,
      state: debugResult.state,
      message: debugResult.error
        ? debugResult.error
        : debugResult.data?.message || 'Debugging restarted',
    };
    if (debugResult.error) {
      responsePayload.error = debugResult.error;
    }
    if (debugResult.data) {
      responsePayload.data = debugResult.data;
      // Surface the merged restart warning (stale anchors and/or
      // unbound function breakpoints) at the top level too —
      // same discoverability as set_breakpoint/start_debugging.
      const restartWarning = debugResult.data.warning;
      if (debugResult.success && restartWarning) {
        responsePayload.warning = restartWarning;
      }
    }
    return jsonResult(responsePayload);
  } catch (error) {
    return sessionErrorResultOrThrow(error, 'session-state');
  }
};

export const attachToProcessTool: ToolHandler = async (ctx, args) => {
  requireSessionId(args);

  try {
    assertPlainObjectArg(args.adapterConfig, 'adapterConfig');

    ctx.logger.info('Attach to process requested', {
      sessionId: args.sessionId,
      port: args.port,
      host: args.host,
      processId: args.processId
    });

    const attachResult = await ctx.sessionManager.attachToProcess(args.sessionId, {
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
    });

    const responsePayload: Record<string, unknown> = {
      success: attachResult.success,
      state: attachResult.state,
      message: attachResult.error ||
        attachResult.data?.message ||
        'Attach operation completed'
    };

    if (attachResult.data) {
      responsePayload.data = attachResult.data;
      // Surface the dropped-adapterConfig-keys warning (issue
      // #450) at the top level too — same discoverability as
      // set_breakpoint/start_debugging/restart_debugging.
      const warning = attachWarning(attachResult);
      if (warning) {
        responsePayload.warning = warning;
      }
    }

    return jsonResult(responsePayload);
  } catch (error) {
    // Handle session state errors specifically
    return sessionErrorResultOrThrow(error, 'session-state', { state: 'stopped' });
  }
};

export const detachFromProcessTool: ToolHandler = async (ctx, args) => {
  requireSessionId(args);

  try {
    ctx.logger.info('Detach from process requested', {
      sessionId: args.sessionId,
      terminateProcess: args.terminateProcess
    });

    const detachResult = await ctx.sessionManager.detachFromProcess(
      args.sessionId,
      args.terminateProcess ?? false
    );

    const responsePayload: Record<string, unknown> = {
      success: detachResult.success,
      state: detachResult.state,
      message: detachResult.error ||
        detachResult.data?.message ||
        'Detach operation completed'
    };

    if (detachResult.data) {
      responsePayload.data = detachResult.data;
    }

    return jsonResult(responsePayload);
  } catch (error) {
    // Handle session state errors specifically
    return sessionErrorResultOrThrow(error, 'session-state', { state: 'stopped' });
  }
};

export const redefineClassesTool: ToolHandler = async (ctx, args) => {
  const redefineResult = await ctx.sessionManager.redefineClasses(
    args.sessionId as string,
    args.classesDir as string,
    (args.sinceTimestamp as number) || 0,
    args.timeout
  );
  return prettyJsonResult(redefineResult);
};
