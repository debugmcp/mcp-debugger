/**
 * Breakpoint tools: set_breakpoint (function and line branches),
 * list_breakpoints, remove_breakpoint, clear_breakpoints.
 */
import { ErrorCode as McpErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { Breakpoint, FunctionBreakpoint } from '@debugmcp/shared';
import {
  BP_ADDRESSING_ENV_KEY,
  getBpAddressingMode,
  supportsExpectedContent,
  supportsStatementAnchors
} from '../../utils/bp-addressing.js';
import type { FunctionBreakpointRemoval } from '../../session/session-manager-operations.js';
import type { ToolContext, ToolHandler } from '../tool-context.js';
import { requireSessionId, type WithSessionId } from '../tool-validation.js';
import { readLineContext } from './shared.js';
import { failureResult, jsonResult, sessionErrorResultOrThrow, type ToolResult } from '../tool-result.js';

export const setBreakpointTool: ToolHandler = async (ctx, args) => {
  const isFunctionBp = args.function !== undefined;
  if (!isFunctionBp && (!args.file || (args.line === undefined && args.statement === undefined))) {
    throw new McpError(McpErrorCode.InvalidParams, 'Missing required parameters');
  }

  // Addressing-mode gating (issue #271): reject params outside the
  // configured mode even though the schema omits them — a client
  // replaying a cached schema must not slip features into a
  // restricted server. Checked on the raw args so unknown params
  // are caught too.
  const bpMode = getBpAddressingMode(ctx.environment);
  if (args.expectedContent !== undefined && !supportsExpectedContent(bpMode)) {
    throw new McpError(
      McpErrorCode.InvalidParams,
      `expectedContent is disabled (${BP_ADDRESSING_ENV_KEY}=${bpMode}). Use plain line addressing.`
    );
  }
  if ((args.statement !== undefined || args.nearLine !== undefined) && !supportsStatementAnchors(bpMode)) {
    throw new McpError(
      McpErrorCode.InvalidParams,
      `statement addressing is disabled (${BP_ADDRESSING_ENV_KEY}=${bpMode}). Use line addressing.`
    );
  }
  if (isFunctionBp && !supportsStatementAnchors(bpMode)) {
    throw new McpError(
      McpErrorCode.InvalidParams,
      `function breakpoints are disabled (${BP_ADDRESSING_ENV_KEY}=${bpMode}). Use line addressing.`
    );
  }

  if (isFunctionBp) {
    return setFunctionBreakpointBranch(ctx, args as WithSessionId);
  }

  return setLineBreakpointBranch(ctx, args as WithSessionId);
};

/**
 * Function-breakpoint branch of set_breakpoint (the `function` parameter).
 */
// Module-private: callers must already have run setBreakpointTool's entry guard,
// which is what makes the `args as WithSessionId` narrowing sound.
async function setFunctionBreakpointBranch(ctx: ToolContext, args: WithSessionId): Promise<ToolResult> {
  // Function breakpoints are session-global symbols — no file,
  // no line, no content anchor, no logpoint, no suspend policy
  // (DAP FunctionBreakpoint supports name + condition only).
  if (args.file !== undefined) {
    throw new McpError(McpErrorCode.InvalidParams,
      'Function breakpoints are not file-scoped; omit file. The adapter resolves the symbol name across the whole program.');
  }
  if (args.line !== undefined || args.statement !== undefined ||
      args.expectedContent !== undefined || args.nearLine !== undefined) {
    throw new McpError(McpErrorCode.InvalidParams,
      'Provide function alone (optionally with condition) — it cannot be combined with line, statement, expectedContent, or nearLine.');
  }
  if (args.logMessage !== undefined) {
    throw new McpError(McpErrorCode.InvalidParams,
      'logMessage is not supported on function breakpoints (DAP has no logpoint form for them); use a line or statement breakpoint.');
  }
  if (args.suspendPolicy !== undefined) {
    throw new McpError(McpErrorCode.InvalidParams,
      'suspendPolicy is not supported on function breakpoints.');
  }

  try {
    const fnGate = ctx.validateFunctionBreakpointSupport(args.sessionId);
    // The session layer owns the name (issue #559): the same resolution
    // remove_breakpoint uses, so a policy-certain rewrite (issue #467 — a
    // name the adapter can never bind as given, go bare 'main') is stored
    // and removable under one name, and the per-adapter advisory (issues
    // #303/#308 — rust bare 'main' -> CRT entry) rides along. Both are
    // reported in the warning; neither blocks the request.
    const { requestedName, effectiveName, normalized, hint: nameHint } =
      ctx.sessionManager.resolveFunctionBreakpointName(args.sessionId, args.function!);
    const { breakpoint, warning: syncWarning } = await ctx.setFunctionBreakpoint(
      args.sessionId, effectiveName, args.condition
    );

    ctx.logger.info('debug:breakpoint', {
      event: 'set',
      sessionId: args.sessionId,
      sessionName: ctx.getSessionName(args.sessionId),
      breakpointId: breakpoint.id,
      functionName: breakpoint.functionName,
      verified: breakpoint.verified,
      timestamp: Date.now()
    });

    const warnings = [breakpoint.message, fnGate.warning, normalized?.note, nameHint, syncWarning].filter(Boolean);
    return jsonResult({
      success: true,
      breakpointId: breakpoint.id,
      // Disclosed only when a policy rewrite changed the name (issue #550);
      // an undefined value drops the key.
      requestedName: normalized ? requestedName : undefined,
      functionName: breakpoint.functionName,
      condition: breakpoint.condition,
      verified: breakpoint.verified,
      boundFile: breakpoint.boundFile,
      boundLine: breakpoint.boundLine,
      message: breakpoint.message || `Function breakpoint set on ${breakpoint.functionName}`,
      warning: warnings.length > 0 ? warnings.join('; ') : undefined
    });
  } catch (error) {
    return sessionErrorResultOrThrow(error, 'session-state');
  }
}

/**
 * Line / statement branch of set_breakpoint.
 */
// Module-private: see setFunctionBreakpointBranch — the entry guard has run.
async function setLineBreakpointBranch(ctx: ToolContext, args: WithSessionId): Promise<ToolResult> {
  try {
    // Logpoint gating (issue #235): hard error for known-unsupported
    // adapters; a warning when support is unknown pre-launch.
    const logPointGate = args.logMessage !== undefined
      ? ctx.validateLogPointSupport(args.sessionId)
      : {};

    const { breakpoint, warning: syncWarning } = await ctx.setBreakpoint({
      sessionId: args.sessionId,
      // Non-function path: the entry guard above ensures file is set
      file: args.file!,
      line: args.line,
      expectedContent: args.expectedContent,
      statement: args.statement,
      nearLine: args.nearLine,
      condition: args.condition,
      suspendPolicy: args.suspendPolicy,
      logMessage: args.logMessage
    });

    // Log breakpoint event
    ctx.logger.info('debug:breakpoint', {
      event: 'set',
      sessionId: args.sessionId,
      sessionName: ctx.getSessionName(args.sessionId),
      breakpointId: breakpoint.id,
      file: breakpoint.file,
      line: breakpoint.line,
      verified: breakpoint.verified,
      timestamp: Date.now()
    });

    // Try to get line context for the breakpoint
    const context = await readLineContext(ctx, breakpoint.file, breakpoint.line, 'breakpoint');

    // Loud snapping (issue #271): if the adapter bound the
    // breakpoint to a different line than requested, say so
    // prominently instead of silently reporting the moved line.
    const snapped =
      breakpoint.requestedLine !== undefined &&
      breakpoint.line !== breakpoint.requestedLine;
    const snapWarning = snapped
      ? `Breakpoint moved by the debugger: requested line ${breakpoint.requestedLine}, bound to line ${breakpoint.line}${
          context ? `: \`${context.lineContent.trim()}\`` : ''
        }`
      : undefined;

    const warnings = [breakpoint.message, logPointGate.warning, syncWarning, snapWarning].filter(Boolean);
    const result: ToolResult = jsonResult({
      success: true,
      breakpointId: breakpoint.id,
      file: breakpoint.file,
      line: breakpoint.line,
      requestedLine: breakpoint.requestedLine,
      anchor: breakpoint.anchor,
      content: context?.lineContent,
      verified: breakpoint.verified,
      logMessage: breakpoint.logMessage,
      message: snapWarning || breakpoint.message || `${breakpoint.logMessage !== undefined ? 'Logpoint' : 'Breakpoint'} set at ${breakpoint.file}:${breakpoint.line}`,
      // Warn on adapter validation messages, sync failures, snaps,
      // and unknown logpoint support
      warning: warnings.length > 0 ? warnings.join('; ') : undefined,
      // Include context if available
      context: context || undefined
    });
    const contentEntry = Array.isArray(result.content) ? result.content[0] : undefined;
    const textContent = contentEntry && typeof (contentEntry as { text?: unknown }).text === 'string'
      ? (contentEntry as { text: string }).text
      : undefined;
    let parsedResponse: Record<string, unknown> | null = null;
    if (typeof textContent === 'string') {
      try {
        parsedResponse = JSON.parse(textContent) as Record<string, unknown>;
      } catch {
        parsedResponse = null;
      }
    }
    ctx.logger.info('tool:set_breakpoint:result', {
      sessionId: args.sessionId,
      response: parsedResponse
    });
    return result;
  } catch (error) {
    // Message-sniffed session state -> {success: false}, everything else
    // re-thrown; the sniff is wider than its name suggests (see the note in
    // debuggee-tools.ts, start_debugging).
    return sessionErrorResultOrThrow(error, 'session-state');
  }
}

export const listBreakpointsTool: ToolHandler = async (ctx, args) => {
  requireSessionId(args);
  try {
    const breakpoints = ctx.listBreakpoints(args.sessionId, args.file);
    // Function breakpoints are session-global, so a file filter
    // deliberately excludes them (issue #271 phase 3).
    const functionBreakpoints = args.file === undefined
      ? ctx.sessionManager.listFunctionBreakpoints(args.sessionId)
      : [];
    return jsonResult({
      success: true,
      breakpoints,
      count: breakpoints.length,
      ...(args.file === undefined
        ? { functionBreakpoints, functionCount: functionBreakpoints.length }
        : {})
    });
  } catch (error) {
    return sessionErrorResultOrThrow(error, 'session-state');
  }
};

export const removeBreakpointTool: ToolHandler = async (ctx, args) => {
  requireSessionId(args);
  if (!args.breakpointId && args.function === undefined && (!args.file || args.line === undefined)) {
    throw new McpError(
      McpErrorCode.InvalidParams,
      'Provide breakpointId, function, or file and line together'
    );
  }
  try {
    let removed: Array<Breakpoint | FunctionBreakpoint>;
    let warning: string | undefined;
    // Function-addressed removal discloses names the way
    // set_breakpoint does: `functionName` is always the effective
    // name, `requestedName` appears only when a policy rewrite
    // changed it (issue #550).
    let functionDisclosure: { functionName: string; requestedName?: string } | undefined;
    if (!args.breakpointId && args.function !== undefined) {
      // One session-layer call (issue #559): it resolves the name the way
      // set_breakpoint does — so the name the caller supplied removes the
      // normalized record that was stored (issue #550), and the literal name
      // is matched too — deletes every match, and re-sends the surviving set
      // ONCE (setFunctionBreakpoints is replace-all for the session).
      const res = await ctx.sessionManager.removeFunctionBreakpointsByName(
        args.sessionId,
        args.function
      );
      if (res.removed.length === 0) {
        return functionRemovalNotFoundResult(res);
      }
      removed = res.removed;
      warning = res.warning;
      functionDisclosure = {
        functionName: res.functionName,
        requestedName: res.normalized ? res.requestedName : undefined
      };
    } else if (args.breakpointId) {
      const res = await ctx.removeBreakpoint(args.sessionId, args.breakpointId);
      removed = res.removed ? [res.removed] : [];
      warning = res.warning;
      if (removed.length === 0) {
        return failureResult(`No breakpoint found with id ${args.breakpointId}`);
      }
    } else {
      const res = await ctx.removeBreakpointsByLocation(args.sessionId, args.file!, args.line!);
      removed = res.removed;
      warning = res.warning;
      if (removed.length === 0) {
        return failureResult(`No breakpoint found at ${args.file}:${args.line}`);
      }
    }
    return jsonResult({
      success: true,
      removed,
      message: `Removed ${removed.length} breakpoint(s)`,
      ...(functionDisclosure ?? {}),
      warning
    });
  } catch (error) {
    return sessionErrorResultOrThrow(error, 'session-state');
  }
};

/**
 * The not-found payload for a function-addressed removal. `functionName` is
 * always the effective name and `requestedName` appears only when a policy
 * rewrite changed it (issue #550), the same disclosure the success payload
 * makes. `warning` carries the per-adapter name advisory set_breakpoint gives
 * (issues #303/#308), so a bare Go name that never matched learns the
 * package-qualified form it should use.
 */
function functionRemovalNotFoundResult(res: FunctionBreakpointRemoval): ToolResult {
  return failureResult(
    res.normalized
      ? `No function breakpoint found for ${res.requestedName} (normalized to ${res.functionName})`
      : `No function breakpoint found for ${res.functionName}`,
    {
      functionName: res.functionName,
      requestedName: res.normalized ? res.requestedName : undefined,
      warning: res.warning
    }
  );
}

export const clearBreakpointsTool: ToolHandler = async (ctx, args) => {
  requireSessionId(args);
  try {
    const res = await ctx.clearBreakpoints(args.sessionId, args.file);
    return jsonResult({
      success: true,
      cleared: res.cleared,
      files: res.files,
      message: `Cleared ${res.cleared} breakpoint(s)`,
      warning: res.warning
    });
  } catch (error) {
    return sessionErrorResultOrThrow(error, 'session-state');
  }
};
