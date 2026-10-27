/**
 * MCP tool registration: the tools/list handler and the tools/call dispatch
 * wrapper (tool:call / tool:response / tool:error logging) around
 * TOOL_HANDLERS. The unknown-tool check sits inside the try so an unknown
 * name produces the same tool:error log line as a failing handler.
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ErrorCode as McpErrorCode,
  McpError,
  ServerResult
} from '@modelcontextprotocol/sdk/types.js';
import { toWireError } from '../errors/debug-errors.js';
import { coerceToolArguments, ToolArguments } from './tool-arguments.js';
import { extractPayloadSuccess, failureResult, sanitizeRequest, type ToolResult } from './tool-result.js';
import { buildToolDefinitions, isToolName, TOOL_ALIASES, type ToolDefinition } from './tool-schemas.js';
import { assertRequiredToolArguments } from './tool-validation.js';
import type { ToolContext } from './tool-context.js';
import { TOOL_HANDLERS } from './handlers/index.js';

/**
 * A session id that another server in this process owns answers with that
 * fact instead of the tool's own "not found" (Streamable HTTP: one
 * DebugMcpServer per MCP client session, issue #939). Decided here, in front
 * of every handler, so all tools say it the same way — the per-tool wordings
 * (`Session not found`, `Failed to close debug session`, hot_reload'
 * protocol error) stay for an id nobody holds. Ownership is terminal, which is
 * why it outranks a handler's own argument gates: no argument fix can make the
 * call succeed on this server. Only tools whose schema takes a `sessionId` are
 * gated — the SDK does not validate arguments against the schema, and a stale
 * id an agent carries across MCP sessions must never refuse
 * `create_debug_session`. Only the HTTP layer provides the lookup; without it
 * nothing changes.
 */
function foreignSessionResult(ctx: ToolContext, definition: ToolDefinition, sessionId: unknown): ToolResult | undefined {
  if (typeof sessionId !== 'string' || !ctx.describeForeignSession) {
    return undefined;
  }
  if (!Object.prototype.hasOwnProperty.call(definition.inputSchema.properties ?? {}, 'sessionId')) {
    return undefined;
  }
  if (ctx.sessionManager.getSession(sessionId)) {
    return undefined;
  }
  const explanation = ctx.describeForeignSession(sessionId);
  return explanation ? failureResult(explanation) : undefined;
}

export function registerToolHandlers(server: Server, ctx: ToolContext): void {
  // Required fields do not depend on language discovery. Build this immutable
  // dispatch index once; tools/list can still rebuild descriptions with the
  // dynamically discovered language enum for each request.
  const dispatchDefinitions = new Map(
    buildToolDefinitions({ supportedLanguages: [], environment: ctx.environment })
      .map((definition) => [definition.name, definition] as const)
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    ctx.logger.debug('Handling ListToolsRequest');
    
    // Get supported languages dynamically - deferred until request time
    const supportedLanguages = await ctx.getSupportedLanguagesAsync();
    
    return { tools: buildToolDefinitions({ supportedLanguages, environment: ctx.environment }) };
  });

  server.setRequestHandler(
    CallToolRequestSchema,
    async (request, extra): Promise<ServerResult> => {
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
          throw new McpError(McpErrorCode.MethodNotFound, `Unknown tool: ${requestedName}`);
        }
        const definition = dispatchDefinitions.get(toolName);
        if (!definition) {
          throw new McpError(McpErrorCode.MethodNotFound, `Unknown tool: ${toolName}`);
        }
        assertRequiredToolArguments(definition, args as unknown as Record<string, unknown>);
        const result =
          foreignSessionResult(ctx, definition, args.sessionId) ??
          await TOOL_HANDLERS[toolName](ctx, args, requestedName, { signal: extra?.signal });
        
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
          error instanceof McpError
            ? error
            : new McpError(McpErrorCode.InternalError, `Failed to execute tool ${toolName}: ${errorMessage}`)
        );
      }
    }
  );
}
