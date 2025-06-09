/**
 * Unit tests for MCP Server
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { DebugMcpServer } from '../../src/server.js';
import { createLogger } from '../../src/utils/logger.js';
import { SessionManager } from '../../src/session/session-manager.js';
import { DebugSessionInfo, DebugLanguage, SessionState, Breakpoint } from '../../src/session/models.js';

// Mock dependencies
vi.mock('@modelcontextprotocol/sdk/server/index.js');
vi.mock('@modelcontextprotocol/sdk/server/stdio.js');
vi.mock('../../src/utils/logger');
vi.mock('../../src/session/session-manager');

describe('MCP Server', () => {
  let debugServer: DebugMcpServer;
  let mockServer: any;
  let mockSessionManager: any;
  let mockLogger: any;
  let mockStdioTransport: any;

  beforeEach(() => {
    // Setup mock logger
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn()
    };
    
    vi.mocked(createLogger).mockReturnValue(mockLogger);
    
    // Setup mock server
    mockServer = {
      setRequestHandler: vi.fn(),
      connect: vi.fn(),
      close: vi.fn(),
      onerror: undefined as any
    };
    
    // Mock Server constructor
    vi.mocked(Server).mockImplementation(() => mockServer as any);
    
    // Setup mock StdioTransport
    mockStdioTransport = {};
    vi.mocked(StdioServerTransport).mockImplementation(() => mockStdioTransport as any);
    
    // Setup mock SessionManager
    mockSessionManager = {
      createSession: vi.fn(),
      getAllSessions: vi.fn(),
      getSession: vi.fn(),
      closeSession: vi.fn(),
      closeAllSessions: vi.fn(),
      setBreakpoint: vi.fn(),
      startDebugging: vi.fn(),
      stepOver: vi.fn(),
      stepInto: vi.fn(),
      stepOut: vi.fn(),
      continue: vi.fn(),
      getVariables: vi.fn(),
      getStackTrace: vi.fn(),
      getScopes: vi.fn()
    };
    
    vi.mocked(SessionManager).mockImplementation(() => mockSessionManager as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('DebugMcpServer', () => {
    it('should initialize server with correct configuration', () => {
      debugServer = new DebugMcpServer({ logLevel: 'debug' });
      
      expect(Server).toHaveBeenCalledWith(
        { name: 'debug-mcp-server', version: '0.1.0' },
        { capabilities: { tools: {} } }
      );
      
      expect(createLogger).toHaveBeenCalledWith('debug-mcp:server', {
        level: 'debug',
        file: undefined
      });
    });

    it('should register tool handlers', () => {
      debugServer = new DebugMcpServer();
      
      expect(mockServer.setRequestHandler).toHaveBeenCalledTimes(2);
      expect(mockServer.setRequestHandler).toHaveBeenCalledWith(
        expect.objectContaining({ parse: expect.any(Function) }), // ListToolsRequestSchema
        expect.any(Function)
      );
      expect(mockServer.setRequestHandler).toHaveBeenCalledWith(
        expect.objectContaining({ parse: expect.any(Function) }), // CallToolRequestSchema
        expect.any(Function)
      );
    });

    it('should set error handler', () => {
      debugServer = new DebugMcpServer();
      
      expect(mockServer.onerror).toBeDefined();
      
      // Test error handler
      const testError = new Error('Test error');
      if (mockServer.onerror) {
        mockServer.onerror(testError);
      }
      
      expect(mockLogger.error).toHaveBeenCalledWith('Server error', { error: testError });
    });

    it('should start server with stdio transport', async () => {
      debugServer = new DebugMcpServer();
      
      await debugServer.start();
      
      expect(StdioServerTransport).toHaveBeenCalled();
      expect(mockServer.connect).toHaveBeenCalledWith(mockStdioTransport);
      expect(mockLogger.info).toHaveBeenCalledWith('Starting Debug MCP Server (for StdioTransport)');
      expect(mockLogger.info).toHaveBeenCalledWith('Server connected to stdio transport');
    });

    it('should stop server and close all sessions', async () => {
      debugServer = new DebugMcpServer();
      mockSessionManager.closeAllSessions.mockResolvedValue(undefined);
      mockServer.close.mockResolvedValue(undefined);
      
      await debugServer.stop();
      
      expect(mockSessionManager.closeAllSessions).toHaveBeenCalled();
      expect(mockServer.close).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Stopping Debug MCP Server');
      expect(mockLogger.info).toHaveBeenCalledWith('Server stopped');
    });
  });

  describe('Tool Handlers', () => {
    let listToolsHandler: any;
    let callToolHandler: any;

    beforeEach(() => {
      debugServer = new DebugMcpServer();
      
      // Get the handlers
      const handlers = mockServer.setRequestHandler.mock.calls;
      listToolsHandler = handlers[0]?.[1]; // First handler is for ListToolsRequestSchema
      callToolHandler = handlers[1]?.[1]; // Second handler is for CallToolRequestSchema
    });

    it('should handle tools/list request', async () => {
      const result = await listToolsHandler({ method: 'tools/list', params: {} });
      
      expect(result.tools).toBeDefined();
      expect(result.tools.length).toBeGreaterThan(0);
      
      // Check that all required tools are present
      const toolNames = result.tools.map((t: any) => t.name);
      expect(toolNames).toContain('create_debug_session');
      expect(toolNames).toContain('list_debug_sessions');
      expect(toolNames).toContain('set_breakpoint');
      expect(toolNames).toContain('start_debugging');
      expect(toolNames).toContain('close_debug_session');
      expect(toolNames).toContain('step_over');
      expect(toolNames).toContain('step_into');
      expect(toolNames).toContain('step_out');
      expect(toolNames).toContain('continue_execution');
      expect(toolNames).toContain('get_variables');
      expect(toolNames).toContain('get_stack_trace');
    });

    it('should handle create_debug_session tool', async () => {
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
            name: 'Test Session'
          }
        }
      });
      
      expect(mockSessionManager.createSession).toHaveBeenCalledWith({
        language: 'python',
        name: 'Test Session',
        pythonPath: undefined
      });
      
      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
      expect(content.sessionId).toBe('test-session-123');
      expect(content.message).toContain('Created python debug session');
    });

    it('should handle list_debug_sessions tool', async () => {
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

    it('should handle set_breakpoint tool', async () => {
      const mockBreakpoint: Breakpoint = {
        id: 'bp-1',
        file: 'test.py',
        line: 10,
        verified: true
      };
      
      mockSessionManager.setBreakpoint.mockResolvedValue(mockBreakpoint);
      
      const result = await callToolHandler({
        method: 'tools/call',
        params: {
          name: 'set_breakpoint',
          arguments: {
            sessionId: 'test-session',
            file: 'test.py',
            line: 10
          }
        }
      });
      
      expect(mockSessionManager.setBreakpoint).toHaveBeenCalledWith(
        'test-session',
        'test.py',
        10,
        undefined
      );
      
      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
      expect(content.breakpointId).toBe('bp-1');
      expect(content.message).toContain('Breakpoint set at test.py:10');
    });

    it('should handle start_debugging tool', async () => {
      mockSessionManager.startDebugging.mockResolvedValue({
        success: true,
        state: 'running',
        data: { message: 'Debugging started' }
      });
      
      const result = await callToolHandler({
        method: 'tools/call',
        params: {
          name: 'start_debugging',
          arguments: {
            sessionId: 'test-session',
            scriptPath: 'test.py',
            args: ['--debug']
          }
        }
      });
      
      expect(mockSessionManager.startDebugging).toHaveBeenCalledWith(
        'test-session',
        'test.py',
        ['--debug'],
        undefined,
        undefined
      );
      
      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
      expect(content.state).toBe('running');
    });

    it('should handle step commands', async () => {
      const stepResult = { success: true, state: 'stopped' };
      
      // Test step_over
      mockSessionManager.stepOver.mockResolvedValue(stepResult);
      let result = await callToolHandler({
        method: 'tools/call',
        params: {
          name: 'step_over',
          arguments: { sessionId: 'test-session' }
        }
      });
      
      expect(mockSessionManager.stepOver).toHaveBeenCalledWith('test-session');
      let content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
      expect(content.message).toBe('Stepped over');
      
      // Test step_into
      mockSessionManager.stepInto.mockResolvedValue(stepResult);
      result = await callToolHandler({
        method: 'tools/call',
        params: {
          name: 'step_into',
          arguments: { sessionId: 'test-session' }
        }
      });
      
      expect(mockSessionManager.stepInto).toHaveBeenCalledWith('test-session');
      content = JSON.parse(result.content[0].text);
      expect(content.message).toBe('Stepped into');
      
      // Test step_out
      mockSessionManager.stepOut.mockResolvedValue(stepResult);
      result = await callToolHandler({
        method: 'tools/call',
        params: {
          name: 'step_out',
          arguments: { sessionId: 'test-session' }
        }
      });
      
      expect(mockSessionManager.stepOut).toHaveBeenCalledWith('test-session');
      content = JSON.parse(result.content[0].text);
      expect(content.message).toBe('Stepped out');
    });

    it('should handle get_variables tool', async () => {
      const mockVariables = [
        { name: 'x', value: '10', type: 'int', variablesReference: 0, expandable: false },
        { name: 'y', value: '20', type: 'int', variablesReference: 0, expandable: false }
      ];
      
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

    it('should validate required scope parameter for get_variables', async () => {
      await expect(callToolHandler({
        method: 'tools/call',
        params: {
          name: 'get_variables',
          arguments: {
            sessionId: 'test-session'
            // Missing scope
          }
        }
      })).rejects.toThrow('scope (variablesReference) parameter is required');
    });

    it('should handle unknown tool error', async () => {
      await expect(callToolHandler({
        method: 'tools/call',
        params: {
          name: 'unknown_tool',
          arguments: {}
        }
      })).rejects.toThrow('Unknown tool: unknown_tool');
    });

    it('should handle tool execution errors', async () => {
      mockSessionManager.createSession.mockRejectedValue(new Error('Session creation failed'));
      
      await expect(callToolHandler({
        method: 'tools/call',
        params: {
          name: 'create_debug_session',
          arguments: {
            language: 'python'
          }
        }
      })).rejects.toThrow('Failed to create debug session: Session creation failed');
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to create debug session',
        expect.objectContaining({ error: 'Session creation failed' })
      );
    });

    it('should validate language parameter', async () => {
      await expect(callToolHandler({
        method: 'tools/call',
        params: {
          name: 'create_debug_session',
          arguments: {
            language: 'java' // Invalid language
          }
        }
      })).rejects.toThrow("language parameter must be 'python'");
    });
  });
});
