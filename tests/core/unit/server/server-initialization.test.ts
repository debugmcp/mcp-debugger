/**
 * Server initialization and constructor tests
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { DebugMcpServer } from '../../../../src/server.js';
import { SessionManager } from '../../../../src/session/session-manager.js';
import { createProductionDependencies } from '../../../../src/container/dependencies.js';
import path from 'path';
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

describe('Server Initialization Tests', () => {
  let debugServer: DebugMcpServer;
  let mockServer: any;
  let mockSessionManager: any;
  let mockStdioTransport: any;
  let mockDependencies: any;

  beforeEach(() => {
    mockDependencies = createMockDependencies();
    vi.mocked(createProductionDependencies).mockReturnValue(mockDependencies);
    
    mockServer = createMockServer();
    vi.mocked(Server).mockImplementation(() => mockServer as any);
    
    mockStdioTransport = createMockStdioTransport();
    vi.mocked(StdioServerTransport).mockImplementation(() => mockStdioTransport as any);
    
    mockSessionManager = createMockSessionManager(mockDependencies.adapterRegistry);
    vi.mocked(SessionManager).mockImplementation(() => mockSessionManager as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Constructor and Initialization', () => {
    it('should initialize server with correct configuration', () => {
      debugServer = new DebugMcpServer({ logLevel: 'debug' });
      
      expect(Server).toHaveBeenCalledWith(
        { name: 'debug-mcp-server', version: '0.1.0' },
        { capabilities: { tools: {} } }
      );
      
      expect(createProductionDependencies).toHaveBeenCalledWith({
        logLevel: 'debug',
        logFile: undefined,
        sessionLogDirBase: undefined
      });
    });

    it('should initialize with log file configuration', () => {
      const logFile = '/var/log/debug-mcp.log';
      debugServer = new DebugMcpServer({ 
        logLevel: 'info',
        logFile: logFile
      });
      
      // The expected sessionLogDirBase should be platform-specific
      const expectedSessionLogDirBase = path.resolve(path.dirname(logFile), 'sessions');
      
      expect(createProductionDependencies).toHaveBeenCalledWith({
        logLevel: 'info',
        logFile: logFile,
        sessionLogDirBase: expectedSessionLogDirBase
      });
    });

    it('should handle dependency creation errors', () => {
      vi.mocked(createProductionDependencies).mockImplementation(() => {
        throw new Error('Failed to create dependencies');
      });
      
      expect(() => new DebugMcpServer()).toThrow('Failed to create dependencies');
    });

    it('should register tool handlers', () => {
      debugServer = new DebugMcpServer();
      
      // Should register ListTools and CallTool handlers
      expect(mockServer.setRequestHandler).toHaveBeenCalledTimes(2);
    });

    it('should set error handler', () => {
      debugServer = new DebugMcpServer();
      
      expect(mockServer.onerror).toBeDefined();
      
      // Test error handler
      const testError = new Error('Test error');
      if (mockServer.onerror) {
        mockServer.onerror(testError);
      }
      
      expect(mockDependencies.logger.error).toHaveBeenCalledWith('Server error', { error: testError });
    });
  });

  describe('Tool Handler Registration', () => {
    it('should handle tools/list request', async () => {
      debugServer = new DebugMcpServer();
      const { listToolsHandler } = getToolHandlers(mockServer);
      
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
      expect(toolNames).toContain('pause_execution');
      expect(toolNames).toContain('get_variables');
      expect(toolNames).toContain('get_stack_trace');
      expect(toolNames).toContain('get_scopes');
      expect(toolNames).toContain('evaluate_expression');
      expect(toolNames).toContain('get_source_context');
    });

    it('should handle unknown tool error', async () => {
      debugServer = new DebugMcpServer();
      const { callToolHandler } = getToolHandlers(mockServer);
      
      await expect(callToolHandler({
        method: 'tools/call',
        params: {
          name: 'unknown_tool',
          arguments: {}
        }
      })).rejects.toThrow('Unknown tool: unknown_tool');
    });

    it('should handle tool execution errors', async () => {
      debugServer = new DebugMcpServer();
      const { callToolHandler } = getToolHandlers(mockServer);
      
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
  });
});
