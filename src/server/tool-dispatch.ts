/**
 * MCP tool registration: the tools/list handler and the tools/call dispatch
 * wrapper (tool:call / tool:response / tool:error logging) around
 * TOOL_HANDLERS. The unknown-tool check sits inside the try so an unknown
 * name produces the same tool:error log line as a failing handler.
 */
import { Server, ProtocolError, ProtocolErrorCode, type CallToolResult } from '@modelcontextprotocol/server';
import { SessionNotFoundError, toWireError } from '../errors/debug-errors.js';
import { ownerKeyOf } from './owner-key.js';
import { coerceToolArguments, ToolArguments } from './tool-arguments.js';
import { extractPayloadSuccess, failureResult, sanitizeRequest, type ToolResult } from './tool-result.js';
import { buildToolDefinitions, isToolName, TOOL_ALIASES, type ToolDefinition } from './tool-schemas.js';
import { assertRequiredToolArguments } from './tool-validation.js';
import type { ToolContext } from './tool-context.js';
import { TOOL_HANDLERS } from './handlers/index.js';

/**
 * The owner-key gate (issue #1025, step 2). A `sessionId` argument naming a
 * session outside the caller's scope is answered exactly as an unknown id
 * would be — the same sentence `SessionNotFoundError` carries — so nothing
 * about its existence leaks, and it is decided here, in front of every
 * handler, so all tools say it the same way. Only tools whose schema takes a
 * `sessionId` are gated: the SDK does not validate arguments against the
 * schema, and a stale id an agent carries along must never refuse
 * `create_debug_session`. An id nobody holds passes through to the handler's
 * own not-found answer. With no authentication configured every caller is in
 * the shared anonymous scope and sees everything, as before.
 */
function outOfScopeResult(ctx: ToolContext, definition: ToolDefinition, sessionId: unknown, callerKey: string | undefined): ToolResult | undefined {
  if (typeof sessionId !== 'string') {
    return undefined;
  }
  if (!Object.prototype.hasOwnProperty.call(definition.inputSchema.properties ?? {}, 'sessionId')) {
    return undefined;
  }
  if (!ctx.sessionManager.getSession(sessionId) || ctx.sessionManager.isSessionVisibleTo(sessionId, callerKey)) {
    return undefined;
  }
  return failureResult(new SessionNotFoundError(sessionId).message);
}

/**
 * Required fields do not depend on language discovery, so the dispatch index
 * is immutable per core and built once per core, not per facade: the modern
 * HTTP leg constructs a facade per request (issue #1025, step 2). tools/list
 * still rebuilds descriptions with the dynamically discovered language enum
 * for each request.
 */
const DISPATCH_INDEX = new WeakMap<ToolContext, ReadonlyMap<string, ToolDefinition>>();

function dispatchIndexFor(ctx: ToolContext): ReadonlyMap<string, ToolDefinition> {
  let index = DISPATCH_INDEX.get(ctx);
  if (!index) {
    index = new Map(
      buildToolDefinitions({ supportedLanguages: [], environment: ctx.environment })
        .map((definition) => [definition.name, definition] as const)
    );
    DISPATCH_INDEX.set(ctx, index);
  }
  return index;
}

export function registerToolHandlers(server: Server, ctx: ToolContext): void {
  const dispatchDefinitions = dispatchIndexFor(ctx);

  server.setRequestHandler('tools/list', async () => {
    ctx.logger.debug('Handling ListToolsRequest');
    
    // Get supported languages dynamically - deferred until request time
    const supportedLanguages = await ctx.getSupportedLanguagesAsync();
    
    return { tools: buildToolDefinitions({ supportedLanguages, environment: ctx.environment }) };
  });

  // `callCtx` is the SDK's per-request context (`ctx` is the ToolContext); the
  // unit tests invoke the handler without one.
  server.setRequestHandler(
    'tools/call',
    async (request, callCtx): Promise<CallToolResult> => {
      // A former name resolves to its replacement; the handler sees the name the caller
      // used, so the answer can say it is deprecated (issue #876).
      const requestedName = request.params.name;
      const toolName = TOOL_ALIASES[requestedName] ?? requestedName;
      const args = coerceToolArguments((request.params.arguments ?? {}) as Record<string, unknown>) as ToolArguments;

      // Log tool call with structured logging
      ctx.logger.info('tool:call', {
        tool: toolName,
        sessionId: args.sessionId,
        sessionName: args.sessionId ? ctx.getSessionName(args.sessionId) : undefined,
        request: sanitizeRequest(args as Record<string, unknown>),
        timestamp: Date.now()
      });

      try {
        if (!isToolName(toolName)) {
          throw new ProtocolError(ProtocolErrorCode.MethodNotFound, `Unknown tool: ${requestedName}`);
        }
        const definition = dispatchDefinitions.get(toolName);
        if (!definition) {
          throw new ProtocolError(ProtocolErrorCode.MethodNotFound, `Unknown tool: ${toolName}`);
        }
        assertRequiredToolArguments(definition, args as unknown as Record<string, unknown>);
        const callerKey = ownerKeyOf(callCtx);
        const refused = outOfScopeResult(ctx, definition, args.sessionId, callerKey);
        if (!refused && typeof args.sessionId === 'string') {
          // A tool call naming a session is activity for the idle policy (issue #1025, step 2).
          ctx.sessionManager.touchActivity(args.sessionId);
        }
        const result =
          refused ??
          await TOOL_HANDLERS[toolName](ctx, args, requestedName, { signal: callCtx?.mcpReq.signal, callerKey });
        
        // Log tool response; success mirrors the payload's own success flag (issue #397)
        ctx.logger.info('tool:response', {
          tool: toolName,
          sessionId: args.sessionId,
          sessionName: args.sessionId ? ctx.getSessionName(args.sessionId) : undefined,
          success: extractPayloadSuccess(result),
          timestamp: Date.now()
        });
        
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // Log tool error
        ctx.logger.error('tool:error', {
          tool: toolName,
          sessionId: args.sessionId,
          sessionName: args.sessionId ? ctx.getSessionName(args.sessionId) : undefined,
          error: errorMessage,
          timestamp: Date.now()
        });
        
        // The JSON-RPC boundary: the SDK copies .message onto the wire and the
        // client prefixes it again, so send the bare detail (issue #659).
        throw toWireError(
          error instanceof ProtocolError
            ? error
            : new ProtocolError(ProtocolErrorCode.InternalError, `Failed to execute tool ${toolName}: ${errorMessage}`)
        );
      }
    }
  );
}
