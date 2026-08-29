/**
 * Inspection tool handlers (evaluate_expression, get_source_context,
 * get_local_variables), driven directly against a ToolContext. (Moved out of
 * tests/unit/server-coverage.test.ts, which reached them through private
 * DebugMcpServer delegates that no longer exist.)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { McpError, ErrorCode as McpErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { SessionLifecycleState } from '@debugmcp/shared';
import {
  handleEvaluateExpression,
  handleGetSourceContext,
  handleGetLocalVariables
} from '../../../../../src/server/handlers/inspection-tools.js';
import { createMockToolContext } from '../server-test-helpers.js';

describe('inspection tool handlers', () => {
  let ctx: any;

  beforeEach(() => {
    ctx = createMockToolContext();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('handleEvaluateExpression', () => {
    it('should handle expression evaluation in terminated session', async () => {
      ctx.sessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: SessionLifecycleState.TERMINATED
      });

      const result = await handleEvaluateExpression(ctx, {
        sessionId: 'test-session',
        expression: 'x + 1'
      });

      // The handler returns a success response with the error in the content
      expect(result.content[0].text).toContain('Session is terminated');
    });
  });

  describe('handleGetSourceContext', () => {
    beforeEach(() => {
      ctx.sessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: SessionLifecycleState.ACTIVE
      });
    });

    it('returns source context on success', async () => {
      ctx.fileChecker = {
        checkExists: vi.fn().mockResolvedValue({ exists: true, effectivePath: '/app/main.py' })
      };
      ctx.lineReader = {
        getLineContext: vi.fn().mockResolvedValue({
          lineContent: 'print("hello")',
          surrounding: [
            { line: 9, content: 'def main():' },
            { line: 10, content: '    print("hello")' },
            { line: 11, content: '' }
          ]
        })
      };

      const result = await handleGetSourceContext(ctx, {
        sessionId: 'test-session',
        file: '/app/main.py',
        line: 10
      });
      const payload = JSON.parse(result.content[0].text);

      expect(payload.success).toBe(true);
      expect(payload.file).toBe('/app/main.py');
      expect(payload.line).toBe(10);
      expect(payload.lineContent).toBe('print("hello")');
      expect(payload.surrounding).toHaveLength(3);
    });

    it('throws McpError when file not found', async () => {
      ctx.fileChecker = {
        checkExists: vi.fn().mockResolvedValue({
          exists: false,
          effectivePath: '/missing.py',
          errorMessage: 'ENOENT'
        })
      };

      await expect(handleGetSourceContext(ctx, {
        sessionId: 'test-session',
        file: '/missing.py',
        line: 1
      })).rejects.toThrow('Source file');
    });

    it('returns error JSON when file is unreadable', async () => {
      ctx.fileChecker = {
        checkExists: vi.fn().mockResolvedValue({ exists: true, effectivePath: '/app/binary.dat' })
      };
      ctx.lineReader = {
        getLineContext: vi.fn().mockResolvedValue(null)
      };

      const result = await handleGetSourceContext(ctx, {
        sessionId: 'test-session',
        file: '/app/binary.dat',
        line: 1
      });
      const payload = JSON.parse(result.content[0].text);

      expect(payload.success).toBe(false);
      expect(payload.error).toContain('Could not read source context');
    });

    it('uses default context lines when not specified', async () => {
      ctx.fileChecker = {
        checkExists: vi.fn().mockResolvedValue({ exists: true, effectivePath: '/app/test.py' })
      };
      const getLineContext = vi.fn().mockResolvedValue({
        lineContent: 'x = 1',
        surrounding: []
      });
      ctx.lineReader = { getLineContext };

      await handleGetSourceContext(ctx, {
        sessionId: 'test-session',
        file: '/app/test.py',
        line: 5
      });

      expect(getLineContext).toHaveBeenCalledWith('/app/test.py', 5, { contextLines: 5 });
    });

    it('returns binary/inaccessible message when lineReader returns null', async () => {
      ctx.fileChecker = {
        checkExists: vi.fn().mockResolvedValue({
          exists: true,
          effectivePath: '/path/to/binary.bin'
        })
      };

      ctx.lineReader = {
        getLineContext: vi.fn().mockResolvedValue(null)
      };

      const result = await handleGetSourceContext(ctx, {
        sessionId: 'test-session',
        file: '/path/to/binary.bin',
        line: 1
      });

      const payload = JSON.parse(result.content[0].text);
      expect(payload.success).toBe(false);
      expect(payload.error).toContain('binary or inaccessible');
    });

    it('returns source context when lineReader returns content', async () => {
      ctx.sessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: SessionLifecycleState.ACTIVE,
        name: 'my-session'
      });

      ctx.fileChecker = {
        checkExists: vi.fn().mockResolvedValue({
          exists: true,
          effectivePath: '/path/to/script.py'
        })
      };

      ctx.lineReader = {
        getLineContext: vi.fn().mockResolvedValue({
          lineContent: 'x = 42',
          surrounding: ['', 'x = 42', '']
        })
      };

      const result = await handleGetSourceContext(ctx, {
        sessionId: 'test-session',
        file: '/path/to/script.py',
        line: 5,
        linesContext: 3
      });

      const payload = JSON.parse(result.content[0].text);
      expect(payload.success).toBe(true);
      expect(payload.lineContent).toBe('x = 42');
      expect(payload.contextLines).toBe(3);
    });

    it('throws when file does not exist', async () => {
      ctx.fileChecker = {
        checkExists: vi.fn().mockResolvedValue({
          exists: false,
          effectivePath: '/nope.py',
          errorMessage: 'not found'
        })
      };

      await expect(handleGetSourceContext(ctx, {
        sessionId: 'test-session',
        file: '/nope.py',
        line: 1
      })).rejects.toThrow();
    });
  });

  describe('handleGetLocalVariables', () => {
    beforeEach(() => {
      ctx.sessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: SessionLifecycleState.ACTIVE
      });
      ctx.sessionManager.getLocalVariables = vi.fn();
    });

    it('returns variables with frame and scope info', async () => {
      ctx.sessionManager.getLocalVariables.mockResolvedValue({
        variables: [{ name: 'x', value: '42' }],
        frame: { name: 'main', file: 'test.py', line: 10 },
        scopeName: 'Locals'
      });

      const result = await handleGetLocalVariables(ctx, {
        sessionId: 'test-session'
      });
      const payload = JSON.parse(result.content[0].text);

      expect(payload.success).toBe(true);
      expect(payload.count).toBe(1);
      expect(payload.variables[0].name).toBe('x');
      expect(payload.frame.name).toBe('main');
      expect(payload.scopeName).toBe('Locals');
    });

    it('shows "not paused" message when no frame available', async () => {
      ctx.sessionManager.getLocalVariables.mockResolvedValue({
        variables: [],
        frame: null,
        scopeName: null
      });

      const result = await handleGetLocalVariables(ctx, {
        sessionId: 'test-session'
      });
      const payload = JSON.parse(result.content[0].text);

      expect(payload.success).toBe(true);
      expect(payload.count).toBe(0);
      expect(payload.message).toContain('No stack frames available');
    });

    it('shows "no local scope" message when frame exists but no scope', async () => {
      ctx.sessionManager.getLocalVariables.mockResolvedValue({
        variables: [],
        frame: { name: 'main', file: 'test.py', line: 10 },
        scopeName: null
      });

      const result = await handleGetLocalVariables(ctx, {
        sessionId: 'test-session'
      });
      const payload = JSON.parse(result.content[0].text);

      expect(payload.message).toContain('No local scope found');
    });

    it('shows "scope is empty" message when scope exists but has no variables', async () => {
      ctx.sessionManager.getLocalVariables.mockResolvedValue({
        variables: [],
        frame: { name: 'main', file: 'test.py', line: 10 },
        scopeName: 'Locals'
      });

      const result = await handleGetLocalVariables(ctx, {
        sessionId: 'test-session'
      });
      const payload = JSON.parse(result.content[0].text);

      expect(payload.message).toContain('The Locals scope is empty');
    });

    it('surfaces a warning when the scope name carries an adapter warning (optimized Go binary)', async () => {
      ctx.sessionManager.getLocalVariables.mockResolvedValue({
        variables: [],
        frame: { name: 'main.main', file: 'main.go', line: 10 },
        scopeName: 'Locals (warning: optimized function)'
      });

      const result = await handleGetLocalVariables(ctx, {
        sessionId: 'test-session'
      });
      const payload = JSON.parse(result.content[0].text);

      expect(payload.scopeName).toBe('Locals (warning: optimized function)');
      expect(payload.warning).toContain('optimizations');
      expect(payload.warning).toContain('-gcflags');
    });

    it('does not add a warning for a plain scope name', async () => {
      ctx.sessionManager.getLocalVariables.mockResolvedValue({
        variables: [{ name: 'x', value: '42' }],
        frame: { name: 'main', file: 'test.py', line: 10 },
        scopeName: 'Locals'
      });

      const result = await handleGetLocalVariables(ctx, {
        sessionId: 'test-session'
      });
      const payload = JSON.parse(result.content[0].text);

      expect(payload.warning).toBeUndefined();
    });

    it('returns graceful JSON for McpError with "not paused"', async () => {
      ctx.validateSession = vi.fn().mockImplementation(() => {
        throw new McpError(McpErrorCode.InvalidRequest, 'Session is not paused');
      });

      const result = await handleGetLocalVariables(ctx, {
        sessionId: 'test-session'
      });
      const payload = JSON.parse(result.content[0].text);

      expect(payload.success).toBe(false);
      expect(payload.error).toContain('not paused');
      expect(payload.message).toContain('Cannot get local variables');
    });

    it('explains a terminated session as a normal end state (program finished)', async () => {
      ctx.validateSession = vi.fn().mockImplementation(() => {
        throw new McpError(McpErrorCode.InvalidRequest, 'Session is terminated: test-session');
      });

      const result = await handleGetLocalVariables(ctx, {
        sessionId: 'test-session'
      });
      const payload = JSON.parse(result.content[0].text);

      expect(payload.success).toBe(false);
      expect(payload.message).toContain('program has terminated');
      expect(payload.message).toContain('restart_debugging');
    });

    it('wraps generic errors as McpError', async () => {
      ctx.sessionManager.getLocalVariables.mockRejectedValue(new Error('unexpected'));

      await expect(handleGetLocalVariables(ctx, {
        sessionId: 'test-session'
      })).rejects.toThrow('Failed to get local variables');
    });

    it('returns "no stack frames" message when frame is null', async () => {
      ctx.sessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: SessionLifecycleState.ACTIVE,
        name: 'my-session'
      });

      ctx.sessionManager.getLocalVariables = vi.fn().mockResolvedValue({
        variables: [],
        frame: null,
        scopeName: null
      });

      const result = await handleGetLocalVariables(ctx, {
        sessionId: 'test-session'
      });

      const payload = JSON.parse(result.content[0].text);
      expect(payload.success).toBe(true);
      expect(payload.variables).toEqual([]);
      expect(payload.message).toContain('No stack frames available');
    });

    it('returns "no local scope" message when scopeName is null', async () => {
      ctx.sessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: SessionLifecycleState.ACTIVE,
        name: 'my-session'
      });

      ctx.sessionManager.getLocalVariables = vi.fn().mockResolvedValue({
        variables: [],
        frame: { name: 'main', file: 'test.py', line: 1 },
        scopeName: null
      });

      const result = await handleGetLocalVariables(ctx, {
        sessionId: 'test-session'
      });

      const payload = JSON.parse(result.content[0].text);
      expect(payload.message).toContain('No local scope found');
    });

    it('returns "scope is empty" message when scope exists but has no variables (named session)', async () => {
      ctx.sessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: SessionLifecycleState.ACTIVE,
        name: 'my-session'
      });

      ctx.sessionManager.getLocalVariables = vi.fn().mockResolvedValue({
        variables: [],
        frame: { name: 'main', file: 'test.py', line: 1 },
        scopeName: 'Locals'
      });

      const result = await handleGetLocalVariables(ctx, {
        sessionId: 'test-session'
      });

      const payload = JSON.parse(result.content[0].text);
      expect(payload.message).toContain('Locals scope is empty');
    });

    it('returns variables with frame and scope info (named session)', async () => {
      ctx.sessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: SessionLifecycleState.ACTIVE,
        name: 'my-session'
      });

      ctx.sessionManager.getLocalVariables = vi.fn().mockResolvedValue({
        variables: [{ name: 'x', value: '42', type: 'int' }],
        frame: { name: 'main', file: 'test.py', line: 10 },
        scopeName: 'Locals'
      });

      const result = await handleGetLocalVariables(ctx, {
        sessionId: 'test-session'
      });

      const payload = JSON.parse(result.content[0].text);
      expect(payload.success).toBe(true);
      expect(payload.variables).toHaveLength(1);
      expect(payload.frame.name).toBe('main');
      expect(payload.scopeName).toBe('Locals');
      expect(payload.message).toBeUndefined();
    });

    it('returns graceful error for terminated session', async () => {
      ctx.sessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: SessionLifecycleState.ACTIVE,
        name: 'my-session'
      });

      ctx.sessionManager.getLocalVariables = vi.fn().mockRejectedValue(
        new McpError(McpErrorCode.InvalidRequest, 'Session is terminated: test-session')
      );

      const result = await handleGetLocalVariables(ctx, {
        sessionId: 'test-session'
      });

      const payload = JSON.parse(result.content[0].text);
      expect(payload.success).toBe(false);
      expect(payload.error).toContain('terminated');
    });
  });
});
