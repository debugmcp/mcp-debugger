/**
 * Unit tests for SessionManager evaluateExpression functionality
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SessionManager } from '../../../src/session/session-manager.js';
import { SessionManagerConfig } from '../../../src/session/session-manager-core.js';
import { SessionState, DebugLanguage } from '../../../src/session/models.js';
import { createMockSessionManagerDependencies } from '../../test-utils/helpers/test-dependencies.js';
import { DebugProtocol } from '@vscode/debugprotocol';
import type { ProxyManager } from '../../../src/proxy/proxy-manager.js';

describe('SessionManager - evaluateExpression', () => {
  let sessionManager: SessionManager;
  let mockProxyManager: ProxyManager;
  let sessionId: string;
  let dependencies: ReturnType<typeof createMockSessionManagerDependencies>;

  beforeEach(async () => {
    dependencies = createMockSessionManagerDependencies();
    const config: SessionManagerConfig = {
      logDirBase: '/tmp/test-sessions'
    };
    
    sessionManager = new SessionManager(config, dependencies);
    
    // Create a test session
    const sessionInfo = await sessionManager.createSession({
      language: DebugLanguage.PYTHON,
      name: 'test-session',
      executablePath: 'python'
    });
    sessionId = sessionInfo.id;
    
    // Get the session and mock its proxy manager
    const session = sessionManager.getSession(sessionId);
    mockProxyManager = {
      isRunning: vi.fn().mockReturnValue(true),
      getCurrentThreadId: vi.fn().mockReturnValue(1),
      sendDapRequest: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      on: vi.fn(),
      once: vi.fn(),
      removeListener: vi.fn(),
      emit: vi.fn(),
      addListener: vi.fn(),
      off: vi.fn(),
      removeAllListeners: vi.fn(),
      setMaxListeners: vi.fn(),
      getMaxListeners: vi.fn(),
      listeners: vi.fn(),
      rawListeners: vi.fn(),
      listenerCount: vi.fn(),
      prependListener: vi.fn(),
      prependOnceListener: vi.fn(),
      eventNames: vi.fn()
    } as any;
    
    // Set the mock proxy manager
    (session as any).proxyManager = mockProxyManager;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Success cases', () => {
    it('should evaluate a simple variable', async () => {
      // Set session to paused state
      const session = sessionManager.getSession(sessionId);
      (session as any).state = SessionState.PAUSED;
      
      // Mock stack trace response for automatic frame detection
      const mockStackResponse: DebugProtocol.StackTraceResponse = {
        seq: 1,
        type: 'response',
        request_seq: 1,
        command: 'stackTrace',
        success: true,
        body: {
          stackFrames: [
            { id: 2, name: 'main', line: 7, column: 1, source: { path: 'test.py' } }
          ],
          totalFrames: 1
        }
      };
      
      // Mock evaluate response
      const mockEvalResponse: DebugProtocol.EvaluateResponse = {
        seq: 2,
        type: 'response',
        request_seq: 2,
        command: 'evaluate',
        success: true,
        body: {
          result: '42',
          type: 'int',
          variablesReference: 0
        }
      };
      
      (mockProxyManager.sendDapRequest as any)
        .mockResolvedValueOnce(mockStackResponse)  // First call for stack trace
        .mockResolvedValueOnce(mockEvalResponse);  // Second call for evaluate
      
      // Evaluate expression
      const result = await sessionManager.evaluateExpression(sessionId, 'x');
      
      // Verify result
      expect(result.success).toBe(true);
      expect(result.result).toBe('42');
      expect(result.type).toBe('int');
      expect(result.variablesReference).toBe(0);
      expect(result.error).toBeUndefined();
      
      // Verify stack trace was called first to get frame
      expect(mockProxyManager.sendDapRequest).toHaveBeenNthCalledWith(1, 'stackTrace', {
        threadId: 1,
        startFrame: 0,
        levels: 1
      });
      
      // Verify evaluate was called with the frame from stack trace
      expect(mockProxyManager.sendDapRequest).toHaveBeenNthCalledWith(2, 'evaluate', {
        expression: 'x',
        frameId: 2,  // Frame ID from stack trace
        context: 'repl'
      });
    });

    it('should evaluate an arithmetic expression', async () => {
      // Set session to paused state
      const session = sessionManager.getSession(sessionId);
      (session as any).state = SessionState.PAUSED;
      
      // Mock stack trace response for automatic frame detection
      const mockStackResponse: DebugProtocol.StackTraceResponse = {
        seq: 1,
        type: 'response',
        request_seq: 1,
        command: 'stackTrace',
        success: true,
        body: {
          stackFrames: [
            { id: 3, name: 'calculate', line: 10, column: 1, source: { path: 'test.py' } }
          ],
          totalFrames: 1
        }
      };
      
      // Mock evaluate response
      const mockEvalResponse: DebugProtocol.EvaluateResponse = {
        seq: 2,
        type: 'response',
        request_seq: 2,
        command: 'evaluate',
        success: true,
        body: {
          result: '15',
          type: 'int',
          variablesReference: 0
        }
      };
      
      (mockProxyManager.sendDapRequest as any)
        .mockResolvedValueOnce(mockStackResponse)
        .mockResolvedValueOnce(mockEvalResponse);
      
      // Evaluate expression
      const result = await sessionManager.evaluateExpression(sessionId, '10 + 5');
      
      // Verify result
      expect(result.success).toBe(true);
      expect(result.result).toBe('15');
      expect(result.type).toBe('int');
    });

    it('should evaluate a complex object with variablesReference', async () => {
      // Set session to paused state
      const session = sessionManager.getSession(sessionId);
      (session as any).state = SessionState.PAUSED;
      
      // Mock stack trace response for automatic frame detection
      const mockStackResponse: DebugProtocol.StackTraceResponse = {
        seq: 1,
        type: 'response',
        request_seq: 1,
        command: 'stackTrace',
        success: true,
        body: {
          stackFrames: [
            { id: 4, name: 'process_list', line: 15, column: 1, source: { path: 'test.py' } }
          ],
          totalFrames: 1
        }
      };
      
      // Mock evaluate response for a list
      const mockEvalResponse: DebugProtocol.EvaluateResponse = {
        seq: 2,
        type: 'response',
        request_seq: 2,
        command: 'evaluate',
        success: true,
        body: {
          result: '[1, 2, 3, 4, 5]',
          type: 'list',
          variablesReference: 123,
          namedVariables: 0,
          indexedVariables: 5
        }
      };
      
      (mockProxyManager.sendDapRequest as any)
        .mockResolvedValueOnce(mockStackResponse)
        .mockResolvedValueOnce(mockEvalResponse);
      
      // Evaluate expression
      const result = await sessionManager.evaluateExpression(sessionId, 'my_list');
      
      // Verify result
      expect(result.success).toBe(true);
      expect(result.result).toBe('[1, 2, 3, 4, 5]');
      expect(result.type).toBe('list');
      expect(result.variablesReference).toBe(123);
      expect(result.namedVariables).toBe(0);
      expect(result.indexedVariables).toBe(5);
    });

    it('should use provided frameId', async () => {
      // Set session to paused state
      const session = sessionManager.getSession(sessionId);
      (session as any).state = SessionState.PAUSED;
      
      // Mock DAP response
      const mockResponse: DebugProtocol.EvaluateResponse = {
        seq: 1,
        type: 'response',
        request_seq: 1,
        command: 'evaluate',
        success: true,
        body: {
          result: 'frame_2_value',
          type: 'str',
          variablesReference: 0
        }
      };
      
      (mockProxyManager.sendDapRequest as any).mockResolvedValue(mockResponse);
      
      // Evaluate expression with specific frameId
      const result = await sessionManager.evaluateExpression(sessionId, 'local_var', 2);
      
      // Verify DAP request was made with correct frameId
      expect(mockProxyManager.sendDapRequest).toHaveBeenCalledWith('evaluate', {
        expression: 'local_var',
        frameId: 2,
        context: 'repl'
      });
      
      expect(result.success).toBe(true);
      expect(result.result).toBe('frame_2_value');
    });

    it('should use custom context', async () => {
      // Set session to paused state
      const session = sessionManager.getSession(sessionId);
      (session as any).state = SessionState.PAUSED;
      
      // Mock DAP response
      const mockResponse: DebugProtocol.EvaluateResponse = {
        seq: 1,
        type: 'response',
        request_seq: 1,
        command: 'evaluate',
        success: true,
        body: {
          result: 'hover_value',
          type: 'str',
          variablesReference: 0
        }
      };
      
      (mockProxyManager.sendDapRequest as any).mockResolvedValue(mockResponse);
      
      // Evaluate expression with hover context
      const result = await sessionManager.evaluateExpression(sessionId, 'var', 0, 'hover');
      
      // Verify DAP request was made with correct context
      expect(mockProxyManager.sendDapRequest).toHaveBeenCalledWith('evaluate', {
        expression: 'var',
        frameId: 0,
        context: 'hover'
      });
      
      expect(result.success).toBe(true);
    });

    it('should handle expression that modifies state', async () => {
      // Set session to paused state
      const session = sessionManager.getSession(sessionId);
      (session as any).state = SessionState.PAUSED;
      
      // Mock stack trace response
      const mockStackResponse: DebugProtocol.StackTraceResponse = {
        seq: 1,
        type: 'response',
        request_seq: 1,
        command: 'stackTrace',
        success: true,
        body: {
          stackFrames: [
            { id: 5, name: 'mutate', line: 20, column: 1, source: { path: 'test.py' } }
          ],
          totalFrames: 1
        }
      };
      
      // Mock evaluate response for assignment
      const mockEvalResponse: DebugProtocol.EvaluateResponse = {
        seq: 2,
        type: 'response',
        request_seq: 2,
        command: 'evaluate',
        success: true,
        body: {
          result: '100',
          type: 'int',
          variablesReference: 0
        }
      };
      
      (mockProxyManager.sendDapRequest as any)
        .mockResolvedValueOnce(mockStackResponse)
        .mockResolvedValueOnce(mockEvalResponse);
      
      // Evaluate expression that modifies state
      const result = await sessionManager.evaluateExpression(sessionId, 'x = 100');
      
      // Verify result
      expect(result.success).toBe(true);
      expect(result.result).toBe('100');
      expect(result.type).toBe('int');
    });
  });

  describe('Error cases', () => {
    it('should fail when session is not paused', async () => {
      // Set session to running state
      const session = sessionManager.getSession(sessionId);
      (session as any).state = SessionState.RUNNING;
      
      // Evaluate expression
      const result = await sessionManager.evaluateExpression(sessionId, 'x');
      
      // Verify error - updated message
      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot evaluate: debugger not paused. Ensure the debugger is stopped at a breakpoint.');
      expect(result.result).toBeUndefined();
    });

    it('should fail with empty expression', async () => {
      // Set session to paused state
      const session = sessionManager.getSession(sessionId);
      (session as any).state = SessionState.PAUSED;
      
      // Evaluate empty expression
      const result = await sessionManager.evaluateExpression(sessionId, '');
      
      // Verify error
      expect(result.success).toBe(false);
      expect(result.error).toBe('Expression cannot be empty');
    });

    it('should fail with whitespace-only expression', async () => {
      // Set session to paused state
      const session = sessionManager.getSession(sessionId);
      (session as any).state = SessionState.PAUSED;
      
      // Evaluate whitespace expression
      const result = await sessionManager.evaluateExpression(sessionId, '   ');
      
      // Verify error
      expect(result.success).toBe(false);
      expect(result.error).toBe('Expression cannot be empty');
    });

    it('should fail when no proxy manager', async () => {
      // Set session to paused state
      const session = sessionManager.getSession(sessionId);
      (session as any).state = SessionState.PAUSED;
      (session as any).proxyManager = null;
      
      // Evaluate expression
      const result = await sessionManager.evaluateExpression(sessionId, 'x');
      
      // Verify error
      expect(result.success).toBe(false);
      expect(result.error).toBe('No active debug session');
    });

    it('should fail when proxy not running', async () => {
      // Set session to paused state
      const session = sessionManager.getSession(sessionId);
      (session as any).state = SessionState.PAUSED;
      (mockProxyManager.isRunning as any).mockReturnValue(false);
      
      // Evaluate expression
      const result = await sessionManager.evaluateExpression(sessionId, 'x');
      
      // Verify error
      expect(result.success).toBe(false);
      expect(result.error).toBe('No active debug session');
    });

    it('should handle syntax errors', async () => {
      // Set session to paused state
      const session = sessionManager.getSession(sessionId);
      (session as any).state = SessionState.PAUSED;
      
      // Mock stack trace success but evaluate fails with syntax error
      const mockStackResponse: DebugProtocol.StackTraceResponse = {
        seq: 1,
        type: 'response',
        request_seq: 1,
        command: 'stackTrace',
        success: true,
        body: {
          stackFrames: [
            { id: 6, name: 'test', line: 25, column: 1, source: { path: 'test.py' } }
          ],
          totalFrames: 1
        }
      };
      
      (mockProxyManager.sendDapRequest as any)
        .mockResolvedValueOnce(mockStackResponse)
        .mockRejectedValueOnce(new Error('SyntaxError: invalid syntax'));
      
      // Evaluate expression with syntax error
      const result = await sessionManager.evaluateExpression(sessionId, 'if True');
      
      // Verify error
      expect(result.success).toBe(false);
      expect(result.error).toContain('Syntax error');
    });

    it('should handle name errors', async () => {
      // Set session to paused state
      const session = sessionManager.getSession(sessionId);
      (session as any).state = SessionState.PAUSED;
      
      // Mock stack trace success but evaluate fails with name error
      const mockStackResponse: DebugProtocol.StackTraceResponse = {
        seq: 1,
        type: 'response',
        request_seq: 1,
        command: 'stackTrace',
        success: true,
        body: {
          stackFrames: [
            { id: 7, name: 'test', line: 30, column: 1, source: { path: 'test.py' } }
          ],
          totalFrames: 1
        }
      };
      
      (mockProxyManager.sendDapRequest as any)
        .mockResolvedValueOnce(mockStackResponse)
        .mockRejectedValueOnce(new Error("NameError: name 'undefined_var' is not defined"));
      
      // Evaluate expression with undefined variable
      const result = await sessionManager.evaluateExpression(sessionId, 'undefined_var');
      
      // Verify error
      expect(result.success).toBe(false);
      expect(result.error).toContain('Name not found');
    });

    it('should handle type errors', async () => {
      // Set session to paused state
      const session = sessionManager.getSession(sessionId);
      (session as any).state = SessionState.PAUSED;
      
      // Mock stack trace success but evaluate fails with type error
      const mockStackResponse: DebugProtocol.StackTraceResponse = {
        seq: 1,
        type: 'response',
        request_seq: 1,
        command: 'stackTrace',
        success: true,
        body: {
          stackFrames: [
            { id: 8, name: 'test', line: 35, column: 1, source: { path: 'test.py' } }
          ],
          totalFrames: 1
        }
      };
      
      (mockProxyManager.sendDapRequest as any)
        .mockResolvedValueOnce(mockStackResponse)
        .mockRejectedValueOnce(new Error("TypeError: unsupported operand type(s) for +: 'int' and 'str'"));
      
      // Evaluate expression with type error
      const result = await sessionManager.evaluateExpression(sessionId, '1 + "string"');
      
      // Verify error
      expect(result.success).toBe(false);
      expect(result.error).toContain('Type error');
    });

    it('should handle invalid frame errors', async () => {
      // Set session to paused state
      const session = sessionManager.getSession(sessionId);
      (session as any).state = SessionState.PAUSED;
      
      // Mock DAP error for invalid frame
      (mockProxyManager.sendDapRequest as any).mockRejectedValue(
        new Error('Invalid frame id 999')
      );
      
      // Evaluate expression with invalid frame
      const result = await sessionManager.evaluateExpression(sessionId, 'x', 999);
      
      // Verify error
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid frame context');
    });

    it('should handle response without body', async () => {
      // Set session to paused state
      const session = sessionManager.getSession(sessionId);
      (session as any).state = SessionState.PAUSED;
      
      // Mock stack trace response
      const mockStackResponse: DebugProtocol.StackTraceResponse = {
        seq: 1,
        type: 'response',
        request_seq: 1,
        command: 'stackTrace',
        success: true,
        body: {
          stackFrames: [
            { id: 9, name: 'test', line: 40, column: 1, source: { path: 'test.py' } }
          ],
          totalFrames: 1
        }
      };
      
      // Mock evaluate response without body
      const mockEvalResponse = {
        seq: 2,
        type: 'response',
        request_seq: 2,
        command: 'evaluate',
        success: true
        // No body
      };
      
      (mockProxyManager.sendDapRequest as any)
        .mockResolvedValueOnce(mockStackResponse)
        .mockResolvedValueOnce(mockEvalResponse);
      
      // Evaluate expression
      const result = await sessionManager.evaluateExpression(sessionId, 'x');
      
      // Verify error
      expect(result.success).toBe(false);
      expect(result.error).toBe('No response body from debug adapter');
    });
  });

  describe('Edge cases', () => {
    it('should handle very long expressions', async () => {
      // Set session to paused state
      const session = sessionManager.getSession(sessionId);
      (session as any).state = SessionState.PAUSED;
      
      // Create a very long expression
      const longExpression = 'x = ' + '1 + '.repeat(500) + '1';
      
      // Mock stack trace response
      const mockStackResponse: DebugProtocol.StackTraceResponse = {
        seq: 1,
        type: 'response',
        request_seq: 1,
        command: 'stackTrace',
        success: true,
        body: {
          stackFrames: [
            { id: 10, name: 'test', line: 45, column: 1, source: { path: 'test.py' } }
          ],
          totalFrames: 1
        }
      };
      
      // Mock evaluate response
      const mockEvalResponse: DebugProtocol.EvaluateResponse = {
        seq: 2,
        type: 'response',
        request_seq: 2,
        command: 'evaluate',
        success: true,
        body: {
          result: '501',
          type: 'int',
          variablesReference: 0
        }
      };
      
      (mockProxyManager.sendDapRequest as any)
        .mockResolvedValueOnce(mockStackResponse)
        .mockResolvedValueOnce(mockEvalResponse);
      
      // Evaluate expression
      const result = await sessionManager.evaluateExpression(sessionId, longExpression);
      
      // Verify result
      expect(result.success).toBe(true);
      expect(result.result).toBe('501');
    });

    it('should handle unicode in expressions', async () => {
      // Set session to paused state
      const session = sessionManager.getSession(sessionId);
      (session as any).state = SessionState.PAUSED;
      
      // Mock stack trace response
      const mockStackResponse: DebugProtocol.StackTraceResponse = {
        seq: 1,
        type: 'response',
        request_seq: 1,
        command: 'stackTrace',
        success: true,
        body: {
          stackFrames: [
            { id: 11, name: 'test', line: 50, column: 1, source: { path: 'test.py' } }
          ],
          totalFrames: 1
        }
      };
      
      // Mock evaluate response
      const mockEvalResponse: DebugProtocol.EvaluateResponse = {
        seq: 2,
        type: 'response',
        request_seq: 2,
        command: 'evaluate',
        success: true,
        body: {
          result: '"测试"',
          type: 'str',
          variablesReference: 0
        }
      };
      
      (mockProxyManager.sendDapRequest as any)
        .mockResolvedValueOnce(mockStackResponse)
        .mockResolvedValueOnce(mockEvalResponse);
      
      // Evaluate expression with unicode
      const result = await sessionManager.evaluateExpression(sessionId, '评估 = "测试"');
      
      // Verify result
      expect(result.success).toBe(true);
      expect(result.result).toBe('"测试"');
    });

    it('should handle very long results', async () => {
      // Set session to paused state
      const session = sessionManager.getSession(sessionId);
      (session as any).state = SessionState.PAUSED;
      
      // Create a very long result
      const longResult = 'x' + '0'.repeat(5000);
      
      // Mock stack trace response
      const mockStackResponse: DebugProtocol.StackTraceResponse = {
        seq: 1,
        type: 'response',
        request_seq: 1,
        command: 'stackTrace',
        success: true,
        body: {
          stackFrames: [
            { id: 12, name: 'test', line: 55, column: 1, source: { path: 'test.py' } }
          ],
          totalFrames: 1
        }
      };
      
      // Mock evaluate response
      const mockEvalResponse: DebugProtocol.EvaluateResponse = {
        seq: 2,
        type: 'response',
        request_seq: 2,
        command: 'evaluate',
        success: true,
        body: {
          result: longResult,
          type: 'str',
          variablesReference: 0
        }
      };
      
      (mockProxyManager.sendDapRequest as any)
        .mockResolvedValueOnce(mockStackResponse)
        .mockResolvedValueOnce(mockEvalResponse);
      
      // Evaluate expression
      const result = await sessionManager.evaluateExpression(sessionId, 'very_long_string');
      
      // Verify result (should not be truncated in the result itself)
      expect(result.success).toBe(true);
      expect(result.result).toBe(longResult);
      expect(result.result?.length).toBe(5001);
    });

    it('should automatically get current frame when frameId not provided', async () => {
      // Set session to paused state
      const session = sessionManager.getSession(sessionId);
      (session as any).state = SessionState.PAUSED;
      
      // Mock stack trace response
      const mockStackResponse: DebugProtocol.StackTraceResponse = {
        seq: 1,
        type: 'response',
        request_seq: 1,
        command: 'stackTrace',
        success: true,
        body: {
          stackFrames: [
            { id: 13, name: 'current_frame', line: 60, column: 1, source: { path: 'test.py' } }
          ],
          totalFrames: 1
        }
      };
      
      // Mock evaluate response
      const mockEvalResponse: DebugProtocol.EvaluateResponse = {
        seq: 2,
        type: 'response',
        request_seq: 2,
        command: 'evaluate',
        success: true,
        body: {
          result: 'value',
          type: 'str',
          variablesReference: 0
        }
      };
      
      (mockProxyManager.sendDapRequest as any)
        .mockResolvedValueOnce(mockStackResponse)
        .mockResolvedValueOnce(mockEvalResponse);
      
      // Evaluate expression without frameId
      const result = await sessionManager.evaluateExpression(sessionId, 'x', undefined, 'repl');
      
      // Verify stack trace was called to get current frame
      expect(mockProxyManager.sendDapRequest).toHaveBeenNthCalledWith(1, 'stackTrace', {
        threadId: 1,
        startFrame: 0,
        levels: 1
      });
      
      // Verify evaluate was called with the frame ID from stack trace
      expect(mockProxyManager.sendDapRequest).toHaveBeenNthCalledWith(2, 'evaluate', {
        expression: 'x',
        frameId: 13,  // From stack trace
        context: 'repl'
      });
      
      expect(result.success).toBe(true);
    });
  });
});
