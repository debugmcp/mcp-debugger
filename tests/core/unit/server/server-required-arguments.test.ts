/**
 * Schema-driven required-argument enforcement at the MCP dispatch boundary.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ErrorCode as McpErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { DebugMcpServer } from '../../../../src/server.js';
import { SessionManager } from '../../../../src/session/session-manager.js';
import { createProductionDependencies } from '../../../../src/container/dependencies.js';
import { buildToolDefinitions, TOOL_NAMES } from '../../../../src/server/tool-schemas.js';
import {
  createMockDependencies,
  createMockServer,
  createMockSessionManager,
  createMockStdioTransport,
  getToolHandlers
} from './server-test-helpers.js';

vi.mock('@modelcontextprotocol/sdk/server/index.js');
vi.mock('@modelcontextprotocol/sdk/server/stdio.js');
vi.mock('../../../../src/session/session-manager.js');
vi.mock('../../../../src/container/dependencies.js');

const PRESENT_VALUES: Record<string, unknown> = {
  sessionId: 'session-1',
  language: 'python',
  file: '/workspace/main.py',
  line: 1,
  scriptPath: '/workspace/main.py',
  scope: 1,
  frameId: 1,
  expression: 'value',
  classesDir: '/workspace/classes',
  names: ['value']
};

describe('schema-driven required arguments', () => {
  let callToolHandler: (request: unknown) => Promise<unknown>;
  let mockDependencies: ReturnType<typeof createMockDependencies>;

  beforeEach(() => {
    mockDependencies = createMockDependencies();
    mockDependencies.environment.get.mockReturnValue(undefined);
    vi.mocked(createProductionDependencies).mockReturnValue(mockDependencies as never);

    const mockServer = createMockServer();
    vi.mocked(Server).mockImplementation(function() { return mockServer as never; });
    vi.mocked(StdioServerTransport).mockImplementation(function() {
      return createMockStdioTransport() as never;
    });
    const manager = createMockSessionManager(mockDependencies.adapterRegistry);
    vi.mocked(SessionManager).mockImplementation(function() { return manager as never; });

    new DebugMcpServer();
    callToolHandler = getToolHandlers(mockServer).callToolHandler;
  });

  it('checks every advertised required field before dispatch, in schema order', async () => {
    const definitions = buildToolDefinitions({
      supportedLanguages: ['python'],
      environment: mockDependencies.environment
    });
    expect(definitions.map(({ name }) => name)).toEqual([...TOOL_NAMES]);
    expect(definitions).toHaveLength(28);

    for (const definition of definitions) {
      const required = definition.inputSchema.required ?? [];
      for (const missing of required) {
        const args = Object.fromEntries(
          required
            .filter((parameterName) => parameterName !== missing)
            .map((parameterName) => [parameterName, PRESENT_VALUES[parameterName]])
        );

        let caught: unknown;
        try {
          await callToolHandler({
            method: 'tools/call',
            params: { name: definition.name, arguments: args }
          });
        } catch (error) {
          caught = error;
        }

        expect(caught, `${definition.name}.${missing}`).toBeInstanceOf(McpError);
        expect((caught as McpError).code, `${definition.name}.${missing}`).toBe(McpErrorCode.InvalidParams);
        expect((caught as Error).message, `${definition.name}.${missing}`)
          .toContain(`Missing required parameter: ${missing}`);
      }
    }
  });
});
