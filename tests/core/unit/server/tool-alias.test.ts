/**
 * `redefine_classes` is a deprecated alias of `hot_reload` (issue #876): accepted at the
 * tools/call boundary, resolved to the one handler, answered with a deprecation warning, and
 * not advertised by tools/list. An unknown name is still refused the same way as before.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ErrorCode as McpErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { DebugMcpServer } from '../../../../src/server.js';
import { SessionManager } from '../../../../src/session/session-manager.js';
import { createProductionDependencies } from '../../../../src/container/dependencies.js';
import { TOOL_ALIASES, TOOL_NAMES, buildToolDefinitions } from '../../../../src/server/tool-schemas.js';
import {
  createMockDependencies,
  createMockServer,
  createMockSessionManager,
  createMockStdioTransport,
  getToolHandlers,
  type CallToolHandler
} from './server-test-helpers.js';

vi.mock('@modelcontextprotocol/sdk/server/index.js');
vi.mock('@modelcontextprotocol/sdk/server/stdio.js');
vi.mock('../../../../src/session/session-manager.js');
vi.mock('../../../../src/container/dependencies.js');

describe('tool aliases (issue #876)', () => {
  let callToolHandler: CallToolHandler;
  let mockDependencies: ReturnType<typeof createMockDependencies>;
  let manager: ReturnType<typeof createMockSessionManager>;

  beforeEach(() => {
    mockDependencies = createMockDependencies();
    vi.mocked(mockDependencies.environment.get).mockReturnValue(undefined);
    vi.mocked(createProductionDependencies).mockReturnValue(mockDependencies);
    const mockServer = createMockServer();
    vi.mocked(Server).mockImplementation(function() { return mockServer as never; });
    vi.mocked(StdioServerTransport).mockImplementation(function() { return createMockStdioTransport() as never; });
    manager = createMockSessionManager(mockDependencies.adapterRegistry);
    vi.mocked(SessionManager).mockImplementation(function() { return manager as never; });
    new DebugMcpServer();
    callToolHandler = getToolHandlers(mockServer).callToolHandler;
  });

  it('maps redefine_classes to hot_reload and is not advertised', () => {
    expect(TOOL_ALIASES).toEqual({ redefine_classes: 'hot_reload' });
    expect(TOOL_NAMES).toContain('hot_reload');
    expect(TOOL_NAMES).not.toContain('redefine_classes');
    expect(buildToolDefinitions({ supportedLanguages: ['java'], environment: mockDependencies.environment }).map((d) => d.name)).not.toContain('redefine_classes');
  });

  it('dispatches a redefine_classes call to the hot_reload handler and warns that the name is deprecated', async () => {
    manager.getSession = vi.fn().mockReturnValue({ id: 'session-1' }) as never;
    manager.hotReload = vi.fn().mockResolvedValue({ success: true, redefinedCount: 1, redefined: ['com.example.Foo'] }) as never;

    const result = await callToolHandler({
      method: 'tools/call',
      params: { name: 'redefine_classes', arguments: { sessionId: 'session-1', classesDir: '/workspace/classes', sinceTimestamp: 5 } }
    });

    expect(manager.hotReload).toHaveBeenCalledWith('session-1', { classesDir: '/workspace/classes', sinceTimestamp: 5 }, undefined);
    const text = (result as { content: Array<{ text: string }> }).content[0].text;
    const payload = JSON.parse(text) as { success: boolean; redefinedCount?: number; warning?: string };
    expect(payload.success).toBe(true);
    expect(payload.redefinedCount).toBe(1);
    expect(payload.warning).toMatch(/redefine_classes is a deprecated alias of hot_reload/);
  });

  it('answers a hot_reload call without the deprecation warning', async () => {
    manager.getSession = vi.fn().mockReturnValue({ id: 'session-1' }) as never;
    manager.hotReload = vi.fn().mockResolvedValue({ success: true, state: 'paused' }) as never;

    const result = await callToolHandler({
      method: 'tools/call',
      params: { name: 'hot_reload', arguments: { sessionId: 'session-1' } }
    });

    expect(manager.hotReload).toHaveBeenCalledWith('session-1', {}, undefined);
    const payload = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text) as { warning?: string };
    expect(payload.warning).toBeUndefined();
  });

  it('still refuses an unknown tool name', async () => {
    let caught: unknown;
    try {
      await callToolHandler({ method: 'tools/call', params: { name: 'reload_hot', arguments: { sessionId: 'session-1' } } });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(McpError);
    expect((caught as McpError).code).toBe(McpErrorCode.MethodNotFound);
  });
});
