/**
 * Server debugging control tools tests
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ErrorCode as McpErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { DebugMcpServer } from '../../../../src/server.js';
import { SessionManager } from '../../../../src/session/session-manager.js';
import { Breakpoint } from '@debugmcp/shared';
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

describe('Server Control Tools Tests', () => {
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

  describe('set_breakpoint', () => {
    it('should set breakpoint successfully', async () => {
      const mockBreakpoint: Breakpoint = {
        id: 'bp-1',
        file: 'test.py',
        line: 10,
        verified: true
      };
      
      // Mock session validation
      mockSessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: 'ACTIVE' // Not terminated
      });
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
        expect.stringContaining('test.py'),
        10,
        undefined
      );
      
      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
      expect(content.breakpointId).toBe('bp-1');
      expect(content.message).toContain('Breakpoint set at test.py:10');
    });

    it('should handle conditional breakpoints', async () => {
      const mockBreakpoint: Breakpoint = {
        id: 'bp-2',
        file: 'test.py',
        line: 20,
        condition: 'x > 10',
        verified: true
      };
      
      // Mock session validation
      mockSessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: 'ACTIVE' // Not terminated
      });
      mockSessionManager.setBreakpoint.mockResolvedValue(mockBreakpoint);
      
      const result = await callToolHandler({
        method: 'tools/call',
        params: {
          name: 'set_breakpoint',
          arguments: {
            sessionId: 'test-session',
            file: 'test.py',
            line: 20,
            condition: 'x > 10'
          }
        }
      });
      
      expect(mockSessionManager.setBreakpoint).toHaveBeenCalledWith(
        'test-session',
        expect.stringContaining('test.py'),
        20,
        'x > 10'
      );
    });

    it('should handle SessionManager errors', async () => {
      // Mock getSession to return null - session not found
      mockSessionManager.getSession.mockReturnValue(null);
      
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
      
      // The server now returns a success response with error message instead of throwing
      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(false);
      expect(content.error).toContain('Session not found: test-session');
    });
  });

  describe('start_debugging', () => {
    it('should start debugging successfully', async () => {
      // Mock session validation
      mockSessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: 'ACTIVE' // Not terminated
      });
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
            args: ['--debug'],
            dapLaunchArgs: {
              stopOnEntry: true,
              justMyCode: false
            }
          }
        }
      });
      
      expect(mockSessionManager.startDebugging).toHaveBeenCalledWith(
        'test-session',
        expect.stringContaining('test.py'),
        ['--debug'],
        { stopOnEntry: true, justMyCode: false },
        undefined
      );
      
      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
      expect(content.state).toBe('running');
    });

    it('should handle dry run mode', async () => {
      // Mock session validation
      mockSessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: 'ACTIVE' // Not terminated
      });
      mockSessionManager.startDebugging.mockResolvedValue({
        success: true,
        state: 'stopped',
        data: { dryRun: true, command: 'python test.py' }
      });
      
      const result = await callToolHandler({
        method: 'tools/call',
        params: {
          name: 'start_debugging',
          arguments: {
            sessionId: 'test-session',
            scriptPath: 'test.py',
            dryRunSpawn: true
          }
        }
      });
      
      expect(mockSessionManager.startDebugging).toHaveBeenCalledWith(
        'test-session',
        expect.stringContaining('test.py'),
        undefined,
        undefined,
        true
      );
      
      const content = JSON.parse(result.content[0].text);
      expect(content.data.dryRun).toBe(true);
    });

    it('should handle SessionManager errors', async () => {
      // Mock getSession to return null - session not found
      mockSessionManager.getSession.mockReturnValue(null);
      
      const result = await callToolHandler({
        method: 'tools/call',
        params: {
          name: 'start_debugging',
          arguments: {
            sessionId: 'test-session',
            scriptPath: 'test.py'
          }
        }
      });
      
      // The server now returns a success response with error message instead of throwing
      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(false);
      expect(content.error).toContain('Session not found: test-session');
      expect(content.state).toBe('stopped');
    });
  });

  describe('step operations', () => {
    it.each([
      ['step_over', 'stepOver', 'Stepped over'],
      ['step_into', 'stepInto', 'Stepped into'],
      ['step_out', 'stepOut', 'Stepped out']
    ])('should handle %s successfully', async (toolName, methodName, expectedMessage) => {
      // Mock session validation
      mockSessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: 'ACTIVE' // Not terminated
      });
      const stepResult = { success: true, state: 'stopped' };
      mockSessionManager[methodName].mockResolvedValue(stepResult);
      
      const result = await callToolHandler({
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: { sessionId: 'test-session' }
        }
      });
      
      expect(mockSessionManager[methodName]).toHaveBeenCalledWith('test-session');
      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
      expect(content.message).toBe(expectedMessage);
    });

    it.each([
      ['step_over', 'stepOver'],
      ['step_into', 'stepInto'],
      ['step_out', 'stepOut']
    ])('should handle %s errors', async (toolName, methodName) => {
      // Mock getSession to return null - session not found
      mockSessionManager.getSession.mockReturnValue(null);
      
      const result = await callToolHandler({
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: { sessionId: 'test-session' }
        }
      });
      
      // The server now returns a success response with error message instead of throwing
      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(false);
      expect(content.error).toContain('Session not found: test-session');
    });

    it.each([
      ['step_over', 'stepOver'],
      ['step_into', 'stepInto'],
      ['step_out', 'stepOut']
    ])('should handle %s failure responses', async (toolName, methodName) => {
      // Mock session validation
      mockSessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: 'ACTIVE' // Not terminated
      });
      const stepResult = { success: false, state: 'error', error: 'Not paused' };
      mockSessionManager[methodName].mockResolvedValue(stepResult);
      
      const result = await callToolHandler({
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: { sessionId: 'test-session' }
        }
      });
      
      // The server now returns a success response with error message
      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(false);
      expect(content.error).toBe('Not paused');
    });
  });

  describe('continue_execution', () => {
    it('should continue execution successfully', async () => {
      // Mock session validation
      mockSessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: 'ACTIVE' // Not terminated
      });
      mockSessionManager.continue.mockResolvedValue({
        success: true,
        state: 'running'
      });
      
      const result = await callToolHandler({
        method: 'tools/call',
        params: {
          name: 'continue_execution',
          arguments: { sessionId: 'test-session' }
        }
      });
      
      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
      expect(content.message).toBe('Continued execution');
    });

    it('should handle continue errors', async () => {
      // Mock getSession to return null - session not found
      mockSessionManager.getSession.mockReturnValue(null);
      
      const result = await callToolHandler({
        method: 'tools/call',
        params: {
          name: 'continue_execution',
          arguments: { sessionId: 'test-session' }
        }
      });
      
      // The server now returns a success response with error message instead of throwing
      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(false);
      expect(content.error).toContain('Session not found: test-session');
    });
  });

  describe('pause_execution', () => {
    it('should handle pause_execution as not implemented', async () => {
      await expect(callToolHandler({
        method: 'tools/call',
        params: {
          name: 'pause_execution',
          arguments: { sessionId: 'test-session' }
        }
      })).rejects.toThrow(McpError);
      
      try {
        await callToolHandler({
          method: 'tools/call',
          params: {
            name: 'pause_execution',
            arguments: { sessionId: 'test-session' }
          }
        });
      } catch (error) {
        expect(error).toBeInstanceOf(McpError);
        expect((error as McpError).code).toBe(McpErrorCode.InternalError);
        expect((error as McpError).message).toMatch(/not yet implemented/i);
      }
      
      expect(mockDependencies.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Pause requested for session: test-session')
      );
    });
  });
});
