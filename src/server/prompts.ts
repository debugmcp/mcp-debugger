/**
 * MCP prompt handlers. The single `debugging-workflow` prompt serves the
 * condensed debugging skill in-band so any connected agent can pull workflow
 * guidance without a separate skill install (the full skill with per-language
 * references ships in skills/debugging/).
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ErrorCode as McpErrorCode,
  McpError
} from '@modelcontextprotocol/sdk/types.js';
import { IEnvironment } from '@debugmcp/shared';
import { buildDebuggingWorkflowPrompt } from '../skill-content.js';
import { getBpAddressingMode } from '../utils/bp-addressing.js';

export function registerPromptHandlers(server: Server, environment: IEnvironment): void {
  const promptDescriptor = {
    name: 'debugging-workflow',
    description:
      'How to debug effectively with mcp-debugger: session golden path, root-cause discipline, attach/remote recipes, and per-language quirks.'
  };

  server.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts: [promptDescriptor]
  }));

  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    if (request.params.name !== promptDescriptor.name) {
      throw new McpError(McpErrorCode.InvalidParams, `Unknown prompt: ${request.params.name}`);
    }
    return {
      description: promptDescriptor.description,
      messages: [
        {
          role: 'user' as const,
          content: { type: 'text' as const, text: buildDebuggingWorkflowPrompt(getBpAddressingMode(environment)) }
        }
      ]
    };
  });
}
