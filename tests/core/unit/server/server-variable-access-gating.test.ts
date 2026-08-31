/**
 * Least-privilege variable access gating tests (issue #237, second half).
 *
 * DEBUG_MCP_VARIABLE_ACCESS=explicit requires a `names` filter on
 * get_variables / get_local_variables — schema (`required`), runtime
 * enforcement, and instructions must all agree, per the
 * DEBUG_MCP_BP_ADDRESSING precedent.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ErrorCode as McpErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { DebugMcpServer } from '../../../../src/server.js';
import { SessionManager } from '../../../../src/session/session-manager.js';
import { createProductionDependencies } from '../../../../src/container/dependencies.js';
import { buildServerInstructions } from '../../../../src/skill-content.js';
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

function createServer(envOverrides: Record<string, string>) {
  const mockDependencies = createMockDependencies();
  mockDependencies.environment = {
    get: vi.fn((key: string) => envOverrides[key]),
    getAll: vi.fn(() => ({ ...envOverrides })),
    getCurrentWorkingDirectory: vi.fn(() => process.cwd())
  };
  vi.mocked(createProductionDependencies).mockReturnValue(mockDependencies);

  const mockServer = createMockServer();
  vi.mocked(Server).mockImplementation(function() { return mockServer as any; });
  const mockStdioTransport = createMockStdioTransport();
  vi.mocked(StdioServerTransport).mockImplementation(function() { return mockStdioTransport as any; });

  const mockSessionManager = createMockSessionManager(mockDependencies.adapterRegistry);
  vi.mocked(SessionManager).mockImplementation(function() { return mockSessionManager as any; });

  new DebugMcpServer();
  mockSessionManager.getSession.mockReturnValue({ id: 'test-session', sessionLifecycle: 'ACTIVE' });

  return { ...getToolHandlers(mockServer), mockSessionManager };
}

async function getToolSchema(listToolsHandler: any, name: string) {
  const { tools } = await listToolsHandler({ method: 'tools/list', params: {} });
  return tools.find((t: { name: string }) => t.name === name);
}

describe('Variable access gating (issue #237)', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('schema gating', () => {
    it('open mode (default): names is offered but not required', async () => {
      const { listToolsHandler } = createServer({});
      const getVariables = await getToolSchema(listToolsHandler, 'get_variables');
      expect(getVariables.inputSchema.properties.names).toBeDefined();
      expect(getVariables.inputSchema.required).toEqual(['sessionId', 'scope']);

      const getLocals = await getToolSchema(listToolsHandler, 'get_local_variables');
      expect(getLocals.inputSchema.properties.names).toBeDefined();
      expect(getLocals.inputSchema.required).toEqual(['sessionId']);
    });

    it('explicit mode: names becomes required on both tools', async () => {
      const { listToolsHandler } = createServer({ DEBUG_MCP_VARIABLE_ACCESS: 'explicit' });
      const getVariables = await getToolSchema(listToolsHandler, 'get_variables');
      expect(getVariables.inputSchema.required).toEqual(['sessionId', 'scope', 'names']);

      const getLocals = await getToolSchema(listToolsHandler, 'get_local_variables');
      expect(getLocals.inputSchema.required).toEqual(['sessionId', 'names']);
    });
  });

  describe('names filtering (open mode)', () => {
    it('passes names through to the session layer and reports notFound', async () => {
      const { callToolHandler, mockSessionManager } = createServer({});
      mockSessionManager.getVariables.mockResolvedValue([
        { name: 'user', value: "'ada'", type: 'str', expandable: false }
      ]);

      const result = await callToolHandler({
        method: 'tools/call',
        params: {
          name: 'get_variables',
          arguments: { sessionId: 'test-session', scope: 100, names: ['user', 'missing'] }
        }
      });

      expect(mockSessionManager.getVariables).toHaveBeenCalledWith('test-session', 100, ['user', 'missing']);
      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
      expect(content.notFound).toEqual(['missing']);
    });

    it('coerces a JSON-string names argument into an array (SSE transport quirk)', async () => {
      const { callToolHandler, mockSessionManager } = createServer({});
      mockSessionManager.getVariables.mockResolvedValue([]);

      await callToolHandler({
        method: 'tools/call',
        params: {
          name: 'get_variables',
          arguments: { sessionId: 'test-session', scope: 100, names: '["user"]' }
        }
      });

      expect(mockSessionManager.getVariables).toHaveBeenCalledWith('test-session', 100, ['user']);
    });

    it('omits notFound when no names filter was given', async () => {
      const { callToolHandler, mockSessionManager } = createServer({});
      mockSessionManager.getVariables.mockResolvedValue([
        { name: 'x', value: '1', type: 'int', expandable: false }
      ]);

      const result = await callToolHandler({
        method: 'tools/call',
        params: { name: 'get_variables', arguments: { sessionId: 'test-session', scope: 100 } }
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.notFound).toBeUndefined();
    });
  });

  describe('explicit-mode enforcement', () => {
    it('rejects get_variables without names with a clear InvalidParams error', async () => {
      const { callToolHandler } = createServer({ DEBUG_MCP_VARIABLE_ACCESS: 'explicit' });

      await expect(callToolHandler({
        method: 'tools/call',
        params: { name: 'get_variables', arguments: { sessionId: 'test-session', scope: 100 } }
      })).rejects.toSatisfy((error: unknown) => {
        expect(error).toBeInstanceOf(McpError);
        expect((error as McpError).code).toBe(McpErrorCode.InvalidParams);
        expect((error as McpError).message).toContain('Missing required parameter: names');
        return true;
      });
    });

    it('rejects an empty names array the same way', async () => {
      const { callToolHandler } = createServer({ DEBUG_MCP_VARIABLE_ACCESS: 'explicit' });

      await expect(callToolHandler({
        method: 'tools/call',
        params: { name: 'get_variables', arguments: { sessionId: 'test-session', scope: 100, names: [] } }
      })).rejects.toBeInstanceOf(McpError);
    });

    it('rejects get_local_variables without names', async () => {
      const { callToolHandler } = createServer({ DEBUG_MCP_VARIABLE_ACCESS: 'explicit' });

      await expect(callToolHandler({
        method: 'tools/call',
        params: { name: 'get_local_variables', arguments: { sessionId: 'test-session' } }
      })).rejects.toSatisfy((error: unknown) => {
        expect(error).toBeInstanceOf(McpError);
        expect((error as McpError).code).toBe(McpErrorCode.InvalidParams);
        expect((error as McpError).message).toContain('Missing required parameter: names');
        return true;
      });
    });

    it('accepts get_variables with names and threads them through', async () => {
      const { callToolHandler, mockSessionManager } = createServer({ DEBUG_MCP_VARIABLE_ACCESS: 'explicit' });
      mockSessionManager.getVariables.mockResolvedValue([
        { name: 'user', value: "'ada'", type: 'str', expandable: false }
      ]);

      const result = await callToolHandler({
        method: 'tools/call',
        params: {
          name: 'get_variables',
          arguments: { sessionId: 'test-session', scope: 100, names: ['user'] }
        }
      });

      expect(mockSessionManager.getVariables).toHaveBeenCalledWith('test-session', 100, ['user']);
      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
      expect(content.notFound).toEqual([]);
    });

    it('accepts get_local_variables with names', async () => {
      const { callToolHandler, mockSessionManager } = createServer({ DEBUG_MCP_VARIABLE_ACCESS: 'explicit' });
      mockSessionManager.getLocalVariables.mockResolvedValue({
        variables: [{ name: 'total', value: '99', type: 'int', expandable: false }],
        frame: { id: 1, name: 'main', file: 'test.py', line: 10 },
        scopeName: 'Locals'
      });

      const result = await callToolHandler({
        method: 'tools/call',
        params: {
          name: 'get_local_variables',
          arguments: { sessionId: 'test-session', names: ['total', 'gone'] }
        }
      });

      expect(mockSessionManager.getLocalVariables).toHaveBeenCalledWith('test-session', false, ['total', 'gone']);
      const content = JSON.parse(result.content[0].text);
      expect(content.notFound).toEqual(['gone']);
    });
  });

  describe('server instructions', () => {
    it('mentions least-privilege mode when explicit', () => {
      const instructions = buildServerInstructions(undefined, { variableAccessMode: 'explicit' });
      expect(instructions).toContain('least-privilege');
      expect(instructions).toContain('names');
    });

    it('says nothing about least-privilege in open mode', () => {
      const instructions = buildServerInstructions(undefined, { variableAccessMode: 'open' });
      expect(instructions).not.toContain('least-privilege');
    });
  });
});
