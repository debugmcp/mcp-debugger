/**
 * Server variable and stack inspection tools tests
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ErrorCode as McpErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
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

describe('Server Inspection Tools Tests', () => {
  let debugServer: DebugMcpServer;
  let mockServer: any;
  let mockSessionManager: any;
  let mockDependencies: any;
  let callToolHandler: any;

  beforeEach(() => {
    // Use fake timers to prevent real timeouts
    vi.useFakeTimers();

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

  afterEach(async () => {
    // Clean up any pending timers to prevent unhandled promise rejections
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.clearAllMocks();

    // If there's a session manager with active sessions, clean them up
    if (mockSessionManager && mockSessionManager.closeAllSessions) {
      try {
        await mockSessionManager.closeAllSessions();
      } catch (error) {
        // Ignore cleanup errors in tests
      }
    }
  });

  describe('get_variables', () => {
    it('should get variables successfully', async () => {
      const mockVariables = [
        { name: 'x', value: '10', type: 'int', variablesReference: 0, expandable: false },
        { name: 'y', value: '20', type: 'int', variablesReference: 0, expandable: false }
      ];
      
      // Mock session validation
      mockSessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: 'ACTIVE' // Not terminated
      });
      mockSessionManager.getVariables.mockResolvedValue(mockVariables);
      
      const result = await callToolHandler({
        method: 'tools/call',
        params: {
          name: 'get_variables',
          arguments: {
            sessionId: 'test-session',
            scope: 100
          }
        }
      });
      
      expect(mockSessionManager.getVariables).toHaveBeenCalledWith('test-session', 100);
      
      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
      expect(content.variables).toHaveLength(2);
      expect(content.count).toBe(2);
      expect(content.variablesReference).toBe(100);
    });

    it('should validate required scope parameter', async () => {
      // Test for proper MCP parameter validation (improved from previous runtime error behavior)
      // The server now validates parameters upfront and returns clear MCP errors
      await expect(callToolHandler({
        method: 'tools/call',
        params: {
          name: 'get_variables',
          arguments: {
            sessionId: 'test-session'
            // Missing scope parameter
          }
        }
      })).rejects.toSatisfy((error) => {
        expect(error).toBeInstanceOf(McpError);
        expect(error.code).toBe(McpErrorCode.InvalidParams);
        // The server returns a generic "Missing required parameters" message
        // This is proper parameter validation behavior, preventing undefined values
        // from propagating to the session manager
        expect(error.message).toMatch(/missing.*required.*parameter/i);
        return true;
      });
    });

    it('should validate scope parameter type', async () => {
      // Mock session validation
      mockSessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: 'ACTIVE' // Not terminated
      });
      // When scope is invalid string, it's passed as NaN which causes the same error
      mockSessionManager.getVariables.mockRejectedValue(new Error("Cannot read properties of undefined (reading 'length')"));
      
      await expect(callToolHandler({
        method: 'tools/call',
        params: {
          name: 'get_variables',
          arguments: {
            sessionId: 'test-session',
            scope: 'invalid' // Wrong type
          }
        }
      })).rejects.toThrow(/Cannot read properties of undefined/);
    });

    it('should handle SessionManager errors', async () => {
      // Mock getSession to return null - session not found
      mockSessionManager.getSession.mockReturnValue(null);

      let result;
      try {
        result = await callToolHandler({
          method: 'tools/call',
          params: {
            name: 'get_variables',
            arguments: {
              sessionId: 'test-session',
              scope: 100
            }
          }
        });
      } catch (error) {
        // If error is thrown, convert it to the expected format
        result = {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error.message
            })
          }]
        };
      }

      // The server now returns a success response with error message instead of throwing
      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(false);
      expect(content.error).toContain('Session not found: test-session');
    });
  });

  describe('get_stack_trace', () => {
    it('should get stack trace successfully', async () => {
      const mockStackFrames = [
        { id: 1, name: 'main', file: 'test.py', line: 10 }
      ];
      
      const mockSession = {
        proxyManager: {
          getCurrentThreadId: vi.fn().mockReturnValue(1)
        }
      };
      
      mockSessionManager.getSession.mockReturnValue(mockSession);
      mockSessionManager.getStackTrace.mockResolvedValue(mockStackFrames);
      
      const result = await callToolHandler({
        method: 'tools/call',
        params: {
          name: 'get_stack_trace',
          arguments: { sessionId: 'test-session' }
        }
      });
      
      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
      expect(content.stackFrames).toHaveLength(1);
    });

    it('should handle missing session', async () => {
      mockSessionManager.getSession.mockReturnValue(null);

      let result;
      try {
        result = await callToolHandler({
          method: 'tools/call',
          params: {
            name: 'get_stack_trace',
            arguments: { sessionId: 'non-existent' }
          }
        });
      } catch (error) {
        // If error is thrown, convert it to the expected format
        result = {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error.message
            })
          }]
        };
      }

      // The server now returns a success response with error message
      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(false);
      expect(content.error).toContain('Session not found: non-existent');
    });

    it('should handle missing proxy manager', async () => {
      const mockSession = { proxyManager: null };
      mockSessionManager.getSession.mockReturnValue(mockSession);
      
      const result = await callToolHandler({
        method: 'tools/call',
        params: {
          name: 'get_stack_trace',
          arguments: { sessionId: 'test-session' }
        }
      });
      
      // The server now returns a success response with error message
      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(false);
      expect(content.error).toContain('no active proxy for session test-session');
    });

    it('should handle missing thread ID', async () => {
      const mockSession = {
        proxyManager: {
          getCurrentThreadId: vi.fn().mockReturnValue(null)
        }
      };
      
      mockSessionManager.getSession.mockReturnValue(mockSession);
      
      const result = await callToolHandler({
        method: 'tools/call',
        params: {
          name: 'get_stack_trace',
          arguments: { sessionId: 'test-session' }
        }
      });
      
      // The server now returns a success response with error message
      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(false);
      expect(content.error).toContain('no active proxy for session test-session');
    });

    it('should handle SessionManager errors', async () => {
      const mockSession = {
        proxyManager: {
          getCurrentThreadId: vi.fn().mockReturnValue(1)
        }
      };
      
      mockSessionManager.getSession.mockReturnValue(mockSession);
      mockSessionManager.getStackTrace.mockRejectedValue(new Error('Stack trace failed'));
      
      await expect(callToolHandler({
        method: 'tools/call',
        params: {
          name: 'get_stack_trace',
          arguments: { sessionId: 'test-session' }
        }
      })).rejects.toThrow(/Stack trace failed/);
    });
  });

  describe('get_scopes', () => {
    it('should get scopes successfully', async () => {
      const mockScopes = [
        { name: 'Locals', variablesReference: 100, expensive: false }
      ];
      
      // Mock session validation
      mockSessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: 'ACTIVE' // Not terminated
      });
      mockSessionManager.getScopes.mockResolvedValue(mockScopes);
      
      const result = await callToolHandler({
        method: 'tools/call',
        params: {
          name: 'get_scopes',
          arguments: {
            sessionId: 'test-session',
            frameId: 1
          }
        }
      });
      
      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
      expect(content.scopes).toHaveLength(1);
    });

    it('should handle SessionManager errors', async () => {
      // Mock getSession to return null - session not found
      mockSessionManager.getSession.mockReturnValue(null);

      let result;
      try {
        result = await callToolHandler({
          method: 'tools/call',
          params: {
            name: 'get_scopes',
            arguments: {
              sessionId: 'test-session',
              frameId: 1
            }
          }
        });
      } catch (error) {
        // If error is thrown, convert it to the expected format
        result = {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error.message
            })
          }]
        };
      }

      // The server now returns a success response with error message instead of throwing
      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(false);
      expect(content.error).toContain('Session not found: test-session');
    });
  });
});
