/**
 * Server session management tools tests
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ErrorCode as McpErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { DebugMcpServer } from '../../../../src/server.js';
import { SessionManager } from '../../../../src/session/session-manager.js';
import { DebugSessionInfo, DebugLanguage, SessionState } from '../../../../src/session/models.js';
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

describe('Server Session Tools Tests', () => {
  let debugServer: DebugMcpServer;
  let mockServer: any;
  let mockSessionManager: any;
  let mockDependencies: any;
  let callToolHandler: any;

  beforeEach(() => {
    mockDependencies = createMockDependencies();
    vi.mocked(createProductionDependencies).mockReturnValue(mockDependencies);
    
    mockServer = createMockServer();
    vi.mocked(Server).mockImplementation(() => mockServer as any);
    
    const mockStdioTransport = createMockStdioTransport();
    vi.mocked(StdioServerTransport).mockImplementation(() => mockStdioTransport as any);
    
    mockSessionManager = createMockSessionManager(mockDependencies.adapterRegistry);
    vi.mocked(SessionManager).mockImplementation(() => mockSessionManager as any);
    
    debugServer = new DebugMcpServer();
    callToolHandler = getToolHandlers(mockServer).callToolHandler;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('create_debug_session', () => {
    it('should create session with valid config', async () => {
      const mockSessionInfo: DebugSessionInfo = {
        id: 'test-session-123',
        name: 'Test Session',
        language: 'python' as DebugLanguage,
        state: 'created' as SessionState,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      mockSessionManager.createSession.mockResolvedValue(mockSessionInfo);
      
      const result = await callToolHandler({
        method: 'tools/call',
        params: {
          name: 'create_debug_session',
          arguments: {
            language: 'python',
            name: 'Test Session',
            executablePath: '/usr/bin/python3'
          }
        }
      });
      
      expect(mockSessionManager.createSession).toHaveBeenCalledWith({
        language: 'python',
        name: 'Test Session',
        executablePath: '/usr/bin/python3'
      });
      
      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
      expect(content.sessionId).toBe('test-session-123');
      expect(content.message).toContain('Created python debug session');
    });

    it('should handle invalid language parameter', async () => {
      await expect(callToolHandler({
        method: 'tools/call',
        params: {
          name: 'create_debug_session',
          arguments: {
            language: 'java' // Invalid language
          }
        }
      })).rejects.toThrow(McpError);
      
      await expect(callToolHandler({
        method: 'tools/call',
        params: {
          name: 'create_debug_session',
          arguments: {
            language: 'java'
          }
        }
      })).rejects.toThrow("Language 'java' is not supported");
    });

    it('should handle SessionManager creation errors', async () => {
      mockSessionManager.createSession.mockRejectedValue(new Error('Session creation failed'));
      
      await expect(callToolHandler({
        method: 'tools/call',
        params: {
          name: 'create_debug_session',
          arguments: {
            language: 'python'
          }
        }
      })).rejects.toThrow(/Session creation failed/);
      
      expect(mockDependencies.logger.error).toHaveBeenCalledWith(
        'Failed to create debug session',
        expect.objectContaining({ error: 'Session creation failed' })
      );
    });

    it('should generate default session name if not provided', async () => {
      const mockSessionInfo: DebugSessionInfo = {
        id: 'test-session-123',
        name: 'Debug-1234567890',
        language: 'python' as DebugLanguage,
        state: 'created' as SessionState,
        createdAt: new Date()
      };
      
      mockSessionManager.createSession.mockResolvedValue(mockSessionInfo);
      
      const result = await callToolHandler({
        method: 'tools/call',
        params: {
          name: 'create_debug_session',
          arguments: {
            language: 'python'
            // name not provided
          }
        }
      });
      
      const createCall = mockSessionManager.createSession.mock.calls[0][0];
      expect(createCall.name).toMatch(/^python-debug-\d+$/);
    });
  });

  describe('list_debug_sessions', () => {
    it('should list all sessions successfully', async () => {
      const mockSessions: DebugSessionInfo[] = [
        {
          id: 'session-1',
          name: 'Session 1',
          language: 'python' as DebugLanguage,
          state: 'running' as SessionState,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'session-2',
          name: 'Session 2',
          language: 'python' as DebugLanguage,
          state: 'stopped' as SessionState,
          createdAt: new Date()
        }
      ];
      
      mockSessionManager.getAllSessions.mockReturnValue(mockSessions);
      
      const result = await callToolHandler({
        method: 'tools/call',
        params: {
          name: 'list_debug_sessions',
          arguments: {}
        }
      });
      
      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
      expect(content.sessions).toHaveLength(2);
      expect(content.count).toBe(2);
    });

    it('should handle SessionManager errors', async () => {
      mockSessionManager.getAllSessions.mockImplementation(() => {
        throw new Error('Failed to get sessions');
      });
      
      await expect(callToolHandler({
        method: 'tools/call',
        params: {
          name: 'list_debug_sessions',
          arguments: {}
        }
      })).rejects.toThrow(/Failed to get sessions/);
    });
  });

  describe('close_debug_session', () => {
    it('should close session successfully', async () => {
      mockSessionManager.closeSession.mockResolvedValue(true);
      
      const result = await callToolHandler({
        method: 'tools/call',
        params: {
          name: 'close_debug_session',
          arguments: { sessionId: 'test-session' }
        }
      });
      
      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
      expect(content.message).toContain('Closed debug session');
    });

    it('should handle session not found', async () => {
      mockSessionManager.closeSession.mockResolvedValue(false);
      
      const result = await callToolHandler({
        method: 'tools/call',
        params: {
          name: 'close_debug_session',
          arguments: { sessionId: 'non-existent' }
        }
      });
      
      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(false);
      expect(content.message).toContain('Failed to close debug session');
    });

    it('should handle SessionManager errors', async () => {
      mockSessionManager.closeSession.mockRejectedValue(new Error('Close failed'));
      
      await expect(callToolHandler({
        method: 'tools/call',
        params: {
          name: 'close_debug_session',
          arguments: { sessionId: 'test-session' }
        }
      })).rejects.toThrow(/Close failed/);
    });
  });
});
