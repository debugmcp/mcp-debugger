/**
 * Execution-control tool handlers (pause_execution, list_threads), driven
 * directly against a ToolContext. (Moved out of
 * tests/unit/server-coverage.test.ts, which reached them through private
 * DebugMcpServer delegates that no longer exist.)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SessionLifecycleState } from '@debugmcp/shared';
import {
  handlePause,
  handleListThreads,
  stepTool,
  continueExecutionTool
} from '../../../../../src/server/handlers/execution-tools.js';
import {
  SessionTerminatedError,
  ProxyNotRunningError
} from '../../../../../src/errors/debug-errors.js';
import { createMockToolContext } from '../server-test-helpers.js';

// DebugMcpServer builds its dependencies in the constructor; mock the container
// so createMockToolContext() never opens a real logger transport or session dir.
vi.mock('../../../../../src/container/dependencies.js');
vi.mock('../../../../../src/session/session-manager.js');

describe('execution tool handlers', () => {
  let ctx: any;

  beforeEach(() => {
    ctx = createMockToolContext();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('handleListThreads', () => {
    it('should return threads on success', async () => {
      ctx.sessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: SessionLifecycleState.ACTIVE
      });
      ctx.sessionManager.listThreads = vi.fn().mockResolvedValue([
        { id: 1, name: 'main' },
        { id: 2, name: 'worker-1' },
      ]);

      const result = await handleListThreads(ctx, { sessionId: 'test-session' });
      const payload = JSON.parse(result.content[0].text);

      expect(payload.success).toBe(true);
      expect(payload.threads).toHaveLength(2);
      expect(payload.threads[0]).toEqual({ id: 1, name: 'main' });
    });

    it('converts typed session errors (SessionTerminatedError etc.) into success:false results', async () => {
      ctx.sessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: SessionLifecycleState.ACTIVE
      });
      ctx.sessionManager.listThreads = vi.fn().mockRejectedValue(new SessionTerminatedError('test-session'));

      const result = await handleListThreads(ctx, { sessionId: 'test-session' });
      const payload = JSON.parse(result.content[0].text);

      expect(payload.success).toBe(false);
      expect(payload.error).toContain('Session is terminated: test-session');
    });

    it('should throw McpError for unknown errors', async () => {
      ctx.sessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: SessionLifecycleState.ACTIVE
      });
      ctx.sessionManager.listThreads = vi.fn().mockRejectedValue(new Error('unexpected'));

      await expect(handleListThreads(ctx, { sessionId: 'test-session' }))
        .rejects.toThrow('Failed to list threads: unexpected');
    });
  });

  describe('stepTool failure envelopes (issue #638)', () => {
    it.each([
      ['step_over', 'stepOver'],
      ['step_into', 'stepInto'],
      ['step_out', 'stepOut']
    ] as const)('%s reports the reason and state without a fabricated "Stepped" message', async (toolName, method) => {
      ctx.sessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: SessionLifecycleState.ACTIVE
      });
      ctx.sessionManager[method].mockResolvedValue({
        success: false,
        error: 'Not paused',
        state: 'running'
      });

      const result = await stepTool(ctx, { sessionId: 'test-session' }, toolName);
      const payload = JSON.parse(result.content[0].text);

      expect(payload).toEqual({ success: false, error: 'Not paused', state: 'running' });
    });

    it('keeps the success wording and state on a successful step', async () => {
      ctx.sessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: SessionLifecycleState.ACTIVE
      });
      ctx.sessionManager.stepOver.mockResolvedValue({ success: true, state: 'paused' });

      const result = await stepTool(ctx, { sessionId: 'test-session' }, 'step_over');
      const payload = JSON.parse(result.content[0].text);

      expect(payload.success).toBe(true);
      expect(payload.message).toBe('Stepped over');
      expect(payload.state).toBe('paused');
    });
  });

  describe('continueExecutionTool envelopes (issue #638)', () => {
    it('reports the reason and state when continue fails', async () => {
      ctx.sessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: SessionLifecycleState.ACTIVE
      });
      ctx.sessionManager.continue.mockResolvedValue({
        success: false,
        error: 'No current thread ID',
        state: 'running'
      });

      const result = await continueExecutionTool(ctx, { sessionId: 'test-session' }, 'continue_execution');
      const payload = JSON.parse(result.content[0].text);

      expect(payload).toEqual({ success: false, error: 'No current thread ID', state: 'running' });
    });

    it('includes the observed state on success (can be "paused" when a breakpoint fired mid-continue)', async () => {
      ctx.sessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: SessionLifecycleState.ACTIVE
      });
      ctx.sessionManager.continue.mockResolvedValue({ success: true, state: 'paused' });

      const result = await continueExecutionTool(ctx, { sessionId: 'test-session' }, 'continue_execution');
      const payload = JSON.parse(result.content[0].text);

      expect(payload).toEqual({ success: true, message: 'Continued execution', state: 'paused' });
    });

    it('still converts typed session errors into success:false results', async () => {
      ctx.sessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: SessionLifecycleState.ACTIVE
      });
      ctx.sessionManager.continue.mockRejectedValue(new ProxyNotRunningError('test-session', 'continue'));

      const result = await continueExecutionTool(ctx, { sessionId: 'test-session' }, 'continue_execution');
      const payload = JSON.parse(result.content[0].text);

      expect(payload.success).toBe(false);
      expect(payload.error).toContain('no active proxy');
    });
  });

  describe('handlePause with threadId', () => {
    it('should pass threadId to session manager pause', async () => {
      ctx.sessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: SessionLifecycleState.ACTIVE
      });
      ctx.sessionManager.pause = vi.fn().mockResolvedValue({ success: true, state: 'paused' });

      const result = await handlePause(ctx, { sessionId: 'test-session', threadId: 7 });
      const payload = JSON.parse(result.content[0].text);

      expect(payload.success).toBe(true);
      expect(ctx.sessionManager.pause).toHaveBeenCalledWith('test-session', 7);
    });

    it('should pass undefined threadId when not provided', async () => {
      ctx.sessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: SessionLifecycleState.ACTIVE
      });
      ctx.sessionManager.pause = vi.fn().mockResolvedValue({ success: true, state: 'paused' });

      await handlePause(ctx, { sessionId: 'test-session' });

      expect(ctx.sessionManager.pause).toHaveBeenCalledWith('test-session', undefined);
    });
  });

  describe('handlePause', () => {
    it('returns result on success', async () => {
      ctx.sessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: SessionLifecycleState.ACTIVE
      });
      ctx.sessionManager.pause = vi.fn().mockResolvedValue({ success: true, state: 'paused' });

      const result = await handlePause(ctx, { sessionId: 'test-session' });
      const payload = JSON.parse(result.content[0].text);

      expect(payload.success).toBe(true);
      expect(payload.state).toBe('paused');
    });

    it('returns success:false when session validation fails', async () => {
      ctx.sessionManager.pause = vi.fn().mockRejectedValue(new Error('some pause error'));
      ctx.sessionManager.getSession.mockReturnValue(null);

      const result = await handlePause(ctx, { sessionId: 'test-session' });
      const payload = JSON.parse(result.content[0].text);

      expect(payload.success).toBe(false);
      expect(payload.error).toContain('Session not found: test-session');
    });

    it('converts SessionTerminatedError into a success:false result', async () => {
      ctx.sessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: SessionLifecycleState.ACTIVE
      });
      ctx.sessionManager.pause = vi.fn().mockRejectedValue(new SessionTerminatedError('test-session'));

      const result = await handlePause(ctx, { sessionId: 'test-session' });
      const payload = JSON.parse(result.content[0].text);

      expect(payload.success).toBe(false);
      expect(payload.error).toContain('Session is terminated: test-session');
    });

    it('converts ProxyNotRunningError into a success:false result', async () => {
      ctx.sessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: SessionLifecycleState.ACTIVE
      });
      ctx.sessionManager.pause = vi.fn().mockRejectedValue(new ProxyNotRunningError('test-session', 'pause execution'));

      const result = await handlePause(ctx, { sessionId: 'test-session' });
      const payload = JSON.parse(result.content[0].text);

      expect(payload.success).toBe(false);
      expect(payload.error).toContain('test-session');
    });

    it('wraps generic errors as McpError', async () => {
      ctx.sessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: SessionLifecycleState.ACTIVE
      });
      ctx.sessionManager.pause = vi.fn().mockRejectedValue(new Error('unexpected'));

      await expect(handlePause(ctx, { sessionId: 'test-session' }))
        .rejects.toThrow('Failed to pause execution');
    });
  });
});
