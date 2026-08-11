/**
 * Tests for the expose_session / unexpose_session tools (issue #217)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { DebugMcpServer } from '../../../../src/server.js';
import { SessionManager } from '../../../../src/session/session-manager.js';
import { createProductionDependencies } from '../../../../src/container/dependencies.js';
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

describe('expose_session and unexpose_session tools', () => {
  let mockServer: any;
  let mockSessionManager: any;
  let mockDependencies: any;
  let callToolHandler: any;
  let listToolsHandler: any;

  const activeSession = { id: 'sess-1', sessionLifecycle: 'active' };

  const callTool = (name: string, args: Record<string, unknown>) =>
    callToolHandler({ method: 'tools/call', params: { name, arguments: args } });

  beforeEach(() => {
    mockDependencies = createMockDependencies();
    vi.mocked(createProductionDependencies).mockReturnValue(mockDependencies);

    mockServer = createMockServer();
    vi.mocked(Server).mockImplementation(function () { return mockServer as any; });

    const mockStdioTransport = createMockStdioTransport();
    vi.mocked(StdioServerTransport).mockImplementation(function () { return mockStdioTransport as any; });

    mockSessionManager = createMockSessionManager(mockDependencies.adapterRegistry);
    vi.mocked(SessionManager).mockImplementation(function () { return mockSessionManager as any; });

    new DebugMcpServer();
    const handlers = getToolHandlers(mockServer);
    callToolHandler = handlers.callToolHandler;
    listToolsHandler = handlers.listToolsHandler;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('registration', () => {
    it('lists both tools with sessionId-only schemas', async () => {
      const result = await listToolsHandler({ method: 'tools/list', params: {} });
      const toolNames = result.tools.map((t: any) => t.name);
      expect(toolNames).toContain('expose_session');
      expect(toolNames).toContain('unexpose_session');

      for (const name of ['expose_session', 'unexpose_session']) {
        const tool = result.tools.find((t: any) => t.name === name);
        expect(tool.inputSchema.required).toEqual(['sessionId']);
        expect(Object.keys(tool.inputSchema.properties)).toEqual(['sessionId']);
      }
    });
  });

  describe('expose_session dispatch', () => {
    it('returns the endpoint with VS Code attach guidance in the message', async () => {
      mockSessionManager.getSession.mockReturnValue(activeSession);
      mockSessionManager.exposeSession.mockResolvedValue({
        success: true,
        state: 'paused',
        host: '127.0.0.1',
        port: 51234,
        token: 'tkn-abc'
      });

      const result = await callTool('expose_session', { sessionId: 'sess-1' });
      const response = JSON.parse(result.content[0].text);

      expect(mockSessionManager.exposeSession).toHaveBeenCalledWith('sess-1');
      expect(response).toMatchObject({
        success: true,
        state: 'paused',
        host: '127.0.0.1',
        port: 51234,
        token: 'tkn-abc'
      });
      expect(response.message).toContain('"debugServer": 51234');
      expect(response.message).toContain('mirrorToken');
      expect(response.message).toContain('tkn-abc');
    });

    it('passes a friendly failure through as a non-thrown result', async () => {
      mockSessionManager.getSession.mockReturnValue(activeSession);
      mockSessionManager.exposeSession.mockResolvedValue({
        success: false,
        state: 'created',
        error: 'No active debug session to expose — start_debugging or attach_to_process first'
      });

      const result = await callTool('expose_session', { sessionId: 'sess-1' });
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(false);
      expect(response.error).toContain('start_debugging');
    });

    it('reports an unknown session as a failed result, not a thrown error', async () => {
      mockSessionManager.getSession.mockReturnValue(undefined);

      const result = await callTool('expose_session', { sessionId: 'ghost' });
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(false);
      expect(mockSessionManager.exposeSession).not.toHaveBeenCalled();
    });

    it('rejects a missing sessionId with an InvalidParams error', async () => {
      await expect(callTool('expose_session', {})).rejects.toThrow(/sessionId/);
    });

    it('appends the container-networking note in container mode', async () => {
      vi.stubEnv('MCP_CONTAINER', 'true');
      mockSessionManager.getSession.mockReturnValue(activeSession);
      mockSessionManager.exposeSession.mockResolvedValue({
        success: true,
        state: 'paused',
        host: '127.0.0.1',
        port: 51234,
        token: 'tkn-abc'
      });

      const result = await callTool('expose_session', { sessionId: 'sess-1' });
      const response = JSON.parse(result.content[0].text);

      expect(response.message).toContain('container');
      expect(response.message).toContain('not reachable from your host IDE');
    });
  });

  describe('unexpose_session dispatch', () => {
    it('reports how many clients were disconnected', async () => {
      mockSessionManager.getSession.mockReturnValue(activeSession);
      mockSessionManager.unexposeSession.mockResolvedValue({
        success: true,
        state: 'paused',
        wasExposed: true,
        closedClients: 2
      });

      const result = await callTool('unexpose_session', { sessionId: 'sess-1' });
      const response = JSON.parse(result.content[0].text);

      expect(mockSessionManager.unexposeSession).toHaveBeenCalledWith('sess-1');
      expect(response.success).toBe(true);
      expect(response.wasExposed).toBe(true);
      expect(response.message).toContain('2 clients disconnected');
    });

    it('is a no-op success when the session was not exposed', async () => {
      mockSessionManager.getSession.mockReturnValue(activeSession);
      mockSessionManager.unexposeSession.mockResolvedValue({
        success: true,
        state: 'running',
        wasExposed: false
      });

      const result = await callTool('unexpose_session', { sessionId: 'sess-1' });
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(true);
      expect(response.wasExposed).toBe(false);
      expect(response.message).toContain('not exposed');
    });
  });

  describe('list_debug_sessions projection', () => {
    it('includes the exposure host/port when present', async () => {
      mockSessionManager.getAllSessions.mockReturnValue([
        {
          id: 'sess-1',
          name: 'test',
          language: 'mock',
          state: 'paused',
          createdAt: new Date('2026-08-11T00:00:00Z'),
          exposure: { host: '127.0.0.1', port: 51234 }
        }
      ]);

      const result = await callTool('list_debug_sessions', {});
      const response = JSON.parse(result.content[0].text);

      expect(response.sessions[0].exposure).toEqual({ host: '127.0.0.1', port: 51234 });
    });
  });
});
