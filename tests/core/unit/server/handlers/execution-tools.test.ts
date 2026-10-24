/**
 * Execution-control tool handlers (pause_execution, list_threads), driven
 * directly against a ToolContext. (Moved out of
 * tests/unit/server-coverage.test.ts, which reached them through private
 * DebugMcpServer delegates that no longer exist.)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JsDebugAdapterPolicy, SessionLifecycleState } from '@debugmcp/shared';
import {
  handlePause,
  handleListThreads,
  stepTool,
  continueExecutionTool,
  waitForStopTool
} from '../../../../../src/server/handlers/execution-tools.js';
import {
  SessionNotFoundError,
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

  describe('waitForStopTool (issue #849)', () => {
    const liveSession = { id: 'test-session', sessionLifecycle: SessionLifecycleState.ACTIVE };

    it('hands the timeout and the request signal to the session manager and reports the stop', async () => {
      ctx.sessionManager.getSession.mockReturnValue(liveSession);
      const lastStop = { reason: 'breakpoint', threadId: 1, timestamp: 1_700_000_000_000 };
      ctx.sessionManager.waitForStop.mockResolvedValue({
        success: true,
        state: 'paused',
        data: {
          message: 'Paused (breakpoint) at /app/main.py:12',
          lastStop,
          location: { file: '/app/main.py', line: 12, column: 1 }
        }
      });
      const signal = new AbortController().signal;

      const result = await waitForStopTool(ctx, { sessionId: 'test-session', timeout: 45_000 }, 'wait_for_stop', { signal });
      const payload = JSON.parse(result.content[0].text);

      expect(ctx.sessionManager.waitForStop).toHaveBeenCalledWith('test-session', 45_000, signal);
      expect(payload).toEqual({
        success: true,
        state: 'paused',
        message: 'Paused (breakpoint) at /app/main.py:12',
        lastStop,
        location: { file: '/app/main.py', line: 12, column: 1 }
      });
    });

    it('hoists pending to the top level when the wait ran out', async () => {
      ctx.sessionManager.getSession.mockReturnValue(liveSession);
      ctx.sessionManager.waitForStop.mockResolvedValue({
        success: true,
        state: 'running',
        data: { message: 'The program is still running after 30s with no stop.', pending: true }
      });

      const result = await waitForStopTool(ctx, { sessionId: 'test-session' }, 'wait_for_stop');
      const payload = JSON.parse(result.content[0].text);

      expect(ctx.sessionManager.waitForStop).toHaveBeenCalledWith('test-session', undefined, undefined);
      expect(payload).toEqual({
        success: true,
        state: 'running',
        pending: true,
        message: 'The program is still running after 30s with no stop.'
      });
    });

    it('reports a program that ended, with its exit code', async () => {
      ctx.sessionManager.getSession.mockReturnValue(liveSession);
      ctx.sessionManager.waitForStop.mockResolvedValue({
        success: true,
        state: 'stopped',
        data: { message: 'The program exited with code 3.', exitCode: 3 }
      });

      const result = await waitForStopTool(ctx, { sessionId: 'test-session' }, 'wait_for_stop');

      expect(JSON.parse(result.content[0].text)).toEqual({
        success: true,
        state: 'stopped',
        message: 'The program exited with code 3.',
        exitCode: 3
      });
    });

    it('keeps exit code 0: a clean finish is still an answer', async () => {
      ctx.sessionManager.getSession.mockReturnValue(liveSession);
      ctx.sessionManager.waitForStop.mockResolvedValue({
        success: true,
        state: 'stopped',
        data: { message: 'The program ran to completion (exit code 0).', exitCode: 0 }
      });

      const result = await waitForStopTool(ctx, { sessionId: 'test-session' }, 'wait_for_stop');

      expect(JSON.parse(result.content[0].text).exitCode).toBe(0);
    });

    it('answers for a session whose program has finished instead of refusing it as terminated', async () => {
      ctx.sessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: SessionLifecycleState.TERMINATED
      });
      ctx.sessionManager.waitForStop.mockResolvedValue({
        success: true,
        state: 'stopped',
        data: { message: 'The program ran to completion (exit code 0).', exitCode: 0 }
      });

      const result = await waitForStopTool(ctx, { sessionId: 'test-session' }, 'wait_for_stop');

      expect(JSON.parse(result.content[0].text).success).toBe(true);
      expect(ctx.sessionManager.waitForStop).toHaveBeenCalled();
    });

    it('reports the controller refusal with the state it observed', async () => {
      ctx.sessionManager.getSession.mockReturnValue(liveSession);
      ctx.sessionManager.waitForStop.mockResolvedValue({
        success: false,
        state: 'created',
        error: 'Nothing to wait for: this session has not been started.'
      });

      const result = await waitForStopTool(ctx, { sessionId: 'test-session' }, 'wait_for_stop');

      expect(JSON.parse(result.content[0].text)).toEqual({
        success: false,
        error: 'Nothing to wait for: this session has not been started.',
        state: 'created'
      });
    });

    it('converts an unknown session into a success:false result', async () => {
      ctx.sessionManager.getSession.mockReturnValue(undefined);

      const result = await waitForStopTool(ctx, { sessionId: 'no-such-session' }, 'wait_for_stop');
      const payload = JSON.parse(result.content[0].text);

      expect(payload.success).toBe(false);
      expect(payload.error).toContain('no-such-session');
      expect(ctx.sessionManager.waitForStop).not.toHaveBeenCalled();
    });

    it('converts a session that vanished inside the session layer the same way', async () => {
      ctx.sessionManager.getSession.mockReturnValue(liveSession);
      ctx.sessionManager.waitForStop.mockRejectedValue(new SessionNotFoundError('test-session'));

      const result = await waitForStopTool(ctx, { sessionId: 'test-session' }, 'wait_for_stop');

      expect(JSON.parse(result.content[0].text).success).toBe(false);
    });
  });

  describe('build-staleness note on the stop answers (issue #938)', () => {
    const location = { file: '/app/src/a.ts', line: 3 };
    const evidence = {
      sourceFile: '/app/src/a.ts',
      sourceMtimeMs: 20_000,
      generatedFile: '/app/dist/a.js',
      generatedMtimeMs: 10_000,
      mapFile: '/app/dist/a.js.map'
    };
    /** What the adapter's transform handed the engine for the current launch (issue #950). */
    const launched = { program: '/app/dist/main.js', launchConfig: { program: '/app/dist/main.js' } };
    const answers: Array<[string, (data: Record<string, unknown>) => Promise<{ content: Array<{ text: string }> }>]> = [
      ['step_over', (data) => {
        ctx.sessionManager.stepOver.mockResolvedValue({ success: true, state: 'paused', data });
        return stepTool(ctx, { sessionId: 'test-session' }, 'step_over');
      }],
      ['wait_for_stop', (data) => {
        ctx.sessionManager.waitForStop.mockResolvedValue({ success: true, state: 'paused', data });
        return waitForStopTool(ctx, { sessionId: 'test-session' }, 'wait_for_stop');
      }],
      ['pause_execution', (data) => {
        ctx.sessionManager.pause = vi.fn().mockResolvedValue({ success: true, state: 'paused', data });
        return handlePause(ctx, { sessionId: 'test-session' });
      }]
    ];

    beforeEach(() => {
      ctx.sessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: SessionLifecycleState.ACTIVE,
        transformedLaunch: launched
      });
      ctx.sessionManager.getSessionPolicy.mockReturnValue(JsDebugAdapterPolicy);
      ctx.lineReader = { getLineContext: vi.fn().mockResolvedValue(null) };
    });

    for (const [tool, answer] of answers) {
      it(`${tool} appends the stale-build sentence to its note when the compiled file is older than the source`, async () => {
        ctx.buildStaleness = { check: vi.fn().mockResolvedValue(evidence) };

        const payload = JSON.parse((await answer({ message: 'Paused', location, note: 'existing' })).content[0].text);

        expect(ctx.buildStaleness.check).toHaveBeenCalledWith('/app/src/a.ts', JsDebugAdapterPolicy, launched);
        expect(payload.note).toMatch(/^existing The compiled file .* may be stale/);
      });

      it(`${tool} leaves its note exactly as it was when the build is current`, async () => {
        ctx.buildStaleness = { check: vi.fn().mockResolvedValue(undefined) };

        const payload = JSON.parse((await answer({ message: 'Paused', location, note: 'existing' })).content[0].text);

        expect(payload.note).toBe('existing');
      });

      // A frame whose file is a `<…>` label or an adapter's relative spelling
      // of a source it could not locate (a JDI package path) names no file on
      // this host (issue #951): the location is still reported, but neither
      // the line nor the build is read for it — a relative path would be
      // resolved against the server's cwd.
      for (const file of ['<unknown_source>', 'java/io/PrintStream.java']) {
        it(`${tool} reads neither the line nor the build for a location whose file is not an openable path (${file})`, async () => {
          ctx.buildStaleness = { check: vi.fn().mockResolvedValue(evidence) };

          const payload = JSON.parse((await answer({ message: 'Paused', location: { file, line: 1 } })).content[0].text);

          expect(payload.location).toEqual({ file, line: 1 });
          expect(payload).not.toHaveProperty('context');
          expect(payload).not.toHaveProperty('note');
          expect(ctx.lineReader.getLineContext).not.toHaveBeenCalled();
          expect(ctx.buildStaleness.check).not.toHaveBeenCalled();
        });
      }
    }
  });

  describe('landing fields on the step and wait_for_stop answers (issue #904)', () => {
    const liveSession = { id: 'test-session', sessionLifecycle: SessionLifecycleState.ACTIVE };
    const note = "The stop was reported on thread 20256, whose 4 frames are all internal/runtime (top: 'DbgBreakPoint'); showing thread 15896, which is in 'main'.";
    const location = { file: '/app/main.cpp', line: 21, column: 3 };

    it('step_over hoists threadId and note next to location', async () => {
      ctx.sessionManager.getSession.mockReturnValue(liveSession);
      ctx.sessionManager.stepOver.mockResolvedValue({
        success: true,
        state: 'paused',
        data: { message: 'Stepped over', location, threadId: 15896, note }
      });

      const payload = JSON.parse((await stepTool(ctx, { sessionId: 'test-session' }, 'step_over')).content[0].text);

      expect(payload).toMatchObject({ success: true, state: 'paused', message: 'Stepped over', location, threadId: 15896, note });
    });

    it('wait_for_stop hoists threadId and note next to location', async () => {
      ctx.sessionManager.getSession.mockReturnValue(liveSession);
      const lastStop = { reason: 'pause', rawReason: 'exception', threadId: 20256, timestamp: 1_700_000_000_000 };
      ctx.sessionManager.waitForStop.mockResolvedValue({
        success: true,
        state: 'paused',
        data: { message: 'Paused (pause) at /app/main.cpp:21', lastStop, location, threadId: 15896, note }
      });

      const payload = JSON.parse((await waitForStopTool(ctx, { sessionId: 'test-session' }, 'wait_for_stop')).content[0].text);

      expect(payload).toMatchObject({ success: true, state: 'paused', lastStop, location, threadId: 15896, note });
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

    it('surfaces the controller wording and stopReason when a breakpoint, not the step, ended the step (issue #678)', async () => {
      ctx.sessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: SessionLifecycleState.ACTIVE
      });
      ctx.sessionManager.stepOver.mockResolvedValue({
        success: true,
        state: 'paused',
        data: {
          message: "Stepped over; stopped on 'breakpoint' rather than on the step itself (see stopReason).",
          stopReason: 'breakpoint',
          location: { file: '/app/node_modules/router/index.js', line: 160, column: 16 }
        }
      });

      const result = await stepTool(ctx, { sessionId: 'test-session' }, 'step_over');
      const payload = JSON.parse(result.content[0].text);

      expect(payload.success).toBe(true);
      expect(payload.message).toBe("Stepped over; stopped on 'breakpoint' rather than on the step itself (see stopReason).");
      expect(payload.stopReason).toBe('breakpoint');
      expect(payload.location).toEqual({ file: '/app/node_modules/router/index.js', line: 160, column: 16 });
      expect(payload.pending).toBeUndefined();
    });

    it('passes the controller wording through alongside a non-interrupting stopReason (issue #678)', async () => {
      ctx.sessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: SessionLifecycleState.ACTIVE
      });
      ctx.sessionManager.stepOver.mockResolvedValue({
        success: true,
        state: 'paused',
        data: { message: 'Stepped over', stopReason: 'pause' }
      });

      const result = await stepTool(ctx, { sessionId: 'test-session' }, 'step_over');
      const payload = JSON.parse(result.content[0].text);

      expect(payload.message).toBe('Stepped over');
      expect(payload.stopReason).toBe('pause');
    });

    it('passes any controller message through: the controller owns the step wording (issue #678 review)', async () => {
      ctx.sessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: SessionLifecycleState.ACTIVE
      });
      ctx.sessionManager.stepInto.mockResolvedValue({
        success: true,
        state: 'paused',
        data: { message: 'Stepped into', location: { file: '/app/main.py', line: 3, column: 1 } }
      });

      const result = await stepTool(ctx, { sessionId: 'test-session' }, 'step_into');
      const payload = JSON.parse(result.content[0].text);

      expect(payload.message).toBe('Stepped into');
      expect(payload.location).toEqual({ file: '/app/main.py', line: 3, column: 1 });
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

    it('hoists pending to the top level and keeps data whole (issue #906)', async () => {
      ctx.sessionManager.getSession.mockReturnValue({ id: 'test-session', sessionLifecycle: SessionLifecycleState.ACTIVE });
      ctx.sessionManager.pause = vi.fn().mockResolvedValue({
        success: true,
        state: 'running',
        data: { message: 'Pause requested; no stopped event within 5s.', pending: true }
      });

      const payload = JSON.parse((await handlePause(ctx, { sessionId: 'test-session' })).content[0].text);

      expect(payload.pending).toBe(true);
      expect(payload.message).toBe('Pause requested; no stopped event within 5s.');
      expect(payload.data).toEqual({ message: 'Pause requested; no stopped event within 5s.', pending: true });
      expect(payload).not.toHaveProperty('location');
    });

    it('hoists the stop reason, location, threadId and note, and reads the line context (issue #906)', async () => {
      ctx.sessionManager.getSession.mockReturnValue({ id: 'test-session', sessionLifecycle: SessionLifecycleState.ACTIVE });
      ctx.sessionManager.pause = vi.fn().mockResolvedValue({
        success: true,
        state: 'paused',
        data: {
          message: 'Paused',
          stopReason: 'pause',
          rawStopReason: 'exception',
          location: { file: '/app/main.cpp', line: 20, column: 3 },
          threadId: 45324,
          note: 'The stop was reported on thread 31208; showing thread 45324.'
        }
      });
      ctx.lineReader = { getLineContext: vi.fn().mockResolvedValue({ lineContent: 'sleep(1);', surrounding: [] }) };

      const payload = JSON.parse((await handlePause(ctx, { sessionId: 'test-session' })).content[0].text);

      expect(payload).toMatchObject({
        success: true,
        state: 'paused',
        message: 'Paused',
        stopReason: 'pause',
        rawStopReason: 'exception',
        location: { file: '/app/main.cpp', line: 20, column: 3 },
        threadId: 45324,
        note: 'The stop was reported on thread 31208; showing thread 45324.',
        context: { lineContent: 'sleep(1);', surrounding: [] }
      });
      expect(payload).not.toHaveProperty('pending');
      expect(ctx.lineReader.getLineContext).toHaveBeenCalledWith('/app/main.cpp', 20, { contextLines: 2 });
      expect(payload.data.location).toEqual({ file: '/app/main.cpp', line: 20, column: 3 });
    });

    it('returns a failed pause as the controller reported it', async () => {
      ctx.sessionManager.getSession.mockReturnValue({ id: 'test-session', sessionLifecycle: SessionLifecycleState.ACTIVE });
      ctx.sessionManager.pause = vi.fn().mockResolvedValue({ success: false, state: 'running', error: 'Cannot pause in state: running' });

      const payload = JSON.parse((await handlePause(ctx, { sessionId: 'test-session' })).content[0].text);

      expect(payload).toEqual({ success: false, state: 'running', error: 'Cannot pause in state: running' });
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

describe('stop snapshot hoisting (issue #982)', () => {
  let ctx: any;
  const liveSession = { id: 'test-session', sessionLifecycle: SessionLifecycleState.ACTIVE };
  const snapshot = {
    frames: [{ name: 'main', file: '/app/main.py', line: 12 }],
    locals: { x: '1' }
  };

  beforeEach(() => {
    ctx = createMockToolContext();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('wait_for_stop hoists the snapshot to the top level', async () => {
    ctx.sessionManager.getSession.mockReturnValue(liveSession);
    ctx.sessionManager.waitForStop.mockResolvedValue({
      success: true,
      state: 'paused',
      data: {
        message: 'Paused (breakpoint) at /app/main.py:12',
        lastStop: { reason: 'breakpoint', threadId: 1, timestamp: 1 },
        location: { file: '/app/main.py', line: 12, column: 1 },
        snapshot
      }
    });

    const result = await waitForStopTool(ctx, { sessionId: 'test-session' }, 'wait_for_stop');
    const payload = JSON.parse(result.content[0].text);

    expect(payload.snapshot).toEqual(snapshot);
    expect(payload).not.toHaveProperty('data');
  });

  it('pause_execution hoists the snapshot and strips it from the embedded data', async () => {
    ctx.sessionManager.getSession.mockReturnValue(liveSession);
    ctx.sessionManager.pause = vi.fn().mockResolvedValue({
      success: true,
      state: 'paused',
      data: {
        message: 'Paused',
        stopReason: 'pause',
        location: { file: '/app/main.py', line: 12, column: 1 },
        snapshot
      }
    });

    const result = await handlePause(ctx, { sessionId: 'test-session' });
    const payload = JSON.parse(result.content[0].text);

    expect(payload.snapshot).toEqual(snapshot);
    expect(payload.data).not.toHaveProperty('snapshot');
    expect(payload.data.message).toBe('Paused');
  });
});
