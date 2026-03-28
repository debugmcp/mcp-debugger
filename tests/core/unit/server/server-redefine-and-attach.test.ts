/**
 * Tests for redefine_classes tool and attach stopOnEntry behavior
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { DebugMcpServer } from '../../../../src/server.js';
import { SessionManager } from '../../../../src/session/session-manager.js';
import { DebugSessionInfo, DebugLanguage, SessionState } from '@debugmcp/shared';
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

describe('redefine_classes and attach stopOnEntry tests', () => {
  let mockServer: any;
  let mockSessionManager: any;
  let mockDependencies: any;
  let callToolHandler: any;
  let listToolsHandler: any;

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

  describe('redefine_classes tool registration', () => {
    it('should be listed in available tools', async () => {
      const result = await listToolsHandler({ method: 'tools/list', params: {} });
      const toolNames = result.tools.map((t: any) => t.name);
      expect(toolNames).toContain('redefine_classes');
    });

    it('should have correct input schema', async () => {
      const result = await listToolsHandler({ method: 'tools/list', params: {} });
      const tool = result.tools.find((t: any) => t.name === 'redefine_classes');
      expect(tool).toBeDefined();
      expect(tool.inputSchema.required).toContain('sessionId');
      expect(tool.inputSchema.required).toContain('classesDir');
      expect(tool.inputSchema.properties.sinceTimestamp).toBeDefined();
    });
  });

  describe('redefine_classes tool dispatch', () => {
    it('should call sessionManager.redefineClasses with correct args', async () => {
      mockSessionManager.redefineClasses.mockResolvedValue({
        success: true,
        redefined: ['com.example.Foo'],
        redefinedCount: 1,
        skippedNotLoaded: 5,
        failedCount: 0,
        scannedFiles: 6,
        newestTimestamp: 1234567890,
      });

      const result = await callToolHandler({
        method: 'tools/call',
        params: {
          name: 'redefine_classes',
          arguments: {
            sessionId: 'test-session',
            classesDir: '/path/to/classes',
            sinceTimestamp: 1000000,
          },
        },
      });

      expect(mockSessionManager.redefineClasses).toHaveBeenCalledWith(
        'test-session',
        '/path/to/classes',
        1000000
      );

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
      expect(content.redefined).toEqual(['com.example.Foo']);
      expect(content.redefinedCount).toBe(1);
      expect(content.newestTimestamp).toBe(1234567890);
    });

    it('should default sinceTimestamp to 0 when omitted', async () => {
      mockSessionManager.redefineClasses.mockResolvedValue({
        success: true,
        redefined: [],
        redefinedCount: 0,
        skippedNotLoaded: 0,
        failedCount: 0,
        scannedFiles: 0,
        newestTimestamp: 0,
      });

      await callToolHandler({
        method: 'tools/call',
        params: {
          name: 'redefine_classes',
          arguments: {
            sessionId: 'test-session',
            classesDir: '/path/to/classes',
          },
        },
      });

      expect(mockSessionManager.redefineClasses).toHaveBeenCalledWith(
        'test-session',
        '/path/to/classes',
        0
      );
    });

    it('should propagate errors from sessionManager', async () => {
      mockSessionManager.redefineClasses.mockRejectedValue(new Error('Session not found'));

      await expect(
        callToolHandler({
          method: 'tools/call',
          params: {
            name: 'redefine_classes',
            arguments: {
              sessionId: 'nonexistent',
              classesDir: '/path/to/classes',
            },
          },
        })
      ).rejects.toThrow(/Session not found/);
    });
  });

  describe('create_debug_session attach stopOnEntry', () => {
    const mockSessionInfo: DebugSessionInfo = {
      id: 'attach-session-1',
      name: 'Attach Test',
      language: 'python' as DebugLanguage,
      state: 'created' as SessionState,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    beforeEach(() => {
      mockSessionManager.createSession.mockResolvedValue(mockSessionInfo);
    });

    it('should default stopOnEntry to undefined for attach mode (session manager decides)', async () => {
      mockSessionManager.attachToProcess.mockResolvedValue({
        success: true,
        state: 'paused',
      });

      await callToolHandler({
        method: 'tools/call',
        params: {
          name: 'create_debug_session',
          arguments: {
            language: 'python',
            port: 5009,
          },
        },
      });

      expect(mockSessionManager.attachToProcess).toHaveBeenCalledWith(
        'attach-session-1',
        expect.objectContaining({
          stopOnEntry: undefined,
        })
      );
    });

    it('should forward stopOnEntry=true when explicitly set', async () => {
      mockSessionManager.attachToProcess.mockResolvedValue({
        success: true,
        state: 'paused',
      });

      await callToolHandler({
        method: 'tools/call',
        params: {
          name: 'create_debug_session',
          arguments: {
            language: 'python',
            port: 5009,
            stopOnEntry: true,
          },
        },
      });

      expect(mockSessionManager.attachToProcess).toHaveBeenCalledWith(
        'attach-session-1',
        expect.objectContaining({
          stopOnEntry: true,
        })
      );
    });
  });

  describe('attach_to_process stopOnEntry', () => {
    it('should default stopOnEntry to undefined (session manager decides)', async () => {
      mockSessionManager.attachToProcess.mockResolvedValue({
        success: true,
        state: 'paused',
      });

      await callToolHandler({
        method: 'tools/call',
        params: {
          name: 'attach_to_process',
          arguments: {
            sessionId: 'test-session',
            port: 5006,
          },
        },
      });

      expect(mockSessionManager.attachToProcess).toHaveBeenCalledWith(
        'test-session',
        expect.objectContaining({
          stopOnEntry: undefined,
        })
      );
    });

    it('should forward stopOnEntry=true when explicitly set', async () => {
      mockSessionManager.attachToProcess.mockResolvedValue({
        success: true,
        state: 'paused',
      });

      await callToolHandler({
        method: 'tools/call',
        params: {
          name: 'attach_to_process',
          arguments: {
            sessionId: 'test-session',
            port: 5006,
            stopOnEntry: true,
          },
        },
      });

      expect(mockSessionManager.attachToProcess).toHaveBeenCalledWith(
        'test-session',
        expect.objectContaining({
          stopOnEntry: true,
        })
      );
    });
  });
});
