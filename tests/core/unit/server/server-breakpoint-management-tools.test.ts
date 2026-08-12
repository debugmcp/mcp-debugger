/**
 * Server breakpoint-management tools tests (issue #236):
 * list_breakpoints / remove_breakpoint / clear_breakpoints
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

// Mock dependencies
vi.mock('@modelcontextprotocol/sdk/server/index.js');
vi.mock('@modelcontextprotocol/sdk/server/stdio.js');
vi.mock('../../../../src/session/session-manager.js');
vi.mock('../../../../src/container/dependencies.js');

describe('Server Breakpoint Management Tools', () => {
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

    mockSessionManager.getSession.mockReturnValue({
      id: 'test-session',
      sessionLifecycle: 'active'
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('advertises the three breakpoint-management tools', async () => {
    const result = await listToolsHandler({ method: 'tools/list', params: {} });
    const names = result.tools.map((t: { name: string }) => t.name);

    expect(names).toContain('list_breakpoints');
    expect(names).toContain('remove_breakpoint');
    expect(names).toContain('clear_breakpoints');
  });

  describe('list_breakpoints', () => {
    it('returns the session breakpoints with a count', async () => {
      mockSessionManager.listBreakpoints.mockReturnValue([
        { id: 'bp-1', file: '/a.py', line: 10, verified: true, adapterId: 3 },
        { id: 'bp-2', file: '/b.py', line: 20, verified: false }
      ]);

      const result = await callToolHandler({
        method: 'tools/call',
        params: {
          name: 'list_breakpoints',
          arguments: { sessionId: 'test-session' }
        }
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
      expect(content.count).toBe(2);
      expect(content.breakpoints).toHaveLength(2);
      expect(content.breakpoints[0]).toMatchObject({ id: 'bp-1', adapterId: 3, verified: true });
      expect(mockSessionManager.listBreakpoints).toHaveBeenCalledWith('test-session', undefined);
    });

    it('always includes empty function-breakpoint fields in the unfiltered response (#306)', async () => {
      mockSessionManager.listBreakpoints.mockReturnValue([]);
      mockSessionManager.listFunctionBreakpoints.mockReturnValue([]);

      const result = await callToolHandler({
        method: 'tools/call',
        params: {
          name: 'list_breakpoints',
          arguments: { sessionId: 'test-session' }
        }
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.functionBreakpoints).toEqual([]);
      expect(content.functionCount).toBe(0);
    });

    it('includes function breakpoints in the unfiltered response', async () => {
      mockSessionManager.listBreakpoints.mockReturnValue([]);
      mockSessionManager.listFunctionBreakpoints.mockReturnValue([
        { id: 'fn-1', functionName: 'main', verified: false }
      ]);

      const result = await callToolHandler({
        method: 'tools/call',
        params: {
          name: 'list_breakpoints',
          arguments: { sessionId: 'test-session' }
        }
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.functionBreakpoints).toHaveLength(1);
      expect(content.functionBreakpoints[0]).toMatchObject({ functionName: 'main', verified: false });
      expect(content.functionCount).toBe(1);
    });

    it('omits function-breakpoint fields when filtering by file', async () => {
      mockSessionManager.listBreakpoints.mockReturnValue([
        { id: 'bp-1', file: '/a.py', line: 10, verified: true }
      ]);
      mockSessionManager.listFunctionBreakpoints.mockReturnValue([
        { id: 'fn-1', functionName: 'main', verified: true }
      ]);

      const result = await callToolHandler({
        method: 'tools/call',
        params: {
          name: 'list_breakpoints',
          arguments: { sessionId: 'test-session', file: '/a.py' }
        }
      });

      const content = JSON.parse(result.content[0].text);
      // Function breakpoints are session-global; a file filter deliberately
      // excludes them (issue #271 phase 3), so the keys stay absent.
      expect(content.functionBreakpoints).toBeUndefined();
      expect(content.functionCount).toBeUndefined();
      expect(mockSessionManager.listFunctionBreakpoints).not.toHaveBeenCalled();
    });

    it('works for a terminated session', async () => {
      mockSessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: 'terminated'
      });
      mockSessionManager.listBreakpoints.mockReturnValue([]);

      const result = await callToolHandler({
        method: 'tools/call',
        params: {
          name: 'list_breakpoints',
          arguments: { sessionId: 'test-session' }
        }
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
      expect(content.count).toBe(0);
    });

    it('rejects a missing sessionId', async () => {
      await expect(callToolHandler({
        method: 'tools/call',
        params: { name: 'list_breakpoints', arguments: {} }
      })).rejects.toThrow('Missing required parameter');
    });
  });

  describe('remove_breakpoint', () => {
    it('removes by breakpointId', async () => {
      mockSessionManager.removeBreakpoint.mockResolvedValue({
        removed: { id: 'bp-1', file: '/a.py', line: 10, verified: true }
      });

      const result = await callToolHandler({
        method: 'tools/call',
        params: {
          name: 'remove_breakpoint',
          arguments: { sessionId: 'test-session', breakpointId: 'bp-1' }
        }
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
      expect(content.removed).toHaveLength(1);
      expect(mockSessionManager.removeBreakpoint).toHaveBeenCalledWith('test-session', 'bp-1');
    });

    it('reports failure for an unknown breakpointId', async () => {
      mockSessionManager.removeBreakpoint.mockResolvedValue({ removed: undefined });

      const result = await callToolHandler({
        method: 'tools/call',
        params: {
          name: 'remove_breakpoint',
          arguments: { sessionId: 'test-session', breakpointId: 'nope' }
        }
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(false);
      expect(content.error).toContain('No breakpoint found');
    });

    it('removes by file and line when no breakpointId is given', async () => {
      mockSessionManager.removeBreakpointsByLocation.mockResolvedValue({
        removed: [{ id: 'bp-1', file: '/path/to/test.py', line: 10, verified: true }]
      });

      const result = await callToolHandler({
        method: 'tools/call',
        params: {
          name: 'remove_breakpoint',
          arguments: { sessionId: 'test-session', file: '/path/to/test.py', line: 10 }
        }
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
      expect(mockSessionManager.removeBreakpointsByLocation).toHaveBeenCalledWith(
        'test-session',
        expect.stringContaining('/path/to/test.py'),
        10
      );
    });

    it('rejects a call with neither breakpointId nor file+line', async () => {
      await expect(callToolHandler({
        method: 'tools/call',
        params: {
          name: 'remove_breakpoint',
          arguments: { sessionId: 'test-session' }
        }
      })).rejects.toThrow(/breakpointId|file/);
    });
  });

  describe('clear_breakpoints', () => {
    it('clears all breakpoints in the session', async () => {
      mockSessionManager.clearBreakpoints.mockResolvedValue({
        cleared: 3,
        files: ['/a.py', '/b.py']
      });

      const result = await callToolHandler({
        method: 'tools/call',
        params: {
          name: 'clear_breakpoints',
          arguments: { sessionId: 'test-session' }
        }
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
      expect(content.cleared).toBe(3);
      expect(content.files).toEqual(['/a.py', '/b.py']);
      expect(mockSessionManager.clearBreakpoints).toHaveBeenCalledWith('test-session', undefined);
    });

    it('scopes clearing to one file when given', async () => {
      mockSessionManager.clearBreakpoints.mockResolvedValue({
        cleared: 1,
        files: ['/path/to/test.py']
      });

      const result = await callToolHandler({
        method: 'tools/call',
        params: {
          name: 'clear_breakpoints',
          arguments: { sessionId: 'test-session', file: '/path/to/test.py' }
        }
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
      expect(mockSessionManager.clearBreakpoints).toHaveBeenCalledWith(
        'test-session',
        expect.stringContaining('/path/to/test.py')
      );
    });

    it('treats clearing zero breakpoints as success', async () => {
      mockSessionManager.clearBreakpoints.mockResolvedValue({ cleared: 0, files: [] });

      const result = await callToolHandler({
        method: 'tools/call',
        params: {
          name: 'clear_breakpoints',
          arguments: { sessionId: 'test-session' }
        }
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
      expect(content.cleared).toBe(0);
    });
  });
});
