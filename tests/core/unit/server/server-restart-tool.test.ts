/**
 * restart_debugging MCP tool tests (issue #238).
 *
 * The tool deliberately skips validateSession's TERMINATED rejection:
 * restarting after the program exited is the primary use case.
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

describe('restart_debugging tool', () => {
  let mockServer: any;
  let mockSessionManager: any;
  let mockDependencies: any;
  let callToolHandler: any;
  let listToolsHandler: any;

  beforeEach(() => {
    mockDependencies = createMockDependencies();
    vi.mocked(createProductionDependencies).mockReturnValue(mockDependencies);

    mockServer = createMockServer();
    vi.mocked(Server).mockImplementation(function() { return mockServer as any; });

    const mockStdioTransport = createMockStdioTransport();
    vi.mocked(StdioServerTransport).mockImplementation(function() { return mockStdioTransport as any; });

    mockSessionManager = createMockSessionManager(mockDependencies.adapterRegistry);
    vi.mocked(SessionManager).mockImplementation(function() { return mockSessionManager as any; });

    new DebugMcpServer();
    const handlers = getToolHandlers(mockServer);
    callToolHandler = handlers.callToolHandler;
    listToolsHandler = handlers.listToolsHandler;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('advertises the restart_debugging tool', async () => {
    const result = await listToolsHandler({ method: 'tools/list', params: {} });
    const names = result.tools.map((t: { name: string }) => t.name);
    expect(names).toContain('restart_debugging');
  });

  it('restarts a TERMINATED session (the primary use case)', async () => {
    mockSessionManager.getSession.mockReturnValue({
      id: 'test-session',
      sessionLifecycle: 'terminated'
    });
    mockSessionManager.restartDebugging.mockResolvedValue({
      success: true,
      state: 'paused',
      data: { reason: 'breakpoint', breakpointsReapplied: 2, outputReset: true }
    });

    const result = await callToolHandler({
      method: 'tools/call',
      params: { name: 'restart_debugging', arguments: { sessionId: 'test-session' } }
    });

    const content = JSON.parse(result.content[0].text);
    expect(content.success).toBe(true);
    expect(content.state).toBe('paused');
    expect(content.data.breakpointsReapplied).toBe(2);
    expect(content.data.outputReset).toBe(true);
    expect(mockSessionManager.restartDebugging).toHaveBeenCalledWith('test-session');
  });

  it('surfaces SessionManager refusals as failed results', async () => {
    mockSessionManager.getSession.mockReturnValue({
      id: 'test-session',
      sessionLifecycle: 'active'
    });
    mockSessionManager.restartDebugging.mockResolvedValue({
      success: false,
      state: 'created',
      error: 'Nothing to restart: this session has not been launched'
    });

    const result = await callToolHandler({
      method: 'tools/call',
      params: { name: 'restart_debugging', arguments: { sessionId: 'test-session' } }
    });

    const content = JSON.parse(result.content[0].text);
    expect(content.success).toBe(false);
    expect(content.error).toContain('Nothing to restart');
  });

  it('rejects a missing sessionId', async () => {
    await expect(callToolHandler({
      method: 'tools/call',
      params: { name: 'restart_debugging', arguments: {} }
    })).rejects.toThrow('Missing required parameter');
  });

  it('reports an unknown session as a failed result', async () => {
    mockSessionManager.getSession.mockReturnValue(undefined);

    const result = await callToolHandler({
      method: 'tools/call',
      params: { name: 'restart_debugging', arguments: { sessionId: 'nope' } }
    });

    const content = JSON.parse(result.content[0].text);
    expect(content.success).toBe(false);
    expect(content.error).toContain('not found');
  });
});
