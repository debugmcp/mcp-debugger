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
import { coerceToolArguments, ToolArguments } from './tool-arguments.js';
import { extractPayloadSuccess, sanitizeRequest } from './tool-result.js';
import { buildToolDefinitions } from './tool-schemas.js';
import type { ToolContext } from './tool-context.js';
import { TOOL_HANDLERS } from './handlers/index.js';

export function registerToolHandlers(server: Server, ctx: ToolContext): void {
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    ctx.logger.debug('Handling ListToolsRequest');
    
    // Get supported languages dynamically - deferred until request time
    const supportedLanguages = await ctx.getSupportedLanguagesAsync();
    
    return { tools: buildToolDefinitions({ supportedLanguages, environment: ctx.environment }) };
  });

  server.setRequestHandler(
    CallToolRequestSchema,
    async (request): Promise<ServerResult> => {
      const toolName = request.params.name;
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
        if (!Object.hasOwn(TOOL_HANDLERS, toolName)) {
          throw new McpError(McpErrorCode.MethodNotFound, `Unknown tool: ${toolName}`);
        }
        const result = await TOOL_HANDLERS[toolName](ctx, args, toolName);
        
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
        
        if (error instanceof McpError) throw error;
        throw new McpError(McpErrorCode.InternalError, `Failed to execute tool ${toolName}: ${errorMessage}`);
      }
    }
  );
}
