/**
 * Unit tests for DebuggerProvider interface implementations
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DebuggerProvider, DebuggerConfig, DebugResult } from '../../../src/debugger/provider.js';
import { Breakpoint, DebugLocation, StackFrame, Variable } from '../../../src/session/models.js';

// Mock implementation of DebuggerProvider for testing
class MockDebuggerProvider implements DebuggerProvider {
  initialize = vi.fn();
  setBreakpoint = vi.fn();
  removeBreakpoint = vi.fn();
  startDebugging = vi.fn();
  stepOver = vi.fn();
  stepInto = vi.fn();
  stepOut = vi.fn();
  continue = vi.fn();
  pause = vi.fn();
  getVariables = vi.fn();
  evaluateExpression = vi.fn();
  getStackTrace = vi.fn();
  getSourceContext = vi.fn();
  terminate = vi.fn();
}

describe('DebuggerProvider Interface', () => {
  let provider: MockDebuggerProvider;

  beforeEach(() => {
    provider = new MockDebuggerProvider();
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with config', async () => {
      const config: DebuggerConfig = {
        sessionId: 'test-session-123',
        adapterPath: '/path/to/adapter',
        options: { verbose: true }
      };
      
      provider.initialize.mockResolvedValue(true);
      
      const result = await provider.initialize(config);
      
      expect(provider.initialize).toHaveBeenCalledWith(config);
      expect(result).toBe(true);
    });

    it('should handle initialization failure', async () => {
      const config: DebuggerConfig = {
        sessionId: 'test-session-123'
      };
      
      provider.initialize.mockResolvedValue(false);
      
      const result = await provider.initialize(config);
      
      expect(result).toBe(false);
    });
  });

  describe('Breakpoint Management', () => {
    it('should set a breakpoint', async () => {
      const mockBreakpoint: Breakpoint = {
        id: 'bp-1',
        file: 'test.py',
        line: 10,
        verified: true
      };
      
      provider.setBreakpoint.mockResolvedValue(mockBreakpoint);
      
      const result = await provider.setBreakpoint('test.py', 10);
      
      expect(provider.setBreakpoint).toHaveBeenCalledWith('test.py', 10, undefined);
      expect(result).toEqual(mockBreakpoint);
    });

    it('should set a conditional breakpoint', async () => {
      const mockBreakpoint: Breakpoint = {
        id: 'bp-2',
        file: 'test.py',
        line: 20,
        condition: 'x > 5',
        verified: true
      };
      
      provider.setBreakpoint.mockResolvedValue(mockBreakpoint);
      
      const result = await provider.setBreakpoint('test.py', 20, 'x > 5');
      
      expect(provider.setBreakpoint).toHaveBeenCalledWith('test.py', 20, 'x > 5');
      expect(result).toEqual(mockBreakpoint);
    });

    it('should remove a breakpoint', async () => {
      provider.removeBreakpoint.mockResolvedValue(true);
      
      const result = await provider.removeBreakpoint('bp-1');
      
      expect(provider.removeBreakpoint).toHaveBeenCalledWith('bp-1');
      expect(result).toBe(true);
    });
  });

  describe('Debugging Control', () => {
    const mockDebugResult: DebugResult = {
      success: true,
      state: 'paused',
      currentFile: 'test.py',
      currentLine: 15,
      location: {
        file: 'test.py',
        line: 15,
        sourceLines: ['    x = 10'],
        sourceLine: 0
      }
    };

    it('should start debugging', async () => {
      provider.startDebugging.mockResolvedValue({
        ...mockDebugResult,
        state: 'running'
      });
      
      const result = await provider.startDebugging('test.py', ['--debug']);
      
      expect(provider.startDebugging).toHaveBeenCalledWith('test.py', ['--debug']);
      expect(result.success).toBe(true);
      expect(result.state).toBe('running');
    });

    it('should step over', async () => {
      provider.stepOver.mockResolvedValue(mockDebugResult);
      
      const result = await provider.stepOver();
      
      expect(provider.stepOver).toHaveBeenCalled();
      expect(result).toEqual(mockDebugResult);
    });

    it('should step into', async () => {
      provider.stepInto.mockResolvedValue(mockDebugResult);
      
      const result = await provider.stepInto();
      
      expect(provider.stepInto).toHaveBeenCalled();
      expect(result).toEqual(mockDebugResult);
    });

    it('should step out', async () => {
      provider.stepOut.mockResolvedValue(mockDebugResult);
      
      const result = await provider.stepOut();
      
      expect(provider.stepOut).toHaveBeenCalled();
      expect(result).toEqual(mockDebugResult);
    });

    it('should continue execution', async () => {
      provider.continue.mockResolvedValue({
        ...mockDebugResult,
        state: 'running'
      });
      
      const result = await provider.continue();
      
      expect(provider.continue).toHaveBeenCalled();
      expect(result.state).toBe('running');
    });

    it('should pause execution', async () => {
      provider.pause.mockResolvedValue(mockDebugResult);
      
      const result = await provider.pause();
      
      expect(provider.pause).toHaveBeenCalled();
      expect(result).toEqual(mockDebugResult);
    });

    it('should handle debugging errors', async () => {
      const errorResult: DebugResult = {
        success: false,
        state: 'error',
        error: 'Failed to start debugging: File not found'
      };
      
      provider.startDebugging.mockResolvedValue(errorResult);
      
      const result = await provider.startDebugging('missing.py');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('File not found');
    });

    it('should terminate debugging', async () => {
      provider.terminate.mockResolvedValue(true);
      
      const result = await provider.terminate();
      
      expect(provider.terminate).toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });

  describe('Variable and Stack Inspection', () => {
    it('should get variables', async () => {
      const mockVariables: Variable[] = [
        { name: 'x', value: '10', type: 'int', expandable: false },
        { name: 'y', value: '20', type: 'int', expandable: false }
      ];
      
      provider.getVariables.mockResolvedValue(mockVariables);
      
      const result = await provider.getVariables('locals');
      
      expect(provider.getVariables).toHaveBeenCalledWith('locals');
      expect(result).toEqual(mockVariables);
    });

    it('should get all variables when no scope specified', async () => {
      const mockVariables: Variable[] = [
        { name: 'global_var', value: 'test', type: 'str', expandable: false }
      ];
      
      provider.getVariables.mockResolvedValue(mockVariables);
      
      const result = await provider.getVariables();
      
      expect(provider.getVariables).toHaveBeenCalledWith(undefined);
      expect(result).toEqual(mockVariables);
    });

    it('should get stack trace', async () => {
      const mockStackFrames: StackFrame[] = [
        {
          id: 1,
          name: 'main',
          file: 'test.py',
          line: 15,
          column: 0
        },
        {
          id: 2,
          name: 'helper',
          file: 'test.py',
          line: 5,
          column: 4
        }
      ];
      
      provider.getStackTrace.mockResolvedValue(mockStackFrames);
      
      const result = await provider.getStackTrace();
      
      expect(provider.getStackTrace).toHaveBeenCalled();
      expect(result).toEqual(mockStackFrames);
    });

    it('should evaluate expression', async () => {
      const expressionResult = { value: 30, type: 'int' };
      
      provider.evaluateExpression.mockResolvedValue(expressionResult);
      
      const result = await provider.evaluateExpression('x + y');
      
      expect(provider.evaluateExpression).toHaveBeenCalledWith('x + y');
      expect(result).toEqual(expressionResult);
    });

    it('should get source context', async () => {
      const mockLocation: DebugLocation = {
        file: 'test.py',
        line: 10,
        sourceLines: ['def test():', '    x = 10  # current line', '    return x'],
        sourceLine: 1
      };
      
      provider.getSourceContext.mockResolvedValue(mockLocation);
      
      const result = await provider.getSourceContext('test.py', 10, 1);
      
      expect(provider.getSourceContext).toHaveBeenCalledWith('test.py', 10, 1);
      expect(result).toEqual(mockLocation);
    });

    it('should use default context lines', async () => {
      const mockLocation: DebugLocation = {
        file: 'test.py',
        line: 10,
        sourceLines: ['line 5', 'line 6', 'line 7', 'line 8', 'line 9', 'line 10', 'line 11', 'line 12', 'line 13', 'line 14', 'line 15'],
        sourceLine: 5
      };
      
      provider.getSourceContext.mockResolvedValue(mockLocation);
      
      const result = await provider.getSourceContext('test.py', 10);
      
      expect(provider.getSourceContext).toHaveBeenCalledWith('test.py', 10, undefined);
      expect(result).toEqual(mockLocation);
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle debugging workflow', async () => {
      // Initialize
      provider.initialize.mockResolvedValue(true);
      await provider.initialize({ sessionId: 'test-123' });
      
      // Set breakpoints
      const bp1: Breakpoint = { id: 'bp-1', file: 'test.py', line: 10, verified: true };
      const bp2: Breakpoint = { id: 'bp-2', file: 'test.py', line: 20, verified: true };
      provider.setBreakpoint.mockResolvedValueOnce(bp1).mockResolvedValueOnce(bp2);
      
      await provider.setBreakpoint('test.py', 10);
      await provider.setBreakpoint('test.py', 20);
      
      // Start debugging
      provider.startDebugging.mockResolvedValue({
        success: true,
        state: 'paused',
        currentFile: 'test.py',
        currentLine: 10
      });
      
      const startResult = await provider.startDebugging('test.py');
      expect(startResult.currentLine).toBe(10);
      
      // Get variables at breakpoint
      provider.getVariables.mockResolvedValue([
        { name: 'x', value: '5', type: 'int', expandable: false }
      ]);
      
      const vars = await provider.getVariables('locals');
      expect(vars[0].value).toBe('5');
      
      // Continue to next breakpoint
      provider.continue.mockResolvedValue({
        success: true,
        state: 'paused',
        currentFile: 'test.py',
        currentLine: 20
      });
      
      const continueResult = await provider.continue();
      expect(continueResult.currentLine).toBe(20);
      
      // Terminate
      provider.terminate.mockResolvedValue(true);
      await provider.terminate();
      
      // Verify the full workflow
      expect(provider.initialize).toHaveBeenCalledTimes(1);
      expect(provider.setBreakpoint).toHaveBeenCalledTimes(2);
      expect(provider.startDebugging).toHaveBeenCalledTimes(1);
      expect(provider.getVariables).toHaveBeenCalledTimes(1);
      expect(provider.continue).toHaveBeenCalledTimes(1);
      expect(provider.terminate).toHaveBeenCalledTimes(1);
    });

    it('should handle expression evaluation in context', async () => {
      // Simulate being paused at a breakpoint
      provider.getVariables.mockResolvedValue([
        { name: 'x', value: '10', type: 'int', expandable: false },
        { name: 'y', value: '20', type: 'int', expandable: false }
      ]);
      
      // Evaluate expression using current variables
      provider.evaluateExpression.mockImplementation(async (expr: string) => {
        if (expr === 'x + y') return { value: 30, type: 'int' };
        if (expr === 'x > y') return { value: false, type: 'bool' };
        if (expr === 'x * 2') return { value: 20, type: 'int' };
        return { error: 'Invalid expression' };
      });
      
      const result1 = await provider.evaluateExpression('x + y');
      expect(result1).toEqual({ value: 30, type: 'int' });
      
      const result2 = await provider.evaluateExpression('x > y');
      expect(result2).toEqual({ value: false, type: 'bool' });
      
      const result3 = await provider.evaluateExpression('x * 2');
      expect(result3).toEqual({ value: 20, type: 'int' });
    });
  });
});
