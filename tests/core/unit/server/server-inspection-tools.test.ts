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
import { OutputRingBuffer } from '../../../../src/session/output-buffer.js';

// Mock dependencies
vi.mock('@modelcontextprotocol/sdk/server/index.js');
vi.mock('@modelcontextprotocol/sdk/server/stdio.js');
vi.mock('../../../../src/session/session-manager.js');
vi.mock('../../../../src/container/dependencies.js');

describe('Server Inspection Tools Tests', () => {
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
    vi.mocked(Server).mockImplementation(function() { return mockServer as any; });

    const mockStdioTransport = createMockStdioTransport();
    vi.mocked(StdioServerTransport).mockImplementation(function() { return mockStdioTransport as any; });

    mockSessionManager = createMockSessionManager(mockDependencies.adapterRegistry);
    vi.mocked(SessionManager).mockImplementation(function() { return mockSessionManager as any; });

    new DebugMcpServer();
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
      
      expect(mockSessionManager.getVariables).toHaveBeenCalledWith('test-session', 100, undefined);
      
      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
      expect(content.variables).toHaveLength(2);
      expect(content.count).toBe(2);
      expect(content.variablesReference).toBe(100);
    });

    it('should validate required scope parameter', async () => {
      // Test for proper MCP parameter validation
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

      // Session-lifecycle failures must surface as structured results, not thrown protocol errors
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
      mockSessionManager.getStackTraceDetailed.mockResolvedValue({
        frames: mockStackFrames, totalFrameCount: 1, hiddenFrameCount: 0, allFramesInternal: false
      });

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
      // No frames hidden -> no annotation noise (issue #346)
      expect(content.hiddenFrames).toBeUndefined();
      expect(content.note).toBeUndefined();
    });

    it('echoes the inspected thread and frameless-thread note (issue #553)', async () => {
      const mockSession = {
        lastStop: { reason: 'pause', threadId: 1 },
        failureDiagnostics: { proxyLogPath: '/logs/proxy-test-session.log' },
        proxyManager: {
          getCurrentThreadId: vi.fn().mockReturnValue(1),
          setCurrentThreadId: vi.fn()
        }
      };
      mockSessionManager.getSession.mockReturnValue(mockSession);
      mockSessionManager.getStackTraceDetailed.mockResolvedValue({
        frames: [],
        totalFrameCount: 0,
        hiddenFrameCount: 0,
        allFramesInternal: false,
        threadId: 4,
        note: 'Thread 4 (Signal Dispatcher) reported no stack frames; thread 2 (Finalizer) has frames.'
      });

      const result = await callToolHandler({
        method: 'tools/call',
        params: {
          name: 'get_stack_trace',
          arguments: { sessionId: 'test-session', threadId: 4 }
        }
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
      expect(content.threadId).toBe(4);
      expect(content.lastStop.threadId).toBe(1);
      expect(content.note).toMatch(/Signal Dispatcher/);
      expect(content.diagnostics).toEqual({ proxyLogPath: '/logs/proxy-test-session.log' });
      expect(mockSessionManager.getStackTraceDetailed).toHaveBeenCalledWith(
        'test-session', 4, false
      );
      expect(mockSession.proxyManager.setCurrentThreadId).not.toHaveBeenCalled();
    });

    it('annotates hidden internal frames with a count and how to reveal them (issue #346)', async () => {
      const mockSession = {
        proxyManager: { getCurrentThreadId: vi.fn().mockReturnValue(1) }
      };
      mockSessionManager.getSession.mockReturnValue(mockSession);
      mockSessionManager.getStackTraceDetailed.mockResolvedValue({
        frames: [{ id: 7, name: 'handler', file: 'app.go', line: 12 }],
        totalFrameCount: 4, hiddenFrameCount: 3, allFramesInternal: false
      });

      const result = await callToolHandler({
        method: 'tools/call',
        params: { name: 'get_stack_trace', arguments: { sessionId: 'test-session' } }
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
      expect(content.hiddenFrames).toBe(3);
      expect(content.note).toContain('includeInternals: true');
    });

    it('notes frames whose file is a source-map label rather than an openable path (issue #655)', async () => {
      const mockSession = {
        proxyManager: { getCurrentThreadId: vi.fn().mockReturnValue(1) }
      };
      mockSessionManager.getSession.mockReturnValue(mockSession);
      mockSessionManager.getStackTraceDetailed.mockResolvedValue({
        frames: [
          { id: 1, name: 'jsonResult', file: '/app/dist/tool-result.js', line: 13 },
          { id: 2, name: 'handler', file: '../src/handlers/tools.ts', line: 89, unresolvedSource: true }
        ],
        totalFrameCount: 2, hiddenFrameCount: 0, allFramesInternal: false
      });

      const result = await callToolHandler({
        method: 'tools/call',
        params: { name: 'get_stack_trace', arguments: { sessionId: 'test-session' } }
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
      expect(content.hiddenFrames).toBeUndefined();
      expect(content.stackFrames[1].unresolvedSource).toBe(true);
      expect(content.note).toContain('1 frame(s) are source-mapped to files not present on this host');
      expect(content.note).toContain('adapterConfig.sourceMaps: false');
    });

    it('explains the kept-first-frame fallback when every frame is internal (issue #346)', async () => {
      const mockSession = {
        proxyManager: { getCurrentThreadId: vi.fn().mockReturnValue(1) }
      };
      mockSessionManager.getSession.mockReturnValue(mockSession);
      mockSessionManager.getStackTraceDetailed.mockResolvedValue({
        frames: [{ id: 1, name: 'runtime.gopark', file: '/usr/local/go/src/runtime/proc.go', line: 402 }],
        totalFrameCount: 5, hiddenFrameCount: 4, allFramesInternal: true
      });

      const result = await callToolHandler({
        method: 'tools/call',
        params: { name: 'get_stack_trace', arguments: { sessionId: 'test-session' } }
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
      expect(content.stackFrames).toHaveLength(1);
      expect(content.hiddenFrames).toBe(4);
      expect(content.note).toContain('internal/runtime frames');
      expect(content.note).toContain('includeInternals: true');
    });

    it('should handle missing session', async () => {
      mockSessionManager.getSession.mockReturnValue(null);

      // Session-lifecycle failures must surface as structured results, not thrown protocol errors
      const result = await callToolHandler({
        method: 'tools/call',
        params: {
          name: 'get_stack_trace',
          arguments: { sessionId: 'non-existent' }
        }
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(false);
      expect(content.error).toContain('Session not found: non-existent');
    });

    it('should handle missing proxy manager', async () => {
      const mockSession = {
        proxyManager: null,
        failureDiagnostics: { proxyLogPath: '/logs/proxy-test-session.log' }
      };
      mockSessionManager.getSession.mockReturnValue(mockSession);
      
      const result = await callToolHandler({
        method: 'tools/call',
        params: {
          name: 'get_stack_trace',
          arguments: { sessionId: 'test-session' }
        }
      });
      
      // The server returns a structured failure result (success: false) with an error message
      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(false);
      expect(content.error).toContain('no active proxy for session test-session');
      expect(content.diagnostics).toEqual({ proxyLogPath: '/logs/proxy-test-session.log' });
    });

    it('should handle missing thread ID', async () => {
      const mockSession = {
        failureDiagnostics: { proxyLogPath: '/logs/proxy-test-session.log' },
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
      
      // The server returns a structured failure result (success: false) with an error message
      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(false);
      expect(content.error).toContain('no active proxy for session test-session');
    });

    it('should surface SessionManager errors as a truthful tool-level failure', async () => {
      const mockSession = {
        failureDiagnostics: { proxyLogPath: '/logs/proxy-test-session.log' },
        proxyManager: {
          getCurrentThreadId: vi.fn().mockReturnValue(1)
        }
      };

      mockSessionManager.getSession.mockReturnValue(mockSession);
      mockSessionManager.getStackTraceDetailed.mockRejectedValue(new Error('Stack trace failed'));

      // DAP-level failures must produce success:false with the real error,
      // never an empty-but-successful stack trace (issue #124).
      const result = await callToolHandler({
        method: 'tools/call',
        params: {
          name: 'get_stack_trace',
          arguments: { sessionId: 'test-session' }
        }
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(false);
      expect(content.error).toContain('Stack trace failed');
      expect(content.diagnostics).toEqual({ proxyLogPath: '/logs/proxy-test-session.log' });
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

      // The server returns a structured failure result (success: false) with an error message;
      // the catch above normalizes a thrown error into the same shape.
      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(false);
      expect(content.error).toContain('Session not found: test-session');
    });
  });

  describe('get_output', () => {
    function makeBuffer(lines: string[]): OutputRingBuffer {
      const buffer = new OutputRingBuffer();
      for (const line of lines) {
        buffer.push('stdout', line);
      }
      return buffer;
    }

    async function callGetOutput(args: Record<string, unknown>) {
      const result = await callToolHandler({
        method: 'tools/call',
        params: { name: 'get_output', arguments: args }
      });
      return JSON.parse(result.content[0].text);
    }

    it('returns buffered entries with cursor metadata', async () => {
      mockSessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: 'ACTIVE',
        outputBuffer: makeBuffer(['one\n', 'two\n'])
      });

      const content = await callGetOutput({ sessionId: 'test-session' });
      expect(content.success).toBe(true);
      expect(content.entries.map((e: { output: string }) => e.output)).toEqual(['one\n', 'two\n']);
      expect(content.nextSince).toBe(2);
      expect(content.hasMore).toBe(false);
      expect(content.dropped).toBe(0);
    });

    it('works on TERMINATED sessions (post-exit output is the primary use case)', async () => {
      mockSessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: 'TERMINATED',
        outputBuffer: makeBuffer(['final result\n'])
      });

      const content = await callGetOutput({ sessionId: 'test-session' });
      expect(content.success).toBe(true);
      expect(content.entries).toHaveLength(1);
    });

    it('returns success:false for an unknown session', async () => {
      mockSessionManager.getSession.mockReturnValue(undefined);

      const content = await callGetOutput({ sessionId: 'nope' });
      expect(content.success).toBe(false);
      expect(content.error).toContain('Session not found: nope');
    });

    it('honours the since cursor and clamps limit', async () => {
      mockSessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: 'ACTIVE',
        outputBuffer: makeBuffer(['a\n', 'b\n', 'c\n'])
      });

      const incremental = await callGetOutput({ sessionId: 'test-session', since: 2 });
      expect(incremental.entries.map((e: { output: string }) => e.output)).toEqual(['c\n']);
      expect(incremental.nextSince).toBe(3);

      // limit below 1 clamps to 1; negative since clamps to 0
      const clamped = await callGetOutput({ sessionId: 'test-session', since: -5, limit: 0 });
      expect(clamped.entries).toHaveLength(1);
      expect(clamped.entries[0].output).toBe('a\n');
      expect(clamped.hasMore).toBe(true);
    });

    it('returns an empty success for sessions that never launched (no buffer)', async () => {
      mockSessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: 'CREATED'
      });

      const content = await callGetOutput({ sessionId: 'test-session', since: 7 });
      expect(content.success).toBe(true);
      expect(content.entries).toEqual([]);
      expect(content.nextSince).toBe(7);
      expect(content.hasMore).toBe(false);
      expect(content.dropped).toBe(0);
    });
  });
});
