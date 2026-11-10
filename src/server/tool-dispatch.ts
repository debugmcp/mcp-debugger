/**
 * MCP tool registration: the tools/list handler and the tools/call dispatch
 * wrapper (tool:call / tool:response / tool:error logging) around
 * TOOL_HANDLERS. The unknown-tool check sits inside the try so an unknown
 * name produces the same tool:error log line as a failing handler.
 */
import { Server, ProtocolError, ProtocolErrorCode, type CallToolResult } from '@modelcontextprotocol/server';
import { toWireError } from '../errors/debug-errors.js';
import { describeIdleExpiry } from '../session/idle-policy.js';
import { runWithSessionHidden } from '../session/session-scope.js';
import { ownerKeyOf } from './owner-key.js';
import { coerceToolArguments, ToolArguments } from './tool-arguments.js';
import { extractPayloadSuccess, failureResult, sanitizeRequest, type ToolResult } from './tool-result.js';
import { buildToolDefinitions, isToolName, TOOL_ALIASES, type ToolDefinition } from './tool-schemas.js';
import { assertRequiredToolArguments } from './tool-validation.js';
import type { ToolContext } from './tool-context.js';
import { TOOL_HANDLERS } from './handlers/index.js';

/**
 * The owner-key gate (issue #1025, step 2). For a caller, a session outside
 * its scope does not exist — so the dispatch gives no answer of its own for
 * one (any fixed answer differs from some tool's real unknown-id answer, and
 * the difference says the session is there). A tool that takes a `sessionId`
 * runs — argument checks, handler and all — with that session hidden from
 * every lookup (session-scope.ts), and answers as it answers an id nobody
 * holds. A tool that takes none is not steered by a stray one: it runs as it
 * always does, and its own scoping (the listings) is what applies. Either way
 * the operator log names the session as it names an unknown one. With no
 * authentication configured every caller is in the shared anonymous scope and
 * sees everything, as before.
 */
function takesSessionId(definition: ToolDefinition | undefined): boolean {
  return definition !== undefined
    && Object.prototype.hasOwnProperty.call(definition.inputSchema.properties ?? {}, 'sessionId');
}

/**
 * A session the idle policy closed (issue #1025): the agent that comes back to
 * it is told what happened — when, under which window, what became of the
 * program — where every tool used to answer "Session not found", the words a
 * mistyped id gets. Told inside the owner scope only; for anyone else the id
 * is unknown, as the gate above requires.
 */
function idleExpiryResult(ctx: ToolContext, definition: ToolDefinition, sessionId: unknown, callerKey: string | undefined): ToolResult | undefined {
  if (typeof sessionId !== 'string' || !takesSessionId(definition) || ctx.sessionManager.getSession(sessionId)) {
    return undefined;
  }
  const expiry = ctx.sessionManager.idleExpiryOf(sessionId, callerKey);
  return expiry ? failureResult(describeIdleExpiry(expiry), { closedBy: 'idle-policy' }) : undefined;
}

/** Whether `sessionId` names a session that exists but is not the caller's to see. */
function isOutOfScope(ctx: ToolContext, sessionId: unknown, callerKey: string | undefined): boolean {
  return typeof sessionId === 'string'
    && ctx.sessionManager.getSession(sessionId) !== undefined
    && !ctx.sessionManager.isSessionVisibleTo(sessionId, callerKey);
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

export function registerToolHandlers(server: Pick<Server, 'setRequestHandler'>, ctx: ToolContext): void {
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
      const callerKey = ownerKeyOf(callCtx);
      // Whether the named session exists outside the caller's scope. The scope
      // itself is entered only for a tool that takes the id (below): hiding a
      // session from a tool that lists sessions would hide its owner key too.
      const outOfScope = isOutOfScope(ctx, args.sessionId, callerKey);
      const takesId = isToolName(toolName) && takesSessionId(dispatchDefinitions.get(toolName));
      // The log's name for the session, read the way the caller may see it.
      const sessionNameForLog = (): string | undefined => {
        const id = args.sessionId;
        if (!id) return undefined;
        return outOfScope ? runWithSessionHidden(id, () => ctx.getSessionName(id)) : ctx.getSessionName(id);
      };

      const handle = async (): Promise<CallToolResult> => {
        // Log tool call with structured logging
        ctx.logger.info('tool:call', {
          tool: toolName,
          sessionId: args.sessionId,
          sessionName: sessionNameForLog(),
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
          if (!outOfScope && typeof args.sessionId === 'string' && takesSessionId(definition)) {
            // A tool call naming a session is activity for the idle policy (issue
            // #1025, step 2) — only through a tool that takes the id, so a stray
            // argument cannot keep a tree alive, and never for a session the
            // caller may not see.
            ctx.sessionManager.touchActivity(args.sessionId);
          }
          const result =
            idleExpiryResult(ctx, definition, args.sessionId, callerKey) ??
            await TOOL_HANDLERS[toolName](ctx, args, requestedName, { signal: callCtx?.mcpReq.signal, callerKey });
        
          // Log tool response; success mirrors the payload's own success flag (issue #397)
          ctx.logger.info('tool:response', {
            tool: toolName,
            sessionId: args.sessionId,
            sessionName: sessionNameForLog(),
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
            sessionName: sessionNameForLog(),
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
      };

      return outOfScope && takesId ? runWithSessionHidden(args.sessionId as string, handle) : handle();
    }
  );
}
