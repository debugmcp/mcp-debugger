/**
 * Server initialization and constructor tests
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { Server } from '@modelcontextprotocol/server';
import { DebugMcpServer } from '../../../../src/server.js';
import { TOOL_NAMES } from '../../../../src/server/tool-schemas.js';
import { SessionManager } from '../../../../src/session/session-manager.js';
import { createProductionDependencies, type Dependencies } from '../../../../src/container/dependencies.js';
import path from 'path';
import {
  createMockDependencies,
  createMockServer,
  createMockSessionManager,
  createMockStdioTransport,
  createDebugServerWithFacade,
  getToolHandlers,
  type MockServer,
  type MockSessionManager
} from './server-test-helpers.js';

// Mock dependencies
vi.mock('@modelcontextprotocol/server', async () =>
  (await import('../../../test-utils/mocks/sdk-server-module.js')).sdkServerModuleMock());
vi.mock('@modelcontextprotocol/server/stdio');
vi.mock('../../../../src/session/session-manager.js');
vi.mock('../../../../src/container/dependencies.js');
// serverInfo.version is the real release version (issue #1054), not a literal.
vi.mock('../../../../src/cli/version.js', () => ({ getVersion: () => '1.2.3-test' }));

describe('Server Initialization Tests', () => {
  let debugServer: DebugMcpServer;
  let mockServer: MockServer;
  let mockSessionManager: MockSessionManager;
  let mockStdioTransport: ReturnType<typeof createMockStdioTransport>;
  let mockDependencies: Dependencies;

  beforeEach(() => {
    mockDependencies = createMockDependencies();
    vi.mocked(createProductionDependencies).mockReturnValue(mockDependencies);
    
    mockServer = createMockServer();
    vi.mocked(Server).mockImplementation(function() { return mockServer as any; });

    mockStdioTransport = createMockStdioTransport();
    vi.mocked(StdioServerTransport).mockImplementation(function() { return mockStdioTransport as any; });

    mockSessionManager = createMockSessionManager(mockDependencies.adapterRegistry);
    vi.mocked(SessionManager).mockImplementation(function() { return mockSessionManager as any; });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  describe('Constructor and Initialization', () => {
    it('builds the core without an SDK Server of its own (issue #1025, step 2)', () => {
      debugServer = new DebugMcpServer({ logLevel: 'debug' });

      // The facade (createProtocolServer) constructs the Server per connection
      // or request; the core carries what every facade advertises.
      expect(Server).not.toHaveBeenCalled();
      expect(debugServer.instructions).toContain('mcp-debugger drives real step-through debuggers');
      expect(createProductionDependencies).toHaveBeenCalledWith({
        logLevel: 'debug',
        logFile: undefined,
        sessionLogDirBase: undefined
      });
    });

    // Every setting the instructions depend on reaches the builder (issue #1331):
    // each one changes a rule an agent acts on before its first call.
    it('builds the instructions from the settings in the environment', () => {
      const defaults = new DebugMcpServer({ logLevel: 'debug' }).instructions;
      expect(defaults).toContain('file and scriptPath must be ABSOLUTE paths');
      expect(defaults).toContain('carries snapshot:');
      expect(defaults).toContain('(redacted and capped)');

      vi.stubEnv('DEBUG_MCP_NO_SNAPSHOT', '1');
      vi.stubEnv('DEBUG_MCP_NO_REDACT', '1');
      vi.stubEnv('DEBUG_MCP_VARIABLE_ACCESS', 'explicit');
      vi.stubEnv('MCP_DEBUG_SESSION_IDLE_MS', '300000');
      vi.stubEnv('MCP_CONTAINER', 'true');
      vi.stubEnv('MCP_WORKSPACE_ROOT', '/workspace');
      const configured = new DebugMcpServer({ logLevel: 'debug' }).instructions;
      expect(configured).toContain('Stop snapshots are off on this server (DEBUG_MCP_NO_SNAPSHOT)');
      expect(configured).not.toContain('carries snapshot:');
      expect(configured).not.toMatch(/redact/i);
      expect(configured).toContain('DEBUG_MCP_VARIABLE_ACCESS=explicit');
      expect(configured).toContain('no tool call has named for 5 min');
      expect(configured).toContain('relative to the project root');
      expect(configured).not.toContain('ABSOLUTE');
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

    it('a facade over the core registers the tool, resource and prompt handlers', () => {
      debugServer = createDebugServerWithFacade();

      // ListTools + CallTool, ListResources/ReadResource/Subscribe/Unsubscribe (issue #218)
      // + ListResourceTemplates (empty; the resources capability must answer it, issue #1025),
      // plus ListPrompts/GetPrompt for the debugging-workflow prompt
      expect(mockServer.setRequestHandler).toHaveBeenCalledTimes(9);
    });

    it('a facade routes SDK errors to the core logger', () => {
      debugServer = createDebugServerWithFacade();
      
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
      debugServer = createDebugServerWithFacade();
      const { listToolsHandler } = getToolHandlers(mockServer);
      
      const result = await listToolsHandler({ method: 'tools/list', params: {} });
      
      expect(result.tools).toBeDefined();
      expect(result.tools.length).toBeGreaterThan(0);

      // Derived from the schema module, not hand-maintained: the list of
      // toContain() calls this replaces named 20 of the 28 advertised tools
      // and had stopped growing with them (issue #579).
      const toolNames = result.tools.map((t) => t.name);
      expect(toolNames).toEqual(expect.arrayContaining([...TOOL_NAMES]));
      expect(toolNames).toHaveLength(TOOL_NAMES.length);
    });

    it('should handle unknown tool error', async () => {
      debugServer = createDebugServerWithFacade();
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
      debugServer = createDebugServerWithFacade();
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
