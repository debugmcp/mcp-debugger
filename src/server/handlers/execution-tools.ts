/**
 * Execution control tools: step_over / step_into / step_out (one handler
 * keyed by toolName), continue_execution, wait_for_stop, pause_execution,
 * list_threads.
 */
import { isTerminalSessionState } from '@debugmcp/shared';
import type { ToolContext, ToolHandler } from '../tool-context.js';
import type { DebugResult, StepResultData } from '../../session/session-manager-core.js';
import { requireSessionId } from '../tool-validation.js';
import { hoistStopLanding } from './shared.js';
import {
  failureResult,
  jsonResult,
  rethrowAsMcpError,
  sessionErrorToResult,
  type ToolResult
} from '../tool-result.js';

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
    } else if (isTerminalSessionState(stepResult.state) && resultData?.message) {
      // A step the debuggee did not survive completes with "Step completed as
      // session terminated./exited." and no `pending` marker. Gated on the
      // terminal states rather than a blanket `??` so the ordinary stop keeps
      // its "Stepped over" wording — but leaving it hard-coded here made
      // `state` the only clue that the program is gone (issue #574). ERROR
      // belongs here as much as STOPPED: the core maps an unexpected adapter
      // exit (non-zero, or no code at all) to ERROR, so a step that died with
      // the proxy lands there rather than in STOPPED.
      response.message = resultData.message;
    } else if (resultData?.message) {
      // The controller owns the step wording (issue #678 review): 'Stepped
      // over' for an ordinary stop, or its disclosure when the stop that
      // ended the step was not the step. The default above covers a result
      // that carries no message.
      response.message = resultData.message;
    }
    if (resultData?.stopReason) {
      // The stop that ended the step was not the step (issue #678): name it.
      response.stopReason = resultData.stopReason;
      if (resultData.rawStopReason) {
        response.rawStopReason = resultData.rawStopReason;
      }
    }

    // Where the step landed (issues #904, #938): the shape every stop answer has.
    await hoistStopLanding(ctx, response, resultData, args.sessionId, 'step result');

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

/**
 * wait_for_stop (issue #849): the session layer's answer, flattened the way
 * the step tools flatten theirs — `pending` at the top level, the stop record
 * and location beside the state, and the source line when it can be read.
 */
export const waitForStopTool: ToolHandler = async (ctx, args, _toolName, extra) => {
  requireSessionId(args);

  try {
    const waitResult = await ctx.waitForStop(args.sessionId, args.timeout, extra?.signal);
    if (!waitResult.success) {
      return failureResult(waitResult.error ?? 'Failed to wait for a stop', { state: waitResult.state });
    }

    const data = waitResult.data;
    const response: Record<string, unknown> = {
      success: true,
      state: waitResult.state
    };
    if (data?.pending) {
      response.pending = true;
    }
    if (data?.message) {
      response.message = data.message;
    }
    if (data?.lastStop) {
      response.lastStop = data.lastStop;
    }
    if (typeof data?.exitCode === 'number') {
      response.exitCode = data.exitCode;
    }
    // The breakpoints a finished program ran past (issues #701, #1033), as the
    // launch answer lists them; an empty list says nothing a flat answer needs.
    if (Array.isArray(data?.unhitBreakpoints) && data.unhitBreakpoints.length > 0) {
      response.unhitBreakpoints = data.unhitBreakpoints;
    }
    // The landing (issues #904, #938), as for pause_execution and the step tools.
    await hoistStopLanding(ctx, response, data, args.sessionId, 'wait_for_stop result');
    // What the adapter read into the program's end (issue #877: e.g. availableDevices)
    // lands beside the message under the policy's own keys, after everything the answer
    // says for itself: a key the answer already has — the landing's included — wins, the
    // same rule as the launch summary and the session listing.
    for (const [key, value] of Object.entries(data?.programEnd?.data ?? {})) {
      if (!(key in response)) {
        response[key] = value;
      }
    }
    return jsonResult(response);
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
    if (!result.success) {
      return jsonResult(result);
    }
    // The shape the step tools and wait_for_stop answer with (issue #906):
    // what a caller branches on — pending, the stop reason, where it landed
    // and the note about it — at the top level, with the controller's own
    // data kept whole beneath for the callers that read it there.
    const data = result.data;
    const response: Record<string, unknown> = { ...result };
    if (data?.message) {
      response.message = data.message;
    }
    if (data?.pending) {
      response.pending = true;
    }
    if (data?.stopReason) {
      response.stopReason = data.stopReason;
      if (data.rawStopReason) {
        response.rawStopReason = data.rawStopReason;
      }
    }
    await hoistStopLanding(ctx, response, data, args.sessionId, 'pause result');
    return jsonResult(response);
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
