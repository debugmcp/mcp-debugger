/**
 * Execution control tools: step_over / step_into / step_out (one handler
 * keyed by toolName), continue_execution, pause_execution, list_threads.
 */
import { ErrorCode as McpErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import type { ToolContext, ToolHandler } from '../tool-context.js';
import {
  failureResult,
  rethrowAsMcpError,
  sessionErrorToResult,
  type ToolResult
} from '../tool-result.js';

export const stepTool: ToolHandler = async (ctx, args, toolName) => {
  if (!args.sessionId) {
    throw new McpError(McpErrorCode.InvalidParams, 'Missing required sessionId');
  }

  try {
    let stepResult: { success: boolean; state: string; error?: string; data?: unknown; };
    if (toolName === 'step_over') {
      stepResult = await ctx.stepOver(args.sessionId);
    } else if (toolName === 'step_into') {
      stepResult = await ctx.stepInto(args.sessionId);
    } else {
      stepResult = await ctx.stepOut(args.sessionId);
    }

    // Build response with location and line context if available
    const stepType = toolName.replace('step_', '').replace('_', ' ');
    const resultData = stepResult.data as { message?: string; location?: { file: string; line: number; column?: number }; pending?: boolean } | undefined;
    const response: Record<string, unknown> = {
      success: stepResult.success,
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
    }

    // Extract location from result data
    const location = resultData?.location;

    if (location) {
      response.location = location;

      // Try to get line context
      try {
        const lineContext = await ctx.lineReader.getLineContext(
          location.file,
          location.line,
          { contextLines: 2 }
        );

        if (lineContext) {
          response.context = {
            lineContent: lineContext.lineContent,
            surrounding: lineContext.surrounding
          };
        }
      } catch (contextError) {
        // Log but don't fail if we can't get context
        ctx.logger.debug('Could not get line context for step result', {
          file: location.file,
          line: location.line,
          error: contextError
        });
      }
    }

    return { content: [{ type: 'text', text: JSON.stringify(response) }] };
  } catch (error) {
    // Typed session errors and other expected Errors (like "Failed to step
    // over") both report as {success: false}; only non-Error throws escape.
    const sessionResult = sessionErrorToResult(error, 'typed');
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
  if (!args.sessionId) {
    throw new McpError(McpErrorCode.InvalidParams, 'Missing required sessionId');
  }

  try {
    const continueResult = await ctx.continueExecution(args.sessionId);
    return { content: [{ type: 'text', text: JSON.stringify({ success: continueResult, message: continueResult ? 'Continued execution' : 'Failed to continue execution' }) }] };
  } catch (error) {
    // Same contract as the step tools: typed session errors and other
    // expected Errors report as {success: false}; non-Errors escape.
    const sessionResult = sessionErrorToResult(error, 'typed');
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
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  } catch (error) {
    ctx.logger.error('Failed to pause execution', { error });
    return sessionErrorToResult(error, 'typed') ??
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
    return { content: [{ type: 'text', text: JSON.stringify({ success: true, threads }) }] };
  } catch (error) {
    ctx.logger.error('Failed to list threads', { error });
    return sessionErrorToResult(error, 'typed') ??
      rethrowAsMcpError(error, 'Failed to list threads');
  }
}

export const listThreadsTool: ToolHandler = async (ctx, args) => {
  if (!args.sessionId) {
    throw new McpError(McpErrorCode.InvalidParams, 'Missing required sessionId');
  }
  return await handleListThreads(ctx, args as { sessionId: string });
};
