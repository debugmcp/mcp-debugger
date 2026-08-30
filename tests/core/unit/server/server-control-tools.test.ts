/**
 * Server debugging control tools tests
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { DebugMcpServer } from '../../../../src/server.js';
import { SessionManager } from '../../../../src/session/session-manager.js';
import { Breakpoint, SessionLifecycleState } from '@debugmcp/shared';
import { ErrorMessages } from '../../../../src/utils/error-messages.js';
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
  let mockServer: any;
  let mockSessionManager: any;
  let mockDependencies: any;
  let callToolHandler: any;

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
    callToolHandler = getToolHandlers(mockServer).callToolHandler;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('set_breakpoint', () => {
    it('should set breakpoint successfully', async () => {
      const mockBreakpoint: Breakpoint = {
        id: 'bp-1',
        file: '/path/to/test.py',
        line: 10,
        verified: true
      };
      
      // Mock session validation
      mockSessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: 'ACTIVE' // Not terminated
      });
      mockSessionManager.setBreakpoint.mockResolvedValue({ breakpoint: mockBreakpoint });
      
      const result = await callToolHandler({
        method: 'tools/call',
        params: {
          name: 'set_breakpoint',
          arguments: {
            sessionId: 'test-session',
            file: '/path/to/test.py',
            line: 10
          }
        }
      });
      
      expect(mockSessionManager.setBreakpoint).toHaveBeenCalledWith(
        'test-session',
        expect.objectContaining({
          file: expect.stringContaining('/path/to/test.py'),
          line: 10
        })
      );
      
      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
      expect(content.breakpointId).toBe('bp-1');
      expect(content.message).toContain('Breakpoint set at /path/to/test.py:10');
    });

    it('should handle conditional breakpoints', async () => {
      const mockBreakpoint: Breakpoint = {
        id: 'bp-2',
        file: '/path/to/test.py',
        line: 20,
        condition: 'x > 10',
        verified: true
      };
      
      // Mock session validation
      mockSessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: 'ACTIVE' // Not terminated
      });
      mockSessionManager.setBreakpoint.mockResolvedValue({ breakpoint: mockBreakpoint });
      
      const result = await callToolHandler({
        method: 'tools/call',
        params: {
          name: 'set_breakpoint',
          arguments: {
            sessionId: 'test-session',
            file: '/path/to/test.py',
            line: 20,
            condition: 'x > 10'
          }
        }
      });
      
      expect(mockSessionManager.setBreakpoint).toHaveBeenCalledWith(
        'test-session',
        expect.objectContaining({
          file: expect.stringContaining('/path/to/test.py'),
          line: 20,
          condition: 'x > 10'
        })
      );
    });

    it('should pass suspendPolicy to SessionManager', async () => {
      const mockBreakpoint = {
        id: 'bp-3',
        file: '/path/to/test.py',
        line: 30,
        suspendPolicy: 'thread' as const,
        verified: true
      };

      mockSessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: 'ACTIVE'
      });
      mockSessionManager.setBreakpoint.mockResolvedValue({ breakpoint: mockBreakpoint });

      await callToolHandler({
        method: 'tools/call',
        params: {
          name: 'set_breakpoint',
          arguments: {
            sessionId: 'test-session',
            file: '/path/to/test.py',
            line: 30,
            suspendPolicy: 'thread'
          }
        }
      });

      expect(mockSessionManager.setBreakpoint).toHaveBeenCalledWith(
        'test-session',
        expect.objectContaining({
          file: expect.stringContaining('/path/to/test.py'),
          line: 30,
          suspendPolicy: 'thread'
        })
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
            file: '/path/to/test.py',
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
            scriptPath: '/path/to/test.py',
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
        expect.stringContaining('/path/to/test.py'),
        ['--debug'],
        { stopOnEntry: true, justMyCode: false },
        undefined,
        undefined,
        undefined
      );

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
      expect(content.state).toBe('running');
    });

    it('should pass breakOnExceptions through to the session manager', async () => {
      mockSessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: 'ACTIVE'
      });
      mockSessionManager.startDebugging.mockResolvedValue({
        success: true,
        state: 'running',
        data: { message: 'Debugging started' }
      });

      await callToolHandler({
        method: 'tools/call',
        params: {
          name: 'start_debugging',
          arguments: {
            sessionId: 'test-session',
            scriptPath: '/path/to/test.py',
            breakOnExceptions: 'uncaught'
          }
        }
      });

      expect(mockSessionManager.startDebugging).toHaveBeenCalledWith(
        'test-session',
        expect.stringContaining('/path/to/test.py'),
        undefined,
        undefined,
        undefined,
        undefined,
        'uncaught'
      );
    });

    it('should reject a non-object adapterLaunchConfig', async () => {
      mockSessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: 'ACTIVE'
      });

      await expect(callToolHandler({
        method: 'tools/call',
        params: {
          name: 'start_debugging',
          arguments: {
            sessionId: 'test-session',
            scriptPath: '/path/to/test.py',
            adapterLaunchConfig: [1, 2]
          }
        }
      })).rejects.toThrow(/adapterLaunchConfig must be an object/);

      expect(mockSessionManager.startDebugging).not.toHaveBeenCalled();
    });

    it('should reject an invalid breakOnExceptions value', async () => {
      mockSessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: 'ACTIVE'
      });

      await expect(callToolHandler({
        method: 'tools/call',
        params: {
          name: 'start_debugging',
          arguments: {
            sessionId: 'test-session',
            scriptPath: '/path/to/test.py',
            breakOnExceptions: 'sometimes'
          }
        }
      })).rejects.toThrow(/breakOnExceptions must be one of/);

      expect(mockSessionManager.startDebugging).not.toHaveBeenCalled();
    });

    it('honors breakOnExceptions nested inside dapLaunchArgs with a warning (#305)', async () => {
      mockSessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: 'ACTIVE'
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
            scriptPath: '/path/to/test.py',
            dapLaunchArgs: { stopOnEntry: false, breakOnExceptions: 'none' }
          }
        }
      });

      // The nested value is honored and stripped from the forwarded launch args.
      expect(mockSessionManager.startDebugging).toHaveBeenCalledWith(
        'test-session',
        expect.stringContaining('/path/to/test.py'),
        undefined,
        { stopOnEntry: false },
        undefined,
        undefined,
        'none'
      );
      const content = JSON.parse(result.content[0].text);
      expect(content.warning).toMatch(/breakOnExceptions is a top-level start_debugging parameter/);
      expect(content.warning).toContain("'none'");
    });

    it('prefers the top-level breakOnExceptions when both placements are given', async () => {
      mockSessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: 'ACTIVE'
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
            scriptPath: '/path/to/test.py',
            breakOnExceptions: 'all',
            dapLaunchArgs: { breakOnExceptions: 'none' }
          }
        }
      });

      expect(mockSessionManager.startDebugging).toHaveBeenCalledWith(
        'test-session',
        expect.stringContaining('/path/to/test.py'),
        undefined,
        {},
        undefined,
        undefined,
        'all'
      );
      const content = JSON.parse(result.content[0].text);
      expect(content.warning).toMatch(/top-level value wins/);
      expect(content.warning).toContain("'all'");
      expect(content.warning).toContain("'none'");
    });

    it('rejects an invalid nested breakOnExceptions like an invalid top-level one', async () => {
      mockSessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: 'ACTIVE'
      });

      await expect(callToolHandler({
        method: 'tools/call',
        params: {
          name: 'start_debugging',
          arguments: {
            sessionId: 'test-session',
            scriptPath: '/path/to/test.py',
            dapLaunchArgs: { breakOnExceptions: 'sometimes' }
          }
        }
      })).rejects.toThrow(/breakOnExceptions must be one of/);

      expect(mockSessionManager.startDebugging).not.toHaveBeenCalled();
    });

    it('strips other misplaced top-level keys from dapLaunchArgs with a warning', async () => {
      mockSessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: 'ACTIVE'
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
            scriptPath: '/path/to/test.py',
            dapLaunchArgs: { stopOnEntry: true, dryRunSpawn: true, scriptPath: '/elsewhere.py' }
          }
        }
      });

      expect(mockSessionManager.startDebugging).toHaveBeenCalledWith(
        'test-session',
        expect.stringContaining('/path/to/test.py'),
        undefined,
        { stopOnEntry: true },
        undefined,
        undefined,
        undefined
      );
      const content = JSON.parse(result.content[0].text);
      expect(content.warning).toMatch(/'dryRunSpawn' is a top-level start_debugging parameter/);
      expect(content.warning).toMatch(/'scriptPath' is a top-level start_debugging parameter/);
    });

    it('passes legitimate DAP launch keys through untouched with no warning', async () => {
      mockSessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: 'ACTIVE'
      });
      mockSessionManager.startDebugging.mockResolvedValue({
        success: true,
        state: 'running',
        data: { message: 'Debugging started' }
      });

      const dapLaunchArgs = {
        stopOnEntry: true,
        justMyCode: false,
        program: '/target/debug/app',
        cwd: '/work',
        args: ['--flag'],
        env: { RUST_LOG: 'debug' }
      };
      const result = await callToolHandler({
        method: 'tools/call',
        params: {
          name: 'start_debugging',
          arguments: {
            sessionId: 'test-session',
            scriptPath: '/path/to/test.py',
            dapLaunchArgs
          }
        }
      });

      expect(mockSessionManager.startDebugging).toHaveBeenCalledWith(
        'test-session',
        expect.stringContaining('/path/to/test.py'),
        undefined,
        dapLaunchArgs,
        undefined,
        undefined,
        undefined
      );
      const content = JSON.parse(result.content[0].text);
      expect(content.warning).toBeUndefined();
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
        data: { dryRun: true, command: 'python /path/to/test.py' }
      });
      
      const result = await callToolHandler({
        method: 'tools/call',
        params: {
          name: 'start_debugging',
          arguments: {
            sessionId: 'test-session',
            scriptPath: '/path/to/test.py',
            dryRunSpawn: true
          }
        }
      });
      
      expect(mockSessionManager.startDebugging).toHaveBeenCalledWith(
        'test-session',
        expect.stringContaining('/path/to/test.py'),
        undefined,
        undefined,
        true,
        undefined,
        undefined
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
            scriptPath: '/path/to/test.py'
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
      ['step_over', 'stepOver', 'Stepped over'],
      ['step_into', 'stepInto', 'Stepped into'],
      ['step_out', 'stepOut', 'Stepped out']
    ])('keeps the %s wording for an ordinary stop that carries a message (issue #574)', async (toolName, methodName, expectedMessage) => {
      // The other direction of the state gate. The controller ALWAYS sets
      // data.message ('Step completed.'), so surfacing it unconditionally
      // would have replaced "Stepped over" on every successful step; only a
      // terminal state may override the wording.
      mockSessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: 'ACTIVE'
      });
      mockSessionManager[methodName].mockResolvedValue({
        success: true,
        state: 'paused',
        data: {
          message: 'Step completed.',
          location: { file: '/app/main.py', line: 12, column: 1 }
        }
      });

      const result = await callToolHandler({
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: { sessionId: 'test-session' }
        }
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
      expect(content.message).toBe(expectedMessage);
      expect(content.location).toEqual({ file: '/app/main.py', line: 12, column: 1 });
      expect(content.pending).toBeUndefined();
    });

    it.each([
      ['step_over', 'stepOver'],
      ['step_into', 'stepInto'],
      ['step_out', 'stepOut']
    ])('surfaces the controller message when %s ended the session (issue #574)', async (toolName, methodName) => {
      // A step the debuggee did not survive settles with 'Step completed as
      // session terminated.' and no `pending` marker. The hard-coded
      // "Stepped over" used to overwrite it, leaving `state` the only clue.
      mockSessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: 'ACTIVE'
      });
      mockSessionManager[methodName].mockResolvedValue({
        success: true,
        state: 'stopped',
        data: { message: 'Step completed as session terminated.' }
      });

      const result = await callToolHandler({
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: { sessionId: 'test-session' }
        }
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
      expect(content.message).toBe('Step completed as session terminated.');
      expect(content.pending).toBeUndefined();
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
    ])('should surface a pending %s truthfully while the program is still running', async (toolName, methodName) => {
      // Mock session validation
      mockSessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: 'ACTIVE' // Not terminated
      });
      // A step that outlives the grace window resolves with a pending marker
      const stepResult = {
        success: true,
        state: 'running',
        data: { message: ErrorMessages.stepStillRunning(5), pending: true }
      };
      mockSessionManager[methodName].mockResolvedValue(stepResult);

      const result = await callToolHandler({
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: { sessionId: 'test-session' }
        }
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
      expect(content.state).toBe('running');
      expect(content.pending).toBe(true);
      // The truthful still-running message must replace the default "Stepped X"
      expect(content.message).toBe(ErrorMessages.stepStillRunning(5));
      // No stop yet, so there is no location to report
      expect(content.location).toBeUndefined();
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
    it('should pause execution successfully', async () => {
      mockSessionManager.getSession.mockReturnValue({
        id: 'test-session',
        state: 'running',
        sessionLifecycle: 'ACTIVE'
      });
      mockSessionManager.pause.mockResolvedValue({
        success: true,
        state: 'paused'
      });

      const result = await callToolHandler({
        method: 'tools/call',
        params: {
          name: 'pause_execution',
          arguments: { sessionId: 'test-session' }
        }
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
      expect(mockSessionManager.pause).toHaveBeenCalledWith('test-session', undefined);
    });

    it('should pause a specific thread when threadId is provided', async () => {
      mockSessionManager.getSession.mockReturnValue({
        id: 'test-session',
        state: 'running',
        sessionLifecycle: 'ACTIVE'
      });
      mockSessionManager.pause.mockResolvedValue({
        success: true,
        state: 'paused'
      });

      const result = await callToolHandler({
        method: 'tools/call',
        params: {
          name: 'pause_execution',
          arguments: { sessionId: 'test-session', threadId: 42 }
        }
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
      expect(mockSessionManager.pause).toHaveBeenCalledWith('test-session', 42);
    });

    it('should handle pause on non-existent session', async () => {
      mockSessionManager.getSession.mockReturnValue(null);

      const result = await callToolHandler({
        method: 'tools/call',
        params: {
          name: 'pause_execution',
          arguments: { sessionId: 'non-existent' }
        }
      });

      // Session-lifecycle failures surface as structured results, not protocol errors
      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(false);
      expect(content.error).toContain('Session not found: non-existent');
    });

    it('should handle pause on terminated session', async () => {
      mockSessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: SessionLifecycleState.TERMINATED
      });

      const result = await callToolHandler({
        method: 'tools/call',
        params: {
          name: 'pause_execution',
          arguments: { sessionId: 'test-session' }
        }
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(false);
      expect(content.error).toContain('Session is terminated: test-session');
    });
  });

  describe('list_threads', () => {
    it('should list threads successfully', async () => {
      mockSessionManager.getSession.mockReturnValue({
        id: 'test-session',
        state: 'paused',
        sessionLifecycle: 'ACTIVE'
      });
      mockSessionManager.listThreads.mockResolvedValue([
        { id: 1, name: 'main' },
        { id: 2, name: 'AWT-EventQueue-0' },
      ]);

      const result = await callToolHandler({
        method: 'tools/call',
        params: {
          name: 'list_threads',
          arguments: { sessionId: 'test-session' }
        }
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
      expect(content.threads).toHaveLength(2);
      expect(content.threads[0]).toEqual({ id: 1, name: 'main' });
      expect(content.threads[1]).toEqual({ id: 2, name: 'AWT-EventQueue-0' });
      expect(mockSessionManager.listThreads).toHaveBeenCalledWith('test-session');
    });

    it('should handle list_threads on non-existent session', async () => {
      mockSessionManager.getSession.mockReturnValue(null);

      const result = await callToolHandler({
        method: 'tools/call',
        params: {
          name: 'list_threads',
          arguments: { sessionId: 'test-session' }
        }
      });

      // Session-lifecycle failures surface as structured results, not protocol errors
      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(false);
      expect(content.error).toContain('Session not found: test-session');
    });

    it('should handle list_threads on terminated session', async () => {
      mockSessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: SessionLifecycleState.TERMINATED
      });

      const result = await callToolHandler({
        method: 'tools/call',
        params: {
          name: 'list_threads',
          arguments: { sessionId: 'test-session' }
        }
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(false);
      expect(content.error).toContain('Session is terminated: test-session');
    });

    it('should reject list_threads with missing sessionId', async () => {
      await expect(callToolHandler({
        method: 'tools/call',
        params: {
          name: 'list_threads',
          arguments: {}
        }
      })).rejects.toThrow('Missing required parameter: sessionId');
    });
  });
});
