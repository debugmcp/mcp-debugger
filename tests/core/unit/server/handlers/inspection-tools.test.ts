/**
 * Inspection tool handlers (evaluate_expression, get_source_context,
 * get_local_variables), driven directly against a ToolContext. (Moved out of
 * tests/unit/server-coverage.test.ts, which reached them through private
 * DebugMcpServer delegates that no longer exist.)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProtocolError, ProtocolErrorCode } from '@modelcontextprotocol/server';
import { DotnetAdapterPolicy, SessionLifecycleState } from '@debugmcp/shared';
import {
  getScopesTool,
  getStackTraceTool,
  getVariablesTool,
  handleEvaluateExpression,
  handleGetSourceContext,
  handleGetLocalVariables
} from '../../../../../src/server/handlers/inspection-tools.js';
import { SessionNotFoundError, SessionTerminatedError } from '../../../../../src/errors/debug-errors.js';
import { ErrorMessages } from '../../../../../src/utils/error-messages.js';
import { createMockToolContext } from '../server-test-helpers.js';

// DebugMcpServer builds its dependencies in the constructor; mock the container
// so createMockToolContext() never opens a real logger transport or session dir.
vi.mock('../../../../../src/container/dependencies.js');
vi.mock('../../../../../src/session/session-manager.js');

describe('inspection tool handlers', () => {
  let ctx: any;

  beforeEach(() => {
    ctx = createMockToolContext();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('get_stack_trace carries the stale-build note for its top frame (issue #951)', () => {
    /** What the adapter's transform handed the engine for the current launch (issue #950). */
    const launched = { program: '/app/bin/app.dll', launchConfig: { program: '/app/bin/app.dll' } };
    const evidence = {
      sourceFile: '/app/Program.cs',
      sourceMtimeMs: 20_000,
      generatedFile: '/app/bin/app.dll',
      generatedMtimeMs: 10_000,
      linkedBy: 'launch' as const
    };
    const programFrame = { id: 1, name: 'HelloWorld.Add', file: '/app/Program.cs', line: 8, column: 0 };
    const callerFrame = { id: 2, name: 'HelloWorld.Main', file: '/app/Program.cs', line: 17, column: 0 };

    function stackOf(frames: Array<Record<string, unknown>>, extra: Record<string, unknown> = {}) {
      ctx.getStackTrace = vi.fn().mockResolvedValue({
        frames,
        threadId: 1,
        totalFrameCount: frames.length,
        hiddenFrameCount: 0,
        allFramesInternal: false,
        ...extra
      });
    }

    async function getStackTrace() {
      const result = await getStackTraceTool(ctx, { sessionId: 'test-session' }, 'get_stack_trace');
      return JSON.parse(result.content[0].text);
    }

    beforeEach(() => {
      ctx.sessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: SessionLifecycleState.ACTIVE,
        state: 'paused',
        transformedLaunch: launched
      });
      ctx.sessionManager.getSessionPolicy.mockReturnValue(DotnetAdapterPolicy);
      ctx.buildStaleness = { check: vi.fn().mockResolvedValue(evidence) };
    });

    it('appends the sentence when the file of the top frame is newer than the artefact the launch runs', async () => {
      stackOf([programFrame, callerFrame]);

      const payload = await getStackTrace();

      expect(payload.success).toBe(true);
      expect(payload.count).toBe(2);
      expect(ctx.buildStaleness.check).toHaveBeenCalledTimes(1);
      expect(ctx.buildStaleness.check).toHaveBeenCalledWith('/app/Program.cs', DotnetAdapterPolicy, launched);
      expect(payload.note).toMatch(/^The compiled file .* may be stale/);
      expect(payload.note).toContain('/app/bin/app.dll');
    });

    it('puts the sentence after the notes the stack itself needed', async () => {
      stackOf([programFrame], { hiddenFrameCount: 2, totalFrameCount: 3 });

      const payload = await getStackTrace();

      expect(payload.hiddenFrames).toBe(2);
      expect(payload.note).toMatch(/^2 internal frame\(s\) hidden — pass includeInternals: true to see them\. The compiled file .* may be stale/);
    });

    it('carries no note when the build is current', async () => {
      ctx.buildStaleness = { check: vi.fn().mockResolvedValue(undefined) };
      stackOf([programFrame]);

      const payload = await getStackTrace();

      expect(ctx.buildStaleness.check).toHaveBeenCalledWith('/app/Program.cs', DotnetAdapterPolicy, launched);
      expect(payload).not.toHaveProperty('note');
    });

    it('does not probe a top frame whose file is a label rather than a path', async () => {
      stackOf([{ id: 1, name: 'idle', file: '<unknown_source>', line: 0, column: 0 }]);

      const payload = await getStackTrace();

      expect(ctx.buildStaleness.check).not.toHaveBeenCalled();
      expect(payload.note ?? '').not.toMatch(/may be stale/);
    });

    it('does not probe a top frame with no openable source on this host', async () => {
      stackOf([{ ...programFrame, file: '../src/Program.cs', unresolvedSource: true }]);

      const payload = await getStackTrace();

      expect(ctx.buildStaleness.check).not.toHaveBeenCalled();
      expect(payload.note).toMatch(/unresolvedSource: true/);
      expect(payload.note).not.toMatch(/may be stale/);
    });

    it('probes nothing for an empty stack', async () => {
      stackOf([]);

      const payload = await getStackTrace();

      expect(payload.count).toBe(0);
      expect(ctx.buildStaleness.check).not.toHaveBeenCalled();
    });
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
      expect(payload.message).toBeUndefined();
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

    it('says why no frame is available while the launch runs with the debugger off (issue #749)', async () => {
      ctx.sessionManager.getSession.mockReturnValue({
        id: 'test-session',
        state: 'running',
        sessionLifecycle: 'ACTIVE',
        launchDebuggerOff: true
      });
      ctx.sessionManager.getLocalVariables.mockResolvedValue({
        variables: [],
        frame: null,
        scopeName: null
      });

      const result = await handleGetLocalVariables(ctx, { sessionId: 'test-session' });
      const payload = JSON.parse(result.content[0].text);

      expect(payload.success).toBe(true);
      expect(payload.message).toContain('No stack frames available');
      expect(payload.message).toContain(ErrorMessages.debuggerOffForLaunch);
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

    it('does not classify an untyped McpError from its message text', async () => {
      ctx.validateSession = vi.fn().mockImplementation(() => {
        throw new ProtocolError(ProtocolErrorCode.InvalidRequest, 'Session is not paused');
      });

      await expect(handleGetLocalVariables(ctx, {
        sessionId: 'test-session'
      })).rejects.toThrow('Session is not paused');
    });

    it('explains a terminated session as a normal end state (program finished)', async () => {
      ctx.validateSession = vi.fn().mockImplementation(() => {
        throw new SessionTerminatedError('test-session');
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

    it('returns graceful error for terminated session', async () => {
      ctx.sessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: SessionLifecycleState.ACTIVE,
        name: 'my-session'
      });

      ctx.sessionManager.getLocalVariables = vi.fn().mockRejectedValue(
        new SessionTerminatedError('test-session')
      );

      const result = await handleGetLocalVariables(ctx, {
        sessionId: 'test-session'
      });

      const payload = JSON.parse(result.content[0].text);
      expect(payload.success).toBe(false);
      expect(payload.error).toContain('terminated');
    });
  });

  describe('get_stack_trace emits a redacted lastStop (issue #982)', () => {
  it('serializes the stop record AFTER the stack fetch, so an exceptionInfo merge landing during it is included', async () => {
    const stored: Record<string, unknown> = {
      reason: 'exception',
      threadId: 1,
      timestamp: 1,
      description: 'AuthError',
      text: 'bad token'
    };
    ctx.sessionManager.getSession.mockReturnValue({
      id: 'test-session',
      sessionLifecycle: SessionLifecycleState.ACTIVE,
      state: 'paused',
      lastStop: stored
    });
    ctx.getStackTrace = vi.fn().mockImplementation(async () => {
      // The fire-and-forget enrichment merges in place during the fetch.
      stored.exceptionInfo = { exceptionId: 'AuthError', breakMode: 'unhandled' };
      return { frames: [], threadId: 1, totalFrameCount: 0, hiddenFrameCount: 0, allFramesInternal: false };
    });

    const result = await getStackTraceTool(ctx, { sessionId: 'test-session' }, 'get_stack_trace');
    const payload = JSON.parse(result.content[0].text);

    expect(payload.lastStop.exceptionInfo).toBeDefined();
    expect(payload.lastStop.exceptionInfo.exceptionId).toBe('AuthError');
  });


    const SECRET = 'ghp_' + 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef0123';

    it('masks secret-shaped values in the emitted stop record and leaves the stored one raw', async () => {
      const stored = {
        reason: 'exception',
        threadId: 1,
        timestamp: 1,
        description: 'AuthError',
        text: `token ${SECRET} rejected`
      };
      ctx.sessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: SessionLifecycleState.ACTIVE,
        state: 'paused',
        lastStop: stored
      });
      ctx.getStackTrace = vi.fn().mockResolvedValue({
        frames: [],
        threadId: 1,
        totalFrameCount: 0,
        hiddenFrameCount: 0,
        allFramesInternal: false
      });

      const result = await getStackTraceTool(ctx, { sessionId: 'test-session' }, 'get_stack_trace');
      const payload = JSON.parse(result.content[0].text);

      expect(payload.lastStop.text).toContain('<redacted:github-pat>');
      expect(payload.lastStop.text).not.toContain(SECRET);
      expect(payload.stopReason).toBe('exception');
      expect(stored.text).toContain(SECRET);
    });
  });

  describe('an ended session is explained by every inspection tool, in terms of what the session is (issue #1141)', () => {
    const ENDED = 'Session is terminated: test-session';
    const LAUNCH_SENTENCE =
      'The program has terminated, so no frames or variables exist. Use restart_debugging to run it again.';

    /** Each inspection tool, called on a session whose gate throws the terminated error. */
    const TOOLS: Array<[string, () => Promise<{ content: [{ text: string }] }>]> = [
      ['get_stack_trace', () => getStackTraceTool(ctx, { sessionId: 'test-session' }, 'get_stack_trace')],
      ['get_scopes', () => getScopesTool(ctx, { sessionId: 'test-session', frameId: 1 }, 'get_scopes')],
      ['get_variables', () => getVariablesTool(ctx, { sessionId: 'test-session', scope: 7 }, 'get_variables')],
      ['evaluate_expression', () => handleEvaluateExpression(ctx, { sessionId: 'test-session', expression: 'x' })],
      ['get_local_variables', () => handleGetLocalVariables(ctx, { sessionId: 'test-session' })]
    ];

    function endedSession(session: Record<string, unknown>): void {
      ctx.sessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: SessionLifecycleState.TERMINATED,
        state: 'stopped',
        ...session
      });
      const terminated = () => { throw new SessionTerminatedError('test-session'); };
      ctx.validateSession = vi.fn().mockImplementation(terminated);
      ctx.getStackTrace = vi.fn().mockImplementation(async () => terminated());
      ctx.getScopes = vi.fn().mockImplementation(async () => terminated());
      ctx.getVariablesDetailed = vi.fn().mockImplementation(async () => terminated());
      ctx.getLocalVariables = vi.fn().mockImplementation(async () => terminated());
    }

    it.each(TOOLS)('%s: a launched program that ended points at restart_debugging', async (_name, call) => {
      endedSession({ lastLaunch: { scriptPath: '/app/main.py' } });

      const payload = JSON.parse((await call()).content[0].text);

      expect(payload.success).toBe(false);
      // The error text is unchanged: callers and tests match on it.
      expect(payload.error).toBe(ENDED);
      expect(payload.message).toBe(LAUNCH_SENTENCE);
    });

    it.each(TOOLS)('%s: an attach session points at attach_to_process, never at a restart it would be refused', async (_name, call) => {
      endedSession({ attachMode: true });

      const payload = JSON.parse((await call()).content[0].text);

      expect(payload.error).toBe(ENDED);
      expect(payload.message).toBe(
        'The debugger is no longer attached to the target (it ended, or was detached), so no frames or variables exist. ' +
        'Use attach_to_process to attach again.'
      );
      expect(payload.message).not.toContain('restart_debugging');
    });

    it.each(TOOLS)('%s: a child session names its parent', async (_name, call) => {
      // A child of an attach root: the child rule wins, whatever else the row carries.
      endedSession({ parentSessionId: 'parent-1', attachMode: true });

      const payload = JSON.parse((await call()).content[0].text);

      expect(payload.error).toBe(ENDED);
      expect(payload.message).toBe(
        'The process this child session debugged has ended or was released, so no frames or variables exist. ' +
        'A child session cannot be restarted on its own: its parent is parent-1.'
      );
    });

    it('keeps the launch wording when the session row cannot be read', async () => {
      endedSession({});
      ctx.sessionManager.getSession.mockReturnValue(undefined);

      const payload = JSON.parse((await getStackTraceTool(ctx, { sessionId: 'test-session' }, 'get_stack_trace')).content[0].text);

      expect(payload.message).toBe(LAUNCH_SENTENCE);
    });

    it('get_stack_trace keeps its failure diagnostics beside the sentence', async () => {
      endedSession({ failureDiagnostics: { proxyLogPath: '/logs/proxy.log' } });

      const payload = JSON.parse((await getStackTraceTool(ctx, { sessionId: 'test-session' }, 'get_stack_trace')).content[0].text);

      expect(payload.diagnostics).toEqual({ proxyLogPath: '/logs/proxy.log' });
      expect(payload.message).toBe(LAUNCH_SENTENCE);
    });

    it('adds nothing for a session that is merely unknown', async () => {
      ctx.getStackTrace = vi.fn().mockRejectedValue(new SessionNotFoundError('nope'));

      const payload = JSON.parse((await getStackTraceTool(ctx, { sessionId: 'nope' }, 'get_stack_trace')).content[0].text);

      expect(payload).toEqual({ success: false, error: 'Session not found: nope' });
    });
  });
});

