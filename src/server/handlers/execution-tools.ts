/**
 * Execution control tools: step_over / step_into / step_out (one handler
 * keyed by toolName), continue_execution, pause_execution, list_threads.
 */
import { SessionState } from '@debugmcp/shared';
import type { ToolContext, ToolHandler } from '../tool-context.js';
import type { DebugResult, StepResultData } from '../../session/session-manager-core.js';
import { requireSessionId } from '../tool-validation.js';
import { readLineContext } from './shared.js';
import {
  failureResult,
  jsonResult,
  rethrowAsMcpError,
  sessionErrorToResult,
  type ToolResult
} from '../tool-result.js';

/** The states that mean the step outlived its session (issue #574). */
const SESSION_OVER: ReadonlySet<SessionState> = new Set([
  SessionState.STOPPED,
  SessionState.ERROR
]);

export const stepTool: ToolHandler = async (ctx, args, toolName) => {
  requireSessionId(args);

  try {
    let stepResult: DebugResult<StepResultData>;
    if (toolName === 'step_over') {
      stepResult = await ctx.stepOver(args.sessionId);
    } else if (toolName === 'step_into') {
      stepResult = await ctx.stepInto(args.sessionId);
    } else {
      stepResult = await ctx.stepOut(args.sessionId);
    }

    const stepType = toolName.replace('step_', '').replace('_', ' ');

    // The controller's failure verdict is data, not an exception: surface the
    // reason and the state it observed together (issue #638 — the facade used
    // to throw here and only the message string survived).
    if (!stepResult.success) {
      return failureResult(stepResult.error ?? `Failed to step ${stepType}`, { state: stepResult.state });
    }

    // Build response with location and line context if available
    const resultData = stepResult.data;
    const response: Record<string, unknown> = {
      success: true,
      message: `Stepped ${stepType}`,
      state: stepResult.state
    };

    // A pending step means the program is still executing (e.g. stepping
    // over a long-running call); report that truthfully instead of "Stepped".
    if (resultData?.pending) {
      response.pending = true;
      if (resultData.message) {
        response.message = resultData.message;
      }
    } else if (SESSION_OVER.has(stepResult.state) && resultData?.message) {
      // A step the debuggee did not survive completes with "Step completed as
      // session terminated./exited." and no `pending` marker. Gated on the
      // terminal states rather than a blanket `??` so the ordinary stop keeps
      // its "Stepped over" wording — but leaving it hard-coded here made
      // `state` the only clue that the program is gone (issue #574). ERROR
      // belongs here as much as STOPPED: the core maps an unexpected adapter
      // exit (non-zero, or no code at all) to ERROR, so a step that died with
      // the proxy lands there rather than in STOPPED.
      response.message = resultData.message;
    }

    // Extract location from result data
    const location = resultData?.location;

    if (location) {
      response.location = location;

      // Try to get line context
      const context = await readLineContext(ctx, location.file, location.line, 'step result');
      if (context) {
        response.context = context;
      }
    }

    return jsonResult(response);
  } catch (error) {
    // Typed session errors and other expected Errors (like "Failed to step
    // over") both report as {success: false}; only non-Error throws escape.
    const sessionResult = sessionErrorToResult(error);
    if (sessionResult) {
      return sessionResult;
    }
    if (error instanceof Error) {
      return failureResult(error.message);
    }
    throw error;
  }
};

export const continueExecutionTool: ToolHandler = async (ctx, args) => {
  requireSessionId(args);

  try {
    const continueResult = await ctx.continueExecution(args.sessionId);
    if (!continueResult.success) {
      return failureResult(continueResult.error ?? 'Failed to continue execution', { state: continueResult.state });
    }
    // state is usually "running", but honestly reports "paused" when a
    // breakpoint fired before the continue acknowledgement resolved.
    return jsonResult({ success: true, message: 'Continued execution', state: continueResult.state });
  } catch (error) {
    // Same contract as the step tools: typed session errors and other
    // expected Errors report as {success: false}; non-Errors escape.
    const sessionResult = sessionErrorToResult(error);
    if (sessionResult) {
      return sessionResult;
    }
    if (error instanceof Error) {
      return failureResult(error.message);
    }
    throw error;
  }
};

export async function handlePause(ctx: ToolContext, args: { sessionId: string; threadId?: number }): Promise<ToolResult> {
  try {
    ctx.validateSession(args.sessionId);
    const result = await ctx.sessionManager.pause(args.sessionId, args.threadId);
    return jsonResult(result);
  } catch (error) {
    ctx.logger.error('Failed to pause execution', { error });
    return sessionErrorToResult(error) ??
      rethrowAsMcpError(error, 'Failed to pause execution');
  }
}

export const pauseExecutionTool: ToolHandler = async (ctx, args) => {
  return await handlePause(ctx, args as { sessionId: string; threadId?: number });
};

export async function handleListThreads(ctx: ToolContext, args: { sessionId: string }): Promise<ToolResult> {
  try {
    ctx.validateSession(args.sessionId);
    const threads = await ctx.sessionManager.listThreads(args.sessionId);
    return jsonResult({ success: true, threads });
  } catch (error) {
    ctx.logger.error('Failed to list threads', { error });
    return sessionErrorToResult(error) ??
      rethrowAsMcpError(error, 'Failed to list threads');
  }
}

export const listThreadsTool: ToolHandler = async (ctx, args) => {
  requireSessionId(args);
  return await handleListThreads(ctx, args);
};
