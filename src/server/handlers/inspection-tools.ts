/**
 * Inspection tools: get_variables, get_stack_trace, get_scopes,
 * evaluate_expression, get_source_context, get_local_variables.
 */
import { ErrorCode as McpErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { SessionState } from '@debugmcp/shared';
import type { ToolContext, ToolHandler } from '../tool-context.js';
import { enforceExplicitNames, requireSessionId } from '../tool-validation.js';
import { variablePayloadExtras } from './shared.js';
import {
  failureResult,
  jsonResult,
  rethrowAsMcpError,
  sessionErrorResultOrThrow,
  sessionErrorToResult,
  type ToolResult
} from '../tool-result.js';

export const getVariablesTool: ToolHandler = async (ctx, args) => {
  if (!args.sessionId || args.scope === undefined) {
    throw new McpError(McpErrorCode.InvalidParams, 'Missing required parameters');
  }
  enforceExplicitNames(ctx.environment, 'get_variables', args.names);

  try {
    const { variables, truncation } = await ctx.getVariablesDetailed(args.sessionId, args.scope, args.names);

    // Log variable inspection (truncate large values)
    const truncatedVars = variables.map(v => ({
      name: v.name,
      type: v.type,
      value: v.value.length > 200 ? v.value.substring(0, 200) + '... (truncated)' : v.value
    }));

    ctx.logger.info('debug:variables', {
      sessionId: args.sessionId,
      sessionName: ctx.getSessionName(args.sessionId),
      variablesReference: args.scope,
      variableCount: variables.length,
      variables: truncatedVars.slice(0, 10), // Log first 10 variables
      timestamp: Date.now()
    });

    return jsonResult({ success: true, variables, count: variables.length, variablesReference: args.scope, ...variablePayloadExtras(variables, args.names, truncation) });
  } catch (error) {
    // Typed session errors report as {success: false}; anything else escapes.
    return sessionErrorResultOrThrow(error, 'typed');
  }
};

export const getStackTraceTool: ToolHandler = async (ctx, args) => {
  requireSessionId(args);

  try {
    // Default to false for cleaner output
    const includeInternals = args.includeInternals ?? false;
    const stackTrace = await ctx.getStackTrace(args.sessionId, includeInternals, args.threadId);
    const lastStop = ctx.sessionManager.getSession(args.sessionId)?.lastStop;
    const payload: Record<string, unknown> = {
      success: true,
      stackFrames: stackTrace.frames,
      count: stackTrace.frames.length,
      ...(typeof stackTrace.threadId === 'number' ? { threadId: stackTrace.threadId } : {}),
      includeInternals,
      stopReason: lastStop?.reason,
      lastStop
    };
    // Anything the result needs explaining (not paused, stack came
    // from a different thread, all threads frameless) plus the
    // issue #346 hidden-frames disclosure share the note field.
    const notes: string[] = [];
    if (stackTrace.note) {
      notes.push(stackTrace.note);
    }
    if (stackTrace.hiddenFrameCount > 0) {
      payload.hiddenFrames = stackTrace.hiddenFrameCount;
      notes.push(stackTrace.allFramesInternal
        ? `All ${stackTrace.totalFrameCount} frames are internal/runtime frames; showing the top internal frame so scopes and evaluate still work. Pass includeInternals: true to see the full stack.`
        : `${stackTrace.hiddenFrameCount} internal frame(s) hidden — pass includeInternals: true to see them.`);
    }
    if (notes.length > 0) {
      payload.note = notes.join(' ');
    }
    return jsonResult(payload);
  } catch (error) {
    const sessionResult = sessionErrorToResult(error, 'typed');
    if (sessionResult) {
      return sessionResult;
    }
    if (error instanceof Error && !(error instanceof McpError)) {
      // DAP-level failures (e.g. "Child session not ready ...")
      // must surface as errors, not as an empty-but-successful
      // stack trace (issue #124).
      return failureResult(error.message);
    }
    // Re-throw unexpected errors
    throw error;
  }
};

export const getScopesTool: ToolHandler = async (ctx, args) => {
  if (!args.sessionId || args.frameId === undefined) {
    throw new McpError(McpErrorCode.InvalidParams, 'Missing required parameters');
  }

  try {
    const scopes = await ctx.getScopes(args.sessionId, args.frameId);
    return jsonResult({ success: true, scopes });
  } catch (error) {
    // Typed session errors report as {success: false}; anything else escapes.
    return sessionErrorResultOrThrow(error, 'typed');
  }
};

export async function handleEvaluateExpression(ctx: ToolContext, args: { sessionId: string, expression: string, frameId?: number, timeout?: number }): Promise<ToolResult> {
  try {
    // Validate session
    ctx.validateSession(args.sessionId);

    // Check expression length (sanity check)
    if (args.expression.length > 10240) {
      throw new McpError(McpErrorCode.InvalidParams, 'Expression too long (max 10KB)');
    }

    // Call SessionManager's evaluateExpression method (no context is passed here;
    // the adapter policy chooses the DAP evaluate context)
    const result = await ctx.sessionManager.evaluateExpression(
      args.sessionId,
      args.expression,
      args.frameId,
      // Context is chosen by the adapter policy inside SessionManager
      args.timeout
    );

    // Log for audit trail
    ctx.logger.info('tool:evaluate_expression', {
      sessionId: args.sessionId,
      sessionName: ctx.getSessionName(args.sessionId),
      expression: args.expression.substring(0, 100), // Truncate for logging
      success: result.success,
      hasResult: !!result.result,
      timestamp: Date.now()
    });

    // Return formatted response
    return jsonResult(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Log the error
    ctx.logger.error('tool:evaluate_expression:error', {
      sessionId: args.sessionId,
      expression: args.expression.substring(0, 100),
      error: errorMessage,
      timestamp: Date.now()
    });

    // Handle session state errors specifically
    return sessionErrorToResult(error, 'session-state-or-not-paused') ??
      rethrowAsMcpError(error, 'Failed to evaluate expression');
  }
}

export const evaluateExpressionTool: ToolHandler = async (ctx, args) => {
  return await handleEvaluateExpression(ctx, args as { sessionId: string; expression: string; frameId?: number; timeout?: number });
};

export async function handleGetSourceContext(ctx: ToolContext, args: { sessionId: string, file: string, line: number, linesContext?: number }): Promise<ToolResult> {
  try {
    // Validate session
    ctx.validateSession(args.sessionId);

    // Check file exists for immediate feedback
    const fileCheck = await ctx.fileChecker.checkExists(args.file);
    if (!fileCheck.exists) {
      throw ctx.fileNotFoundError('Source file', args.file, fileCheck);
    }

    ctx.logger.info(`Source context requested for session: ${args.sessionId}, file: ${fileCheck.effectivePath}, line: ${args.line}`);

    // Get line context using the line reader
    const contextLines = args.linesContext ?? 5; // Default to 5 lines of context
    const lineContext = await ctx.lineReader.getLineContext(
      fileCheck.effectivePath,
      args.line,
      { contextLines }
    );

    if (!lineContext) {
      // File might be binary or unreadable
      return failureResult('Could not read source context. File may be binary or inaccessible.', {
        file: args.file,
        line: args.line
      });
    }

    // Log source context request
    ctx.logger.info('debug:source_context', {
      sessionId: args.sessionId,
      sessionName: ctx.getSessionName(args.sessionId),
      file: args.file,
      line: args.line,
      contextLines: contextLines,
      timestamp: Date.now()
    });

    return jsonResult({
      success: true,
      file: args.file,
      line: args.line,
      lineContent: lineContext.lineContent,
      surrounding: lineContext.surrounding,
      contextLines: contextLines
    });
  } catch (error) {
    ctx.logger.error('Failed to get source context', { error });
    return sessionErrorToResult(error, 'typed') ??
      rethrowAsMcpError(error, 'Failed to get source context');
  }
}

export const getSourceContextTool: ToolHandler = async (ctx, args) => {
  return await handleGetSourceContext(ctx, args as { sessionId: string; file: string; line: number; linesContext?: number });
};

export async function handleGetLocalVariables(ctx: ToolContext, args: { sessionId: string; includeSpecial?: boolean; names?: string[] }): Promise<ToolResult> {
  enforceExplicitNames(ctx.environment, 'get_local_variables', args.names);
  try {
    // Validate session
    ctx.validateSession(args.sessionId);

    // Get local variables using the new convenience method
    const result = await ctx.getLocalVariables(
      args.sessionId,
      args.includeSpecial ?? false,
      args.names
    );

    // Log for debugging
    ctx.logger.info('tool:get_local_variables', {
      sessionId: args.sessionId,
      sessionName: ctx.getSessionName(args.sessionId),
      includeSpecial: args.includeSpecial ?? false,
      variableCount: result.variables.length,
      frame: result.frame,
      scopeName: result.scopeName,
      timestamp: Date.now()
    });

    // Format response
    const response: Record<string, unknown> = {
      success: true,
      variables: result.variables,
      count: result.variables.length
    };

    // Same three decorations get_variables carries, in this tool's own order:
    // the size-guard advisory (issues #356/#359) says explicitly that data was
    // cut and how to fetch the rest, instead of silently dropping it.
    const extras = variablePayloadExtras(result.variables, args.names, result.truncation);
    if (extras.redaction) {
      response.redaction = extras.redaction;
    }
    if (extras.truncation) {
      response.truncation = extras.truncation;
    }
    if (extras.notFound) {
      response.notFound = extras.notFound;
    }

    // Include frame information if available
    if (result.frame) {
      response.frame = result.frame;
    }

    // Include scope name if available
    if (result.scopeName) {
      response.scopeName = result.scopeName;
    }

    // The tool walked down past an empty runtime/stdlib top frame — say so,
    // since `frame` no longer names the top of the stack (issue #468).
    if (result.anchorNote) {
      response.note = result.anchorNote;
    }

    // Surface adapter warnings embedded in the scope name — e.g. Delve
    // reports "Locals (warning: optimized function)" when the debuggee was
    // built with optimizations, which typically means missing variables.
    const warningMatch = result.scopeName?.match(/\(warning:[^)]*\)/i);
    if (warningMatch) {
      response.warning =
        `The debug adapter reported the locals scope as "${result.scopeName}". ` +
        'This usually means the target was compiled with optimizations, so variables may be missing or unreadable. ' +
        'For Go, rebuild the binary with -gcflags="all=-N -l" (exec mode) or launch the .go source directly (debug mode).';
    }

    // Add helpful messages for edge cases
    if (result.variables.length === 0) {
      if (!result.frame) {
        // Distinguish "not paused" from "paused but the anchored thread has
        // no frames" — the latter used to claim the debugger may not be
        // paused while list_debug_sessions said paused (issue #465).
        const sessionState = ctx.sessionManager.getSession(args.sessionId)?.state;
        response.message = sessionState === SessionState.PAUSED
          ? 'The session is paused, but the anchored thread reported no stack frames. ' +
            'Try get_stack_trace with a threadId from list_threads, or continue_execution ' +
            'followed by pause_execution to re-anchor on a reportable thread.'
          : 'No stack frames available. The debugger may not be paused.';
      } else if (!result.scopeName) {
        response.message = 'No local scope found in the current frame.';
      } else {
        response.message = `The ${result.scopeName} scope is empty.`;
      }
    }

    return jsonResult(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Log the error
    ctx.logger.error('tool:get_local_variables:error', {
      sessionId: args.sessionId,
      error: errorMessage,
      timestamp: Date.now()
    });

    // Handle session state errors specifically. A terminated session is a
    // normal end state (e.g. a step_out ran the program to completion) —
    // explain that instead of implying misuse.
    const stateMessage = errorMessage.includes('terminated')
      ? 'The program has terminated, so no frames or variables exist. Use restart_debugging to run it again.'
      : 'Cannot get local variables. The session must be paused at a breakpoint.';
    return sessionErrorToResult(error, 'session-state-or-not-paused', { message: stateMessage }) ??
      rethrowAsMcpError(error, 'Failed to get local variables');
  }
}

export const getLocalVariablesTool: ToolHandler = async (ctx, args) => {
  return await handleGetLocalVariables(ctx, args as { sessionId: string; includeSpecial?: boolean; names?: string[] });
};
