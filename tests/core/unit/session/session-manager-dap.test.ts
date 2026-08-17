/**
 * SessionManager DAP operations tests
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionManager, SessionManagerConfig } from '../../../../src/session/session-manager.js';
import { DebugLanguage, SessionState, RustAdapterPolicy } from '@debugmcp/shared';
import { createMockDependencies } from './session-manager-test-utils.js';
import { ErrorMessages } from '../../../../src/utils/error-messages.js';
import { ProxyNotRunningError } from '../../../../src/errors/debug-errors.js';

describe('SessionManager - DAP Operations', () => {
  let sessionManager: SessionManager;
  let dependencies: ReturnType<typeof createMockDependencies>;
  let config: SessionManagerConfig;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    dependencies = createMockDependencies();
    config = {
      logDirBase: '/tmp/test-sessions',
      defaultDapLaunchArgs: {
        stopOnEntry: true,
        justMyCode: true
      }
    };
    
    sessionManager = new SessionManager(config, dependencies);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    dependencies.mockProxyManager.reset();
  });

  async function createPausedSession() {
    const session = await sessionManager.createSession({ 
      language: DebugLanguage.MOCK,
      executablePath: 'python'
    });
    
    await sessionManager.startDebugging(session.id, 'test.py');
    await vi.runAllTimersAsync();
    
    // Simulate being paused with a thread ID
    dependencies.mockProxyManager.simulateStopped(1, 'entry');
    
    // Clear previous calls
    dependencies.mockProxyManager.dapRequestCalls = [];
    
    return session;
  }

  describe('Breakpoint Management', () => {
    it('should queue breakpoints before session starts', async () => {
      const session = await sessionManager.createSession({ 
        language: DebugLanguage.MOCK,
        executablePath: 'python'
      });
      
      const { breakpoint: bp1 } = await sessionManager.setBreakpoint(session.id, { file: 'test.py', line: 10 });
      const { breakpoint: bp2 } = await sessionManager.setBreakpoint(session.id, { file: 'test.py', line: 20 });
      
      expect(bp1.verified).toBe(false);
      expect(bp2.verified).toBe(false);
      
      const managedSession = sessionManager.getSession(session.id);
      expect(managedSession?.breakpoints.size).toBe(2);
    });

    it('should send breakpoints to active session', async () => {
      const session = await sessionManager.createSession({ 
        language: DebugLanguage.MOCK,
        executablePath: 'python'
      });
      
      // Start debugging first
      await sessionManager.startDebugging(session.id, 'test.py');
      await vi.runAllTimersAsync();
      
      // Clear previous calls
      dependencies.mockProxyManager.dapRequestCalls = [];
      
      // Set breakpoint on active session
      const { breakpoint: bp } = await sessionManager.setBreakpoint(session.id, { file: 'test.py', line: 15 });
      
      // Should be verified immediately
      expect(bp.verified).toBe(true);
      expect(dependencies.mockProxyManager.dapRequestCalls).toHaveLength(1);
      expect(dependencies.mockProxyManager.dapRequestCalls[0]).toMatchObject({
        command: 'setBreakpoints',
        args: expect.objectContaining({
          source: { path: expect.stringContaining('test.py') }
        })
      });
    });

    it('should handle conditional breakpoints', async () => {
      const session = await sessionManager.createSession({ 
        language: DebugLanguage.MOCK,
        executablePath: 'python'
      });
      
      await sessionManager.startDebugging(session.id, 'test.py');
      await vi.runAllTimersAsync();
      
      dependencies.mockProxyManager.dapRequestCalls = [];
      
      const { breakpoint: bp } = await sessionManager.setBreakpoint(
        session.id,
        { file: 'test.py', line: 25, condition: 'x > 10' }
      );
      
      expect(bp.condition).toBe('x > 10');
      expect(dependencies.mockProxyManager.dapRequestCalls[0].args.breakpoints[0]).toMatchObject({
        line: 25,
        condition: 'x > 10'
      });
    });

    it('captures the adapter-assigned breakpoint id from the setBreakpoints response', async () => {
      const session = await sessionManager.createSession({
        language: DebugLanguage.MOCK,
        executablePath: 'python'
      });

      await sessionManager.startDebugging(session.id, 'test.py');
      await vi.runAllTimersAsync();

      dependencies.mockProxyManager.setDapRequestHandler(async (command, args) => {
        if (command === 'setBreakpoints') {
          return {
            success: true,
            body: {
              breakpoints: args?.breakpoints?.map((bp: { line: number }, i: number) => ({
                id: 55 + i,
                verified: true,
                line: bp.line
              })) || []
            }
          };
        }
        return { success: true };
      });

      const { breakpoint: bp } = await sessionManager.setBreakpoint(session.id, { file: 'test.py', line: 15 });

      expect(bp.verified).toBe(true);
      expect(bp.adapterId).toBe(55);
    });
  });

  describe('logpoints (logMessage)', () => {
    it('stores logMessage and sends it on the live setBreakpoints path', async () => {
      const session = await sessionManager.createSession({
        language: DebugLanguage.MOCK,
        executablePath: 'python'
      });
      await sessionManager.startDebugging(session.id, 'test.py');
      await vi.runAllTimersAsync();
      dependencies.mockProxyManager.dapRequestCalls = [];

      const { breakpoint: bp } = await sessionManager.setBreakpoint(
        session.id, { file: 'test.py', line: 20, logMessage: 'value is {x}' }
      );

      expect(bp.logMessage).toBe('value is {x}');
      expect(dependencies.mockProxyManager.dapRequestCalls[0].args.breakpoints[0]).toMatchObject({
        line: 20,
        logMessage: 'value is {x}'
      });
      const [listed] = sessionManager.listBreakpoints(session.id);
      expect(listed.logMessage).toBe('value is {x}');
    });

    it('carries logMessage and suspendPolicy into the launch-time initialBreakpoints snapshot', async () => {
      const session = await sessionManager.createSession({
        language: DebugLanguage.MOCK,
        executablePath: 'python'
      });

      await sessionManager.setBreakpoint(
        session.id,
        { file: 'test.py', line: 20, condition: 'x > 1', suspendPolicy: 'thread', logMessage: 'value is {x}' }
      );
      await sessionManager.startDebugging(session.id, 'test.py');
      await vi.runAllTimersAsync();

      const startConfig = dependencies.mockProxyManager.startCalls[0];
      expect(startConfig.initialBreakpoints).toEqual([
        expect.objectContaining({
          file: 'test.py',
          line: 20,
          condition: 'x > 1',
          suspendPolicy: 'thread',
          logMessage: 'value is {x}'
        })
      ]);
    });

    it('allows condition and logMessage together', async () => {
      const session = await sessionManager.createSession({
        language: DebugLanguage.MOCK,
        executablePath: 'python'
      });
      await sessionManager.startDebugging(session.id, 'test.py');
      await vi.runAllTimersAsync();
      dependencies.mockProxyManager.dapRequestCalls = [];

      await sessionManager.setBreakpoint(
        session.id, { file: 'test.py', line: 21, condition: 'x > 5', logMessage: 'big x: {x}' }
      );

      expect(dependencies.mockProxyManager.dapRequestCalls[0].args.breakpoints[0]).toMatchObject({
        line: 21,
        condition: 'x > 5',
        logMessage: 'big x: {x}'
      });
    });
  });

  describe('launch-time breakpoint verification sync', () => {
    // Breakpoints queued before start_debugging are sent by the proxy worker
    // as initialBreakpoints, but that path's setBreakpoints responses never
    // reach the session store. After a successful launch the SessionManager
    // re-syncs each breakpoint file so the store learns verified/adapterId.
    it('marks pre-launch breakpoints verified in the store once the launch completes', async () => {
      const session = await sessionManager.createSession({
        language: DebugLanguage.MOCK,
        executablePath: 'python'
      });

      const { breakpoint: bp } = await sessionManager.setBreakpoint(session.id, { file: 'test.py', line: 10 });
      expect(bp.verified).toBe(false);

      await sessionManager.startDebugging(session.id, 'test.py');
      await vi.runAllTimersAsync();

      const [stored] = sessionManager.listBreakpoints(session.id);
      expect(stored.verified).toBe(true);
    });
  });

  describe('listBreakpoints', () => {
    it('lists queued breakpoints sorted by file then line before launch', async () => {
      const session = await sessionManager.createSession({
        language: DebugLanguage.MOCK,
        executablePath: 'python'
      });

      await sessionManager.setBreakpoint(session.id, { file: 'b.py', line: 20 });
      await sessionManager.setBreakpoint(session.id, { file: 'a.py', line: 30 });
      await sessionManager.setBreakpoint(session.id, { file: 'a.py', line: 10 });

      const breakpoints = sessionManager.listBreakpoints(session.id);

      expect(breakpoints.map(bp => `${bp.file}:${bp.line}`)).toEqual([
        'a.py:10',
        'a.py:30',
        'b.py:20'
      ]);
      expect(breakpoints.every(bp => bp.verified === false)).toBe(true);
      expect(breakpoints.every(bp => typeof bp.id === 'string')).toBe(true);
    });

    it('filters by file when one is given', async () => {
      const session = await sessionManager.createSession({
        language: DebugLanguage.MOCK,
        executablePath: 'python'
      });

      await sessionManager.setBreakpoint(session.id, { file: 'a.py', line: 10 });
      await sessionManager.setBreakpoint(session.id, { file: 'b.py', line: 20 });

      const breakpoints = sessionManager.listBreakpoints(session.id, 'b.py');

      expect(breakpoints).toHaveLength(1);
      expect(breakpoints[0].file).toBe('b.py');
    });
  });

  describe('removeBreakpoint', () => {
    it('removes a queued breakpoint without any DAP traffic', async () => {
      const session = await sessionManager.createSession({
        language: DebugLanguage.MOCK,
        executablePath: 'python'
      });

      const { breakpoint: bp1 } = await sessionManager.setBreakpoint(session.id, { file: 'test.py', line: 10 });
      await sessionManager.setBreakpoint(session.id, { file: 'test.py', line: 20 });

      const result = await sessionManager.removeBreakpoint(session.id, bp1.id);

      expect(result.removed?.id).toBe(bp1.id);
      expect(sessionManager.listBreakpoints(session.id)).toHaveLength(1);
      expect(dependencies.mockProxyManager.dapRequestCalls).toHaveLength(0);
    });

    it('re-sends the remaining per-file set when removing while live', async () => {
      const session = await sessionManager.createSession({
        language: DebugLanguage.MOCK,
        executablePath: 'python'
      });
      await sessionManager.startDebugging(session.id, 'test.py');
      await vi.runAllTimersAsync();

      const { breakpoint: bp1 } = await sessionManager.setBreakpoint(session.id, { file: 'test.py', line: 10 });
      await sessionManager.setBreakpoint(session.id, { file: 'test.py', line: 20 });
      dependencies.mockProxyManager.dapRequestCalls = [];

      const result = await sessionManager.removeBreakpoint(session.id, bp1.id);

      expect(result.removed?.id).toBe(bp1.id);
      expect(dependencies.mockProxyManager.dapRequestCalls).toHaveLength(1);
      expect(dependencies.mockProxyManager.dapRequestCalls[0]).toMatchObject({
        command: 'setBreakpoints',
        args: expect.objectContaining({
          breakpoints: [expect.objectContaining({ line: 20 })]
        })
      });
    });

    it('sends an empty array when the last breakpoint in a file is removed', async () => {
      const session = await sessionManager.createSession({
        language: DebugLanguage.MOCK,
        executablePath: 'python'
      });
      await sessionManager.startDebugging(session.id, 'test.py');
      await vi.runAllTimersAsync();

      const { breakpoint: bp } = await sessionManager.setBreakpoint(session.id, { file: 'test.py', line: 10 });
      dependencies.mockProxyManager.dapRequestCalls = [];

      await sessionManager.removeBreakpoint(session.id, bp.id);

      expect(dependencies.mockProxyManager.dapRequestCalls[0]).toMatchObject({
        command: 'setBreakpoints',
        args: expect.objectContaining({ breakpoints: [] })
      });
      expect(sessionManager.listBreakpoints(session.id)).toHaveLength(0);
    });

    it('returns no removed breakpoint for an unknown id', async () => {
      const session = await sessionManager.createSession({
        language: DebugLanguage.MOCK,
        executablePath: 'python'
      });

      const result = await sessionManager.removeBreakpoint(session.id, 'no-such-id');

      expect(result.removed).toBeUndefined();
    });
  });

  describe('removeBreakpointsByLocation', () => {
    it('removes every breakpoint at the given file and line', async () => {
      const session = await sessionManager.createSession({
        language: DebugLanguage.MOCK,
        executablePath: 'python'
      });

      await sessionManager.setBreakpoint(session.id, { file: 'test.py', line: 10, condition: 'x > 1' });
      await sessionManager.setBreakpoint(session.id, { file: 'test.py', line: 10, condition: 'x > 2' });
      await sessionManager.setBreakpoint(session.id, { file: 'test.py', line: 20 });

      const result = await sessionManager.removeBreakpointsByLocation(session.id, 'test.py', 10);

      expect(result.removed).toHaveLength(2);
      expect(sessionManager.listBreakpoints(session.id).map(bp => bp.line)).toEqual([20]);
    });

    it('removes nothing when no breakpoint exists at the location', async () => {
      const session = await sessionManager.createSession({
        language: DebugLanguage.MOCK,
        executablePath: 'python'
      });

      await sessionManager.setBreakpoint(session.id, { file: 'test.py', line: 10 });

      const result = await sessionManager.removeBreakpointsByLocation(session.id, 'test.py', 99);

      expect(result.removed).toHaveLength(0);
      expect(sessionManager.listBreakpoints(session.id)).toHaveLength(1);
    });
  });

  describe('clearBreakpoints', () => {
    it('clears only the given file and re-sends its (now empty) set while live', async () => {
      const session = await sessionManager.createSession({
        language: DebugLanguage.MOCK,
        executablePath: 'python'
      });
      await sessionManager.startDebugging(session.id, 'test.py');
      await vi.runAllTimersAsync();

      await sessionManager.setBreakpoint(session.id, { file: 'a.py', line: 10 });
      await sessionManager.setBreakpoint(session.id, { file: 'a.py', line: 20 });
      await sessionManager.setBreakpoint(session.id, { file: 'b.py', line: 30 });
      dependencies.mockProxyManager.dapRequestCalls = [];

      const result = await sessionManager.clearBreakpoints(session.id, 'a.py');

      expect(result.cleared).toBe(2);
      expect(result.files).toEqual(['a.py']);
      expect(dependencies.mockProxyManager.dapRequestCalls).toHaveLength(1);
      expect(dependencies.mockProxyManager.dapRequestCalls[0]).toMatchObject({
        command: 'setBreakpoints',
        args: expect.objectContaining({
          source: { path: 'a.py' },
          breakpoints: []
        })
      });
      expect(sessionManager.listBreakpoints(session.id).map(bp => bp.file)).toEqual(['b.py']);
    });

    it('clears every file when no file is given', async () => {
      const session = await sessionManager.createSession({
        language: DebugLanguage.MOCK,
        executablePath: 'python'
      });
      await sessionManager.startDebugging(session.id, 'test.py');
      await vi.runAllTimersAsync();

      await sessionManager.setBreakpoint(session.id, { file: 'a.py', line: 10 });
      await sessionManager.setBreakpoint(session.id, { file: 'b.py', line: 20 });
      dependencies.mockProxyManager.dapRequestCalls = [];

      const result = await sessionManager.clearBreakpoints(session.id);

      expect(result.cleared).toBe(2);
      expect(result.files.sort()).toEqual(['a.py', 'b.py']);
      expect(dependencies.mockProxyManager.dapRequestCalls).toHaveLength(2);
      expect(
        dependencies.mockProxyManager.dapRequestCalls.every(
          call => call.command === 'setBreakpoints' && call.args.breakpoints.length === 0
        )
      ).toBe(true);
      expect(sessionManager.listBreakpoints(session.id)).toHaveLength(0);
    });

    it('reports zero cleared as success with no DAP traffic', async () => {
      const session = await sessionManager.createSession({
        language: DebugLanguage.MOCK,
        executablePath: 'python'
      });

      const result = await sessionManager.clearBreakpoints(session.id);

      expect(result.cleared).toBe(0);
      expect(result.files).toEqual([]);
      expect(dependencies.mockProxyManager.dapRequestCalls).toHaveLength(0);
    });
  });

  describe('breakpoint management after the debuggee exits', () => {
    // Unlike setBreakpoint, list/remove/clear deliberately work in TERMINATED
    // lifecycle: a terminated-but-unclosed session keeps its queued breakpoints
    // so they can be adjusted before a relaunch (restart workflow, issue #238).
    it('lists, removes, and clears store-only once the session is terminated', async () => {
      const session = await sessionManager.createSession({
        language: DebugLanguage.MOCK,
        executablePath: 'python'
      });
      await sessionManager.startDebugging(session.id, 'test.py');
      await vi.runAllTimersAsync();

      const { breakpoint: bp1 } = await sessionManager.setBreakpoint(session.id, { file: 'test.py', line: 10 });
      await sessionManager.setBreakpoint(session.id, { file: 'test.py', line: 20 });

      dependencies.mockProxyManager.simulateEvent('terminated');
      await vi.runAllTimersAsync();
      expect(sessionManager.getSession(session.id)?.sessionLifecycle).toBe('terminated');
      dependencies.mockProxyManager.dapRequestCalls = [];

      expect(sessionManager.listBreakpoints(session.id)).toHaveLength(2);

      const removeResult = await sessionManager.removeBreakpoint(session.id, bp1.id);
      expect(removeResult.removed?.id).toBe(bp1.id);

      const clearResult = await sessionManager.clearBreakpoints(session.id);
      expect(clearResult.cleared).toBe(1);

      expect(dependencies.mockProxyManager.dapRequestCalls).toHaveLength(0);
    });

    it('keeps the store mutation and reports a warning when the live sync fails', async () => {
      const session = await sessionManager.createSession({
        language: DebugLanguage.MOCK,
        executablePath: 'python'
      });
      await sessionManager.startDebugging(session.id, 'test.py');
      await vi.runAllTimersAsync();

      const { breakpoint: bp1 } = await sessionManager.setBreakpoint(session.id, { file: 'test.py', line: 10 });
      await sessionManager.setBreakpoint(session.id, { file: 'test.py', line: 20 });
      dependencies.mockProxyManager.shouldFailDapRequests = true;

      const result = await sessionManager.removeBreakpoint(session.id, bp1.id);

      expect(result.removed?.id).toBe(bp1.id);
      expect(result.warning).toContain('live sync failed');
      expect(sessionManager.listBreakpoints(session.id)).toHaveLength(1);
    });
  });

  describe('DAP breakpoint events', () => {
    async function createSessionWithUnverifiedBp(adapterId?: number) {
      const session = await sessionManager.createSession({
        language: DebugLanguage.MOCK,
        executablePath: 'python'
      });
      await sessionManager.startDebugging(session.id, 'test.py');
      await vi.runAllTimersAsync();

      dependencies.mockProxyManager.setDapRequestHandler(async (command, args) => {
        if (command === 'setBreakpoints') {
          return {
            success: true,
            body: {
              breakpoints: args?.breakpoints?.map((bp: { line: number }) => ({
                ...(adapterId !== undefined ? { id: adapterId } : {}),
                verified: false,
                line: bp.line
              })) || []
            }
          };
        }
        return { success: true };
      });

      const { breakpoint: bp } = await sessionManager.setBreakpoint(session.id, { file: 'test.py', line: 10 });
      expect(bp.verified).toBe(false);
      return { session, bp };
    }

    it('applies deferred verification to the stored breakpoint by adapter id', async () => {
      const { session } = await createSessionWithUnverifiedBp(55);

      dependencies.mockProxyManager.simulateEvent('breakpoint', {
        reason: 'changed',
        breakpoint: { id: 55, verified: true, line: 16 }
      });

      const [stored] = sessionManager.listBreakpoints(session.id);
      expect(stored.verified).toBe(true);
      expect(stored.line).toBe(16);
    });

    it('falls back to file and line matching and adopts the adapter id', async () => {
      const { session } = await createSessionWithUnverifiedBp(undefined);

      dependencies.mockProxyManager.simulateEvent('breakpoint', {
        reason: 'changed',
        breakpoint: { id: 77, verified: true, line: 10, source: { path: 'test.py' } }
      });

      const [stored] = sessionManager.listBreakpoints(session.id);
      expect(stored.verified).toBe(true);
      expect(stored.adapterId).toBe(77);
    });

    it('matches Windows paths case-insensitively (js-debug lowercases drive letters)', async () => {
      const session = await sessionManager.createSession({
        language: DebugLanguage.MOCK,
        executablePath: 'python'
      });
      await sessionManager.startDebugging(session.id, 'C:\\proj\\app.js');
      await vi.runAllTimersAsync();

      dependencies.mockProxyManager.setDapRequestHandler(async (command, args) => {
        if (command === 'setBreakpoints') {
          return {
            success: true,
            body: {
              breakpoints: args?.breakpoints?.map((bp: { line: number }) => ({
                verified: false,
                line: bp.line
              })) || []
            }
          };
        }
        return { success: true };
      });
      const { breakpoint: bp } = await sessionManager.setBreakpoint(session.id, { file: 'C:\\proj\\app.js', line: 9 });
      expect(bp.verified).toBe(false);

      dependencies.mockProxyManager.simulateEvent('breakpoint', {
        reason: 'changed',
        breakpoint: { id: 1, verified: true, line: 9, source: { path: 'c:\\proj\\app.js' } }
      });

      const [stored] = sessionManager.listBreakpoints(session.id);
      expect(stored.verified).toBe(true);
      expect(stored.adapterId).toBe(1);
    });

    it('ignores breakpoint events that match no stored breakpoint', async () => {
      const { session } = await createSessionWithUnverifiedBp(55);

      dependencies.mockProxyManager.simulateEvent('breakpoint', {
        reason: 'changed',
        breakpoint: { id: 999, verified: true, line: 40, source: { path: 'other.py' } }
      });

      const [stored] = sessionManager.listBreakpoints(session.id);
      expect(stored.verified).toBe(false);
      expect(stored.line).toBe(10);
    });
  });

  describe('child-authoritative verified state (js-debug parent/child sessions)', () => {
    // For mirroring policies (javascript), setBreakpoints responses come from
    // the parent session (pessimistic verified:false, parent-space ids) while
    // real verification arrives as breakpoint events carrying child-space ids.
    async function createJsSessionWithChildVerifiedBp() {
      const session = await sessionManager.createSession({
        language: DebugLanguage.JAVASCRIPT,
        executablePath: 'node'
      });

      // The js handshake waits (10s) for a DAP 'initialized' event; satisfy it
      // synchronously. setBreakpoints gets parent-style responses: never
      // verified, parent id space (7, 8, ...)
      dependencies.mockProxyManager.setDapRequestHandler(async (command, args) => {
        if (command === 'initialize') {
          dependencies.mockProxyManager.simulateEvent('dap-event', { event: 'initialized' });
        }
        if (command === 'setBreakpoints') {
          return {
            success: true,
            body: {
              breakpoints: args?.breakpoints?.map((bp: { line: number }, i: number) => ({
                id: 7 + i,
                verified: false,
                line: bp.line
              })) || []
            }
          };
        }
        return { success: true };
      });

      await sessionManager.startDebugging(session.id, 'app.js');
      await vi.runAllTimersAsync();

      const { breakpoint: bp } = await sessionManager.setBreakpoint(session.id, { file: 'app.js', line: 10 });
      expect(bp.verified).toBe(false);
      // Parent response ids must not be adopted for mirroring policies
      expect(bp.adapterId).toBeUndefined();

      // Child verifies via (synthesized or real) breakpoint event, child id 100
      dependencies.mockProxyManager.simulateEvent('breakpoint', {
        reason: 'changed',
        breakpoint: { id: 100, verified: true, line: 10, source: { path: 'app.js' } }
      });
      const [stored] = sessionManager.listBreakpoints(session.id);
      expect(stored.verified).toBe(true);
      expect(stored.adapterId).toBe(100);

      return session;
    }

    it('does not let a parent setBreakpoints response downgrade child-verified state', async () => {
      const session = await createJsSessionWithChildVerifiedBp();

      // Adding a second breakpoint re-syncs the whole file; the parent
      // response reports verified:false for both positions
      await sessionManager.setBreakpoint(session.id, { file: 'app.js', line: 20 });

      const stored = sessionManager.listBreakpoints(session.id);
      const bp1 = stored.find(bp => bp.line === 10)!;
      const bp2 = stored.find(bp => bp.line === 20)!;
      expect(bp1.verified).toBe(true);
      expect(bp1.adapterId).toBe(100);
      expect(bp2.verified).toBe(false);
    });

    it('ignores a (file,line)-fallback breakpoint event downgrade from the parent', async () => {
      const session = await createJsSessionWithChildVerifiedBp();

      // Parent event: unmatched id, falls back to (file,line), downgrade
      dependencies.mockProxyManager.simulateEvent('breakpoint', {
        reason: 'changed',
        breakpoint: { id: 7, verified: false, line: 10, source: { path: 'app.js' } }
      });

      const [stored] = sessionManager.listBreakpoints(session.id);
      expect(stored.verified).toBe(true);
      expect(stored.adapterId).toBe(100);
    });

    it('still applies an id-matched downgrade (real child unbinding)', async () => {
      const session = await createJsSessionWithChildVerifiedBp();

      dependencies.mockProxyManager.simulateEvent('breakpoint', {
        reason: 'changed',
        breakpoint: { id: 100, verified: false, line: 10 }
      });

      const [stored] = sessionManager.listBreakpoints(session.id);
      expect(stored.verified).toBe(false);
    });
  });

  describe('Step Operations', () => {
    it('should handle step over correctly', async () => {
      const session = await createPausedSession();
      
      const stepPromise = sessionManager.stepOver(session.id);
      await vi.runAllTimersAsync();
      
      const result = await stepPromise;
      
      expect(result.success).toBe(true);
      expect(dependencies.mockProxyManager.dapRequestCalls).toContainEqual({
        command: 'next',
        args: { threadId: 1 }
      });
    });

    it('should handle step into correctly', async () => {
      const session = await createPausedSession();
      
      const result = await sessionManager.stepInto(session.id);
      
      expect(result.success).toBe(true);
      expect(dependencies.mockProxyManager.dapRequestCalls).toContainEqual({
        command: 'stepIn',
        args: { threadId: 1 }
      });
    });

    it('should handle step out correctly', async () => {
      const session = await createPausedSession();
      
      const result = await sessionManager.stepOut(session.id);
      
      expect(result.success).toBe(true);
      expect(dependencies.mockProxyManager.dapRequestCalls).toContainEqual({
        command: 'stepOut',
        args: { threadId: 1 }
      });
    });

    it('should reject step operations when not paused', async () => {
      const session = await sessionManager.createSession({ 
        language: DebugLanguage.MOCK,
        executablePath: 'python'
      });
      
      // Try stepping without starting - now throws typed error
      await expect(sessionManager.stepOver(session.id)).rejects.toThrow(ProxyNotRunningError);
      
      // Start but simulate running state  
      await sessionManager.startDebugging(session.id, 'test.py', [], { stopOnEntry: false });
      await vi.runAllTimersAsync();
      
      let result: any;
      result = await sessionManager.stepOver(session.id);
      expect(result.success).toBe(false);
      // When running, it should say "Not paused"
      expect(result.error).toBe('Not paused');
    });

    it('should report a pending step when the grace window elapses', async () => {
      const session = await createPausedSession();

      // Configure mock to not emit stopped event after step
      dependencies.mockProxyManager.sendDapRequest = vi.fn().mockResolvedValue({ success: true });

      const stepPromise = sessionManager.stepOver(session.id);

      // Fast forward past the grace window
      await vi.advanceTimersByTimeAsync(6000);

      const result = await stepPromise;
      expect(result.success).toBe(true);
      const data = result.data as { message?: string; pending?: boolean };
      expect(data.pending).toBe(true);
      expect(data.message).toBe(ErrorMessages.stepStillRunning(5));

      // The pending step completes asynchronously: when the stop finally
      // lands, the persistent core listener flips the session to PAUSED.
      expect(sessionManager.getSession(session.id)?.state).toBe(SessionState.RUNNING);
      dependencies.mockProxyManager.simulateStopped(1, 'step');
      await vi.runAllTimersAsync();
      expect(sessionManager.getSession(session.id)?.state).toBe(SessionState.PAUSED);
    });

    it('should treat termination during step as a successful completion', async () => {
      const session = await createPausedSession();
      
      dependencies.mockProxyManager.sendDapRequest = vi.fn().mockImplementation(async (command: string) => {
        if (command === 'next') {
          process.nextTick(() => {
            dependencies.mockProxyManager.emit('terminated');
          });
        }
        return { success: true };
      });
      
      const stepPromise = sessionManager.stepOver(session.id);
      await vi.runAllTimersAsync();
      
      const result = await stepPromise;
      expect(result.success).toBe(true);
    });
  });

  describe('Variable inspection', () => {
    it('should fall back to script/global scopes when no Local scope is present', async () => {
      const session = await createPausedSession();
      
      dependencies.mockProxyManager.sendDapRequest = vi.fn().mockImplementation(async (command: string) => {
        switch (command) {
          case 'stackTrace':
            return {
              success: true,
              body: {
                stackFrames: [{
                  id: 1,
                  name: '<module>',
                  source: { path: 'test-simple.js' },
                  line: 6,
                  column: 0
                }]
              }
            };
          case 'scopes':
            return {
              success: true,
              body: {
                scopes: [{
                  name: 'Script',
                  variablesReference: 200,
                  expensive: false
                }]
              }
            };
          case 'variables':
            return {
              success: true,
              body: {
                variables: [
                  { name: 'x', value: '5', type: 'number', variablesReference: 0 },
                  { name: 'y', value: '10', type: 'number', variablesReference: 0 },
                  { name: 'sum', value: '15', type: 'number', variablesReference: 0 }
                ]
              }
            };
          default:
            return { success: true };
        }
      });
      
      const result = await sessionManager.getLocalVariables(session.id);
      expect(result.variables).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'x', value: '5' }),
          expect.objectContaining({ name: 'y', value: '10' }),
          expect.objectContaining({ name: 'sum', value: '15' })
        ])
      );
    });

    it('caps an enormous scope and reports truncation instead of blowing the response (issues #356/#359)', async () => {
      const session = await createPausedSession();

      const hugeVars = Array.from({ length: 1000 }, (_, i) => ({
        name: `v${i}`,
        value: i === 0 ? 'z'.repeat(5000) : `value-${i}`,
        type: 'object',
        variablesReference: 0
      }));

      dependencies.mockProxyManager.sendDapRequest = vi.fn().mockImplementation(async (command: string) => {
        switch (command) {
          case 'stackTrace':
            return {
              success: true,
              body: { stackFrames: [{ id: 1, name: '<anonymous>', source: { path: '<unknown_source>' }, line: 1, column: 1 }] }
            };
          case 'scopes':
            return {
              success: true,
              body: { scopes: [{ name: 'Local', variablesReference: 500, expensive: false }] }
            };
          case 'variables':
            return { success: true, body: { variables: hugeVars } };
          default:
            return { success: true };
        }
      });

      const result = await sessionManager.getLocalVariables(session.id);

      expect(result.variables.length).toBeLessThanOrEqual(300);
      expect(result.truncation).toBeDefined();
      expect(result.truncation!.omittedCount).toBeGreaterThan(0);
      expect(result.truncation!.valueTruncatedCount).toBeGreaterThanOrEqual(1);
      const bigVar = result.variables.find(v => v.name === 'v0');
      expect(bigVar?.truncated).toBe(true);
      expect(bigVar?.value.length).toBe(1024);
    });

    it('stops fetching further scopes once the variable budget is spent (issue #356 fan-out)', async () => {
      const session = await createPausedSession();

      const bigScopeVars = Array.from({ length: 400 }, (_, i) => ({
        name: `g${i}`, value: `x${i}`, type: 'object', variablesReference: 0
      }));
      let variablesCalls = 0;

      dependencies.mockProxyManager.sendDapRequest = vi.fn().mockImplementation(async (command: string, args?: { variablesReference?: number }) => {
        switch (command) {
          case 'stackTrace':
            return {
              success: true,
              body: {
                stackFrames: [
                  { id: 1, name: 'top', source: { path: 'a.js' }, line: 1, column: 1 },
                  { id: 2, name: 'caller', source: { path: 'a.js' }, line: 9, column: 1 }
                ]
              }
            };
          case 'scopes':
            return {
              success: true,
              body: {
                scopes: [
                  { name: 'Local', variablesReference: args && (args as { frameId?: number }) ? 600 : 600, expensive: false },
                  { name: 'Global', variablesReference: 700, expensive: true }
                ]
              }
            };
          case 'variables':
            variablesCalls++;
            return { success: true, body: { variables: bigScopeVars } };
          default:
            return { success: true };
        }
      });

      const result = await sessionManager.getLocalVariables(session.id);

      // 2 frames x 2 scopes = 4 potential fetches; the first fetch (400 vars)
      // already exceeds the 300 budget, so at most one more scope round can
      // start — the rest must be skipped and reported.
      expect(variablesCalls).toBeLessThanOrEqual(1 + 1);
      expect(result.truncation).toBeDefined();
      expect(result.truncation!.scopesSkipped ?? 0).toBeGreaterThan(0);
    });

    it('extracts Go locals and reports the real scope name when Delve appends the optimized-function warning', async () => {
      const session = await sessionManager.createSession({
        language: DebugLanguage.GO,
        executablePath: 'dlv'
      });
      // Explicit stopOnEntry: Go's policy defaults it to false, which would
      // leave the mock proxy without an entry stop to emit.
      await sessionManager.startDebugging(session.id, 'main.go', undefined, { stopOnEntry: true });
      await vi.runAllTimersAsync();
      dependencies.mockProxyManager.simulateStopped(1, 'breakpoint');

      dependencies.mockProxyManager.sendDapRequest = vi.fn().mockImplementation(async (command: string) => {
        switch (command) {
          case 'stackTrace':
            return {
              success: true,
              body: {
                stackFrames: [{
                  id: 1,
                  name: 'main.main',
                  source: { path: '/app/main.go' },
                  line: 12,
                  column: 0
                }]
              }
            };
          case 'scopes':
            return {
              success: true,
              body: {
                scopes: [{
                  name: 'Locals (warning: optimized function)',
                  variablesReference: 300,
                  expensive: false
                }]
              }
            };
          case 'variables':
            return {
              success: true,
              body: {
                variables: [
                  { name: 'counter', value: '7', type: 'int', variablesReference: 0 }
                ]
              }
            };
          default:
            return { success: true };
        }
      });

      const result = await sessionManager.getLocalVariables(session.id);

      expect(result.variables).toEqual([
        expect.objectContaining({ name: 'counter', value: '7' })
      ]);
      // The ACTUAL adapter scope name (with the warning) must surface, not the
      // policy's canonical 'Locals'.
      expect(result.scopeName).toBe('Locals (warning: optimized function)');
    });
  });

  describe('Variable and Stack Inspection', () => {
    it('should retrieve variables for a scope', async () => {
      const session = await sessionManager.createSession({ 
        language: DebugLanguage.MOCK,
        executablePath: 'python'
      });
      
      await sessionManager.startDebugging(session.id, 'test.py');
      await vi.runAllTimersAsync();
      
      // Pause the session
      dependencies.mockProxyManager.simulateStopped(1, 'entry');
      
      const variables = await sessionManager.getVariables(session.id, 100);
      
      expect(variables).toHaveLength(1);
      expect(variables[0]).toMatchObject({
        name: 'test_var',
        value: '42',
        type: 'int',
        expandable: false
      });
      
      expect(dependencies.mockProxyManager.dapRequestCalls).toContainEqual({
        command: 'variables',
        args: { variablesReference: 100 }
      });
    });

    it('should retrieve stack trace', async () => {
      const session = await sessionManager.createSession({ 
        language: DebugLanguage.MOCK,
        executablePath: 'python'
      });
      
      await sessionManager.startDebugging(session.id, 'test.py');
      await vi.runAllTimersAsync();
      
      // Pause the session
      dependencies.mockProxyManager.simulateStopped(1, 'entry');
      
      const stackFrames = await sessionManager.getStackTrace(session.id);
      
      expect(stackFrames).toHaveLength(1);
      expect(stackFrames[0]).toMatchObject({
        id: 1,
        name: 'main',
        file: 'test.py',
        line: 10
      });
      
      expect(dependencies.mockProxyManager.dapRequestCalls).toContainEqual({
        command: 'stackTrace',
        args: { threadId: 1 }
      });
    });

    it('should retrieve scopes for a frame', async () => {
      const session = await sessionManager.createSession({ 
        language: DebugLanguage.MOCK,
        executablePath: 'python'
      });
      
      await sessionManager.startDebugging(session.id, 'test.py');
      await vi.runAllTimersAsync();
      
      // Pause the session
      dependencies.mockProxyManager.simulateStopped(1, 'entry');
      
      const scopes = await sessionManager.getScopes(session.id, 1);
      
      expect(scopes).toHaveLength(1);
      expect(scopes[0]).toMatchObject({
        name: 'Locals',
        variablesReference: 100,
        expensive: false
      });
      
      expect(dependencies.mockProxyManager.dapRequestCalls).toContainEqual({
        command: 'scopes',
        args: { frameId: 1 }
      });
    });

    it('should return empty arrays when not paused', async () => {
      const session = await sessionManager.createSession({ 
        language: DebugLanguage.MOCK,
        executablePath: 'python'
      });
      
      // Try without starting
      let variables = await sessionManager.getVariables(session.id, 100);
      expect(variables).toEqual([]);
      
      let stackFrames = await sessionManager.getStackTrace(session.id);
      expect(stackFrames).toEqual([]);
      
      let scopes = await sessionManager.getScopes(session.id, 1);
      expect(scopes).toEqual([]);
      
      // Start but in running state
      await sessionManager.startDebugging(session.id, 'test.py', [], { stopOnEntry: false });
      await vi.runAllTimersAsync();
      
      variables = await sessionManager.getVariables(session.id, 100);
      expect(variables).toEqual([]);

      stackFrames = await sessionManager.getStackTrace(session.id);
      expect(stackFrames).toEqual([]);

      scopes = await sessionManager.getScopes(session.id, 1);
      expect(scopes).toEqual([]);
    });
  });

  describe('Stack frame filtering fallback (issue #346)', () => {
    const RUNTIME_FRAMES = [
      { id: 1, name: 'runtime.gopark', line: 402, source: { path: '/usr/local/go/src/runtime/proc.go' } },
      { id: 2, name: 'runtime.selectgo', line: 327, source: { path: '/usr/local/go/src/runtime/select.go' } },
      { id: 3, name: 'main.worker', line: 12, source: { path: '/work/main.go' } }
    ];

    async function pausedSessionWithFrames(frames: unknown[]) {
      const session = await sessionManager.createSession({
        language: DebugLanguage.MOCK,
        executablePath: 'python'
      });
      await sessionManager.startDebugging(session.id, 'test.py');
      await vi.runAllTimersAsync();
      dependencies.mockProxyManager.simulateStopped(1, 'entry');
      dependencies.mockProxyManager.setDapRequestHandler(async (command: string) => {
        if (command === 'stackTrace') {
          return { success: true, body: { stackFrames: frames } };
        }
        return { success: true, body: {} };
      });
      return session;
    }

    function stubFilteringPolicy(keep: (frame: { file?: string }) => boolean) {
      // Inject a filtering policy (like Go's) without needing a Go adapter in
      // the unit-test registry — the fallback under test is policy-agnostic.
      (sessionManager as unknown as { selectPolicy: () => unknown }).selectPolicy = () => ({
        filterStackFrames: (frames: { file?: string }[], includeInternals: boolean) =>
          includeInternals ? frames : frames.filter(keep)
      });
    }

    it('reports hidden-frame counts when a policy filters internals', async () => {
      const session = await pausedSessionWithFrames(RUNTIME_FRAMES);
      stubFilteringPolicy(f => !(f.file ?? '').includes('/runtime/'));

      const result = await sessionManager.getStackTraceDetailed(session.id);

      expect(result.frames.map(f => f.name)).toEqual(['main.worker']);
      expect(result.totalFrameCount).toBe(3);
      expect(result.hiddenFrameCount).toBe(2);
      expect(result.allFramesInternal).toBe(false);
    });

    it('keeps the top frame when every frame is filtered, instead of returning an empty stack', async () => {
      const session = await pausedSessionWithFrames(RUNTIME_FRAMES.slice(0, 2));
      stubFilteringPolicy(f => !(f.file ?? '').includes('/runtime/'));

      const result = await sessionManager.getStackTraceDetailed(session.id);

      expect(result.frames).toHaveLength(1);
      expect(result.frames[0].name).toBe('runtime.gopark'); // top unfiltered frame, usable as a frameId anchor
      expect(result.totalFrameCount).toBe(2);
      expect(result.hiddenFrameCount).toBe(1);
      expect(result.allFramesInternal).toBe(true);
    });

    it('includeInternals bypasses filtering and reports nothing hidden', async () => {
      const session = await pausedSessionWithFrames(RUNTIME_FRAMES);
      stubFilteringPolicy(f => !(f.file ?? '').includes('/runtime/'));

      const result = await sessionManager.getStackTraceDetailed(session.id, undefined, true);

      expect(result.frames).toHaveLength(3);
      expect(result.hiddenFrameCount).toBe(0);
      expect(result.allFramesInternal).toBe(false);
    });

    it('getStackTrace (array form) inherits the non-empty guarantee', async () => {
      const session = await pausedSessionWithFrames(RUNTIME_FRAMES.slice(0, 2));
      stubFilteringPolicy(() => false);

      const frames = await sessionManager.getStackTrace(session.id);

      expect(frames).toHaveLength(1);
    });

    it('all-internal LLDB stack (issue #369): rust policy filter engages, first-frame fallback annotates', async () => {
      // A rust program paused inside a sleep: every frame is LLDB/libc
      // internal. The real RustAdapterPolicy must classify them all as
      // internal, and the central #346 fallback must keep the top frame
      // and flag allFramesInternal instead of returning an empty stack.
      const LLDB_INTERNAL_FRAMES = [
        { id: 1, name: '__GI___clock_nanosleep', line: 78, source: { path: '../sysdeps/unix/sysv/linux/clock_nanosleep.c' } },
        { id: 2, name: '@___lldb_unnamed_symbol3688', line: 0, source: undefined },
        { id: 3, name: '__libc_start_main', line: 0, source: undefined },
        { id: 4, name: '_start', line: 0, source: undefined }
      ];
      const session = await pausedSessionWithFrames(LLDB_INTERNAL_FRAMES);
      (sessionManager as unknown as { selectPolicy: () => unknown }).selectPolicy = () => RustAdapterPolicy;

      const result = await sessionManager.getStackTraceDetailed(session.id);

      expect(result.frames).toHaveLength(1);
      expect(result.frames[0].name).toBe('__GI___clock_nanosleep'); // top unfiltered frame kept as anchor
      expect(result.totalFrameCount).toBe(4);
      expect(result.hiddenFrameCount).toBe(3);
      expect(result.allFramesInternal).toBe(true);

      // includeInternals still surfaces the full stack.
      const unfiltered = await sessionManager.getStackTraceDetailed(session.id, undefined, true);
      expect(unfiltered.frames).toHaveLength(4);
      expect(unfiltered.allFramesInternal).toBe(false);
    });

    it('mixed LLDB stack (issue #369): rust policy hides internals, keeps user frames', async () => {
      const MIXED_FRAMES = [
        { id: 1, name: 'pause_test::busy', line: 7, source: { path: '/work/src/main.rs' } },
        { id: 2, name: 'pause_test::main', line: 15, source: { path: '/work/src/main.rs' } },
        { id: 3, name: '__libc_start_main', line: 0, source: undefined },
        { id: 4, name: '_start', line: 0, source: undefined }
      ];
      const session = await pausedSessionWithFrames(MIXED_FRAMES);
      (sessionManager as unknown as { selectPolicy: () => unknown }).selectPolicy = () => RustAdapterPolicy;

      const result = await sessionManager.getStackTraceDetailed(session.id);

      expect(result.frames.map(f => f.name)).toEqual(['pause_test::busy', 'pause_test::main']);
      expect(result.hiddenFrameCount).toBe(2);
      expect(result.allFramesInternal).toBe(false);
    });
  });

  describe('Exception Breakpoints and Stop Detail (issue #220)', () => {
    it('threads breakOnExceptions into the ProxyConfig', async () => {
      const session = await sessionManager.createSession({
        language: DebugLanguage.MOCK,
        executablePath: 'python'
      });

      await sessionManager.startDebugging(session.id, 'test.py', undefined, undefined, undefined, undefined, 'uncaught');
      await vi.runAllTimersAsync();

      expect(dependencies.mockProxyManager.startCalls).toHaveLength(1);
      expect(dependencies.mockProxyManager.startCalls[0].breakOnExceptions).toBe('uncaught');
    });

    it("applies the policy launch default 'uncaught' to the ProxyConfig when not requested (issue #244)", async () => {
      const session = await sessionManager.createSession({
        language: DebugLanguage.MOCK,
        executablePath: 'python'
      });

      await sessionManager.startDebugging(session.id, 'test.py');
      await vi.runAllTimersAsync();

      expect(dependencies.mockProxyManager.startCalls[0].breakOnExceptions).toBe('uncaught');
      expect(sessionManager.getSession(session.id)?.effectiveBreakOnExceptions).toBe('uncaught');
    });

    it("user-provided 'none' wins over the policy launch default (issue #244)", async () => {
      const session = await sessionManager.createSession({
        language: DebugLanguage.MOCK,
        executablePath: 'python'
      });

      await sessionManager.startDebugging(session.id, 'test.py', undefined, undefined, undefined, undefined, 'none');
      await vi.runAllTimersAsync();

      expect(dependencies.mockProxyManager.startCalls[0].breakOnExceptions).toBe('none');
      expect(sessionManager.getSession(session.id)?.effectiveBreakOnExceptions).toBe('none');
    });

    it("user-provided 'all' wins over the policy launch default (issue #244)", async () => {
      const session = await sessionManager.createSession({
        language: DebugLanguage.MOCK,
        executablePath: 'python'
      });

      await sessionManager.startDebugging(session.id, 'test.py', undefined, undefined, undefined, undefined, 'all');
      await vi.runAllTimersAsync();

      expect(dependencies.mockProxyManager.startCalls[0].breakOnExceptions).toBe('all');
    });

    it('applies no default to attach-shaped launch args (issue #244)', async () => {
      const session = await sessionManager.createSession({
        language: DebugLanguage.MOCK,
        executablePath: 'python'
      });

      await sessionManager.startDebugging(
        session.id,
        'attach://remote',
        undefined,
        { request: 'attach', __attachMode: true } as never,
        undefined,
        undefined,
        undefined
      );
      await vi.runAllTimersAsync();

      expect(dependencies.mockProxyManager.startCalls[0].breakOnExceptions).toBeUndefined();
      expect(sessionManager.getSession(session.id)?.effectiveBreakOnExceptions).toBeUndefined();
    });

    it('applies no default to languages without one (ruby, issue #244)', async () => {
      const session = await sessionManager.createSession({
        language: DebugLanguage.RUBY,
        executablePath: 'ruby'
      });

      await sessionManager.startDebugging(session.id, 'test.rb');
      await vi.runAllTimersAsync();

      expect(dependencies.mockProxyManager.startCalls[0].breakOnExceptions).toBeUndefined();
      expect(sessionManager.getSession(session.id)?.effectiveBreakOnExceptions).toBeUndefined();
    });

    it('records description and text from the stopped event body on lastStop', async () => {
      const session = await createPausedSession();

      dependencies.mockProxyManager.simulateStopped(1, 'exception', {
        reason: 'exception',
        threadId: 1,
        description: 'ZeroDivisionError',
        text: 'division by zero'
      });

      const managedSession = sessionManager.getSession(session.id);
      expect(managedSession?.lastStop).toMatchObject({
        reason: 'exception',
        threadId: 1,
        description: 'ZeroDivisionError',
        text: 'division by zero'
      });
      expect(managedSession?.state).toBe(SessionState.PAUSED);
    });

    it('handles a stopped event without a body (lastStop has no detail fields)', async () => {
      const session = await createPausedSession();

      dependencies.mockProxyManager.simulateStopped(1, 'breakpoint');

      const managedSession = sessionManager.getSession(session.id);
      expect(managedSession?.lastStop?.reason).toBe('breakpoint');
      expect(managedSession?.lastStop?.description).toBeUndefined();
      expect(managedSession?.lastStop?.text).toBeUndefined();
    });

    it('records the debuggee exit code from the exited event', async () => {
      const session = await createPausedSession();

      dependencies.mockProxyManager.simulateExited(1);

      const managedSession = sessionManager.getSession(session.id);
      expect(managedSession?.exitCode).toBe(1);
      expect(managedSession?.state).toBe(SessionState.STOPPED);

      // Projection includes the exit code
      const infos = sessionManager.getAllSessions();
      const info = infos.find(s => s.id === session.id);
      expect(info?.exitCode).toBe(1);
    });

    it('leaves exitCode undefined when the exited event has no code', async () => {
      const session = await createPausedSession();

      dependencies.mockProxyManager.simulateExited(undefined);

      const managedSession = sessionManager.getSession(session.id);
      expect(managedSession?.exitCode).toBeUndefined();
      expect(managedSession?.state).toBe(SessionState.STOPPED);
    });
  });

  describe('Stop-reason normalization (policy hook)', () => {
    async function createPausedRustSession() {
      const session = await sessionManager.createSession({
        language: DebugLanguage.RUST,
        executablePath: 'cargo'
      });

      await sessionManager.startDebugging(session.id, 'test.rs');
      await vi.runAllTimersAsync();

      dependencies.mockProxyManager.simulateStopped(1, 'entry');
      dependencies.mockProxyManager.dapRequestCalls = [];

      return session;
    }

    it('normalizes a CodeLLDB SIGSTOP exception stop to pause and keeps the raw reason', async () => {
      const session = await createPausedRustSession();

      dependencies.mockProxyManager.simulateStopped(1, 'exception', {
        reason: 'exception',
        threadId: 1,
        description: 'signal SIGSTOP'
      });

      const managedSession = sessionManager.getSession(session.id);
      expect(managedSession?.lastStop?.reason).toBe('pause');
      expect(managedSession?.lastStop?.rawReason).toBe('exception');
      expect(managedSession?.state).toBe(SessionState.PAUSED);
      expect(managedSession?.pausePending).toBe(false);
    });

    it('normalizes the Windows break-in pause (0x80000003) while a pause is pending (issue #275)', async () => {
      const session = await createPausedRustSession();
      const managed = sessionManager.getSession(session.id)!;
      managed.pausePending = true;

      dependencies.mockProxyManager.simulateStopped(1, 'exception', {
        reason: 'exception',
        threadId: 1,
        description: 'Exception 0x80000003 encountered at address 0x7ffe8b4dd7bd'
      });

      expect(managed.lastStop?.reason).toBe('pause');
      expect(managed.lastStop?.rawReason).toBe('exception');
      expect(managed.pausePending).toBe(false);
    });

    it('leaves a real rust exception stop unnormalized (no rawReason)', async () => {
      const session = await createPausedRustSession();

      dependencies.mockProxyManager.simulateStopped(1, 'exception', {
        reason: 'exception',
        threadId: 1,
        description: 'signal SIGSEGV'
      });

      const managedSession = sessionManager.getSession(session.id);
      expect(managedSession?.lastStop?.reason).toBe('exception');
      expect(managedSession?.lastStop?.rawReason).toBeUndefined();
    });

    it('does not request exceptionInfo for a stop normalized to pause', async () => {
      const session = await createPausedRustSession();
      dependencies.mockProxyManager.simulateEvent('adapter-capabilities', {
        supportsExceptionInfoRequest: true
      });

      dependencies.mockProxyManager.simulateStopped(1, 'exception', {
        reason: 'exception',
        threadId: 1,
        description: 'signal SIGSTOP'
      });
      await vi.runAllTimersAsync();

      const exceptionInfoCalls = dependencies.mockProxyManager.dapRequestCalls
        .filter(c => c.command === 'exceptionInfo');
      expect(exceptionInfoCalls).toHaveLength(0);
      expect(sessionManager.getSession(session.id)?.lastStop?.reason).toBe('pause');
    });

    it('does not affect adapters without a normalizer (mock)', async () => {
      const session = await createPausedSession();

      dependencies.mockProxyManager.simulateStopped(1, 'exception', {
        reason: 'exception',
        threadId: 1,
        description: 'signal SIGSTOP'
      });

      const managedSession = sessionManager.getSession(session.id);
      expect(managedSession?.lastStop?.reason).toBe('exception');
      expect(managedSession?.lastStop?.rawReason).toBeUndefined();
    });

    // Issue #260: CodeLLDB delivers rust_panic filter hits as internal
    // breakpoint stops. The session manager passes the known user-breakpoint
    // adapter ids to the policy so it can tell those apart.
    describe('rust panic breakpoint stops (issue #260)', () => {
      function respondToSetBreakpointsWithIds(startId: number) {
        dependencies.mockProxyManager.setDapRequestHandler(async (command, args) => {
          if (command === 'setBreakpoints') {
            const typedArgs = args as { breakpoints?: Array<{ line: number }> } | undefined;
            return {
              success: true,
              body: {
                breakpoints: typedArgs?.breakpoints?.map((bp, i) => ({
                  id: startId + i,
                  verified: true,
                  line: bp.line
                })) ?? []
              }
            };
          }
          return { success: true };
        });
      }

      it('normalizes a panic breakpoint stop (no user breakpoints) to exception', async () => {
        const session = await createPausedRustSession();

        dependencies.mockProxyManager.simulateStopped(1, 'breakpoint', {
          reason: 'breakpoint',
          threadId: 1,
          allThreadsStopped: true,
          hitBreakpointIds: [1]
        });

        const managedSession = sessionManager.getSession(session.id);
        expect(managedSession?.lastStop?.reason).toBe('exception');
        expect(managedSession?.lastStop?.rawReason).toBe('breakpoint');
        expect(managedSession?.state).toBe(SessionState.PAUSED);
      });

      it('keeps a stop matching a user breakpoint adapter id as breakpoint', async () => {
        const session = await createPausedRustSession();
        respondToSetBreakpointsWithIds(1);
        await sessionManager.setBreakpoint(session.id, { file: 'main.rs', line: 17 });

        dependencies.mockProxyManager.simulateStopped(1, 'breakpoint', {
          reason: 'breakpoint',
          threadId: 1,
          allThreadsStopped: true,
          hitBreakpointIds: [1]
        });

        const managedSession = sessionManager.getSession(session.id);
        expect(managedSession?.lastStop?.reason).toBe('breakpoint');
        expect(managedSession?.lastStop?.rawReason).toBeUndefined();
      });

      it('normalizes a panic stop whose id is disjoint from user breakpoints', async () => {
        const session = await createPausedRustSession();
        respondToSetBreakpointsWithIds(1);
        await sessionManager.setBreakpoint(session.id, { file: 'main.rs', line: 17 });

        dependencies.mockProxyManager.simulateStopped(1, 'breakpoint', {
          reason: 'breakpoint',
          threadId: 1,
          allThreadsStopped: true,
          hitBreakpointIds: [2]
        });

        const managedSession = sessionManager.getSession(session.id);
        expect(managedSession?.lastStop?.reason).toBe('exception');
        expect(managedSession?.lastStop?.rawReason).toBe('breakpoint');
      });

      it('does not request exceptionInfo for a normalized panic stop', async () => {
        // CodeLLDB treats the stop as a breakpoint stop, so its exceptionInfo
        // answer is about the internal breakpoint ("Breakpoint"/"breakpoint
        // 1.1", confirmed live) — misleading, not enriching. Enrichment stays
        // gated on the adapter itself reporting reason 'exception'.
        const session = await createPausedRustSession();
        dependencies.mockProxyManager.simulateEvent('adapter-capabilities', {
          supportsExceptionInfoRequest: true
        });

        dependencies.mockProxyManager.simulateStopped(1, 'breakpoint', {
          reason: 'breakpoint',
          threadId: 1,
          allThreadsStopped: true,
          hitBreakpointIds: [1]
        });
        await vi.runAllTimersAsync();

        const exceptionInfoCalls = dependencies.mockProxyManager.dapRequestCalls
          .filter(c => c.command === 'exceptionInfo');
        expect(exceptionInfoCalls).toHaveLength(0);
        expect(sessionManager.getSession(session.id)?.lastStop?.reason).toBe('exception');
      });

      it('does not normalize when a user breakpoint lacks an adapter id', async () => {
        const session = await createPausedRustSession();
        // Default mock setBreakpoints response carries no ids -> bookkeeping
        // incomplete -> the disjoint inference must be disabled.
        await sessionManager.setBreakpoint(session.id, { file: 'main.rs', line: 17 });

        dependencies.mockProxyManager.simulateStopped(1, 'breakpoint', {
          reason: 'breakpoint',
          threadId: 1,
          allThreadsStopped: true,
          hitBreakpointIds: [2]
        });

        const managedSession = sessionManager.getSession(session.id);
        expect(managedSession?.lastStop?.reason).toBe('breakpoint');
        expect(managedSession?.lastStop?.rawReason).toBeUndefined();
      });
    });
  });

  describe('Adapter Capabilities and exceptionInfo Enrichment (issue #243)', () => {
    const capsWithExceptionInfo = {
      supportsExceptionInfoRequest: true,
      exceptionBreakpointFilters: [
        { filter: 'uncaught', label: 'Uncaught Exceptions' },
        { filter: 'all', label: 'All Exceptions' }
      ]
    };

    function exceptionInfoCalls() {
      return dependencies.mockProxyManager.dapRequestCalls.filter(c => c.command === 'exceptionInfo');
    }

    it('stores adapter capabilities from the adapter-capabilities event', async () => {
      const session = await createPausedSession();

      dependencies.mockProxyManager.simulateEvent('adapter-capabilities', capsWithExceptionInfo);

      expect(sessionManager.getSession(session.id)?.adapterCapabilities).toEqual(capsWithExceptionInfo);
    });

    it('annotates stored logpoints when live capabilities do not advertise logpoint support (issue #235)', async () => {
      const session = await createPausedSession();
      const { breakpoint: bp } = await sessionManager.setBreakpoint(
        session.id, { file: 'test.py', line: 20, logMessage: 'x is {x}' }
      );

      dependencies.mockProxyManager.simulateEvent('adapter-capabilities', { supportsLogPoints: false });

      const [stored] = sessionManager.listBreakpoints(session.id);
      expect(stored.id).toBe(bp.id);
      expect(stored.message).toMatch(/logpoint/i);
    });

    it('leaves logpoints unannotated when live capabilities advertise support', async () => {
      const session = await createPausedSession();
      await sessionManager.setBreakpoint(
        session.id, { file: 'test.py', line: 20, logMessage: 'x is {x}' }
      );

      dependencies.mockProxyManager.simulateEvent('adapter-capabilities', { supportsLogPoints: true });

      const [stored] = sessionManager.listBreakpoints(session.id);
      expect(stored.message).toBeUndefined();
    });

    it('requests exceptionInfo on exception stops and merges the result into lastStop', async () => {
      const session = await createPausedSession();
      dependencies.mockProxyManager.simulateEvent('adapter-capabilities', capsWithExceptionInfo);
      dependencies.mockProxyManager.setDapRequestHandler(async (command) => {
        if (command === 'exceptionInfo') {
          return {
            success: true,
            body: {
              exceptionId: 'MockError',
              breakMode: 'unhandled',
              description: 'Mock uncaught exception',
              details: { message: 'Mock uncaught exception', typeName: 'MockError' }
            }
          };
        }
        return { success: true };
      });

      dependencies.mockProxyManager.simulateStopped(1, 'exception', {
        reason: 'exception',
        threadId: 1,
        description: 'MockError'
      });
      await vi.runAllTimersAsync();

      expect(exceptionInfoCalls()).toHaveLength(1);
      expect(exceptionInfoCalls()[0].args).toEqual({ threadId: 1 });

      const lastStop = sessionManager.getSession(session.id)?.lastStop;
      expect(lastStop?.exceptionInfo).toEqual({
        exceptionId: 'MockError',
        breakMode: 'unhandled',
        description: 'Mock uncaught exception',
        details: { message: 'Mock uncaught exception', typeName: 'MockError' }
      });
    });

    it('does not request exceptionInfo when the adapter lacks the capability', async () => {
      await createPausedSession();
      dependencies.mockProxyManager.simulateEvent('adapter-capabilities', {
        supportsExceptionInfoRequest: false
      });

      dependencies.mockProxyManager.simulateStopped(1, 'exception');
      await vi.runAllTimersAsync();

      expect(exceptionInfoCalls()).toHaveLength(0);
    });

    it('does not request exceptionInfo when no capabilities were captured', async () => {
      await createPausedSession();

      dependencies.mockProxyManager.simulateStopped(1, 'exception');
      await vi.runAllTimersAsync();

      expect(exceptionInfoCalls()).toHaveLength(0);
    });

    it('does not request exceptionInfo when the stop has no threadId', async () => {
      await createPausedSession();
      dependencies.mockProxyManager.simulateEvent('adapter-capabilities', capsWithExceptionInfo);

      dependencies.mockProxyManager.simulateEvent('stopped', undefined, 'exception', undefined);
      await vi.runAllTimersAsync();

      expect(exceptionInfoCalls()).toHaveLength(0);
    });

    it('swallows exceptionInfo failures and leaves lastStop intact', async () => {
      const session = await createPausedSession();
      dependencies.mockProxyManager.simulateEvent('adapter-capabilities', capsWithExceptionInfo);
      dependencies.mockProxyManager.shouldFailDapRequests = true;

      dependencies.mockProxyManager.simulateStopped(1, 'exception', {
        reason: 'exception',
        threadId: 1,
        description: 'MockError'
      });
      await vi.runAllTimersAsync();

      const managedSession = sessionManager.getSession(session.id);
      expect(managedSession?.state).toBe(SessionState.PAUSED);
      expect(managedSession?.lastStop?.reason).toBe('exception');
      expect(managedSession?.lastStop?.exceptionInfo).toBeUndefined();
    });

    it('does not merge a late exceptionInfo response onto a newer stop (stale-guard)', async () => {
      const session = await createPausedSession();
      dependencies.mockProxyManager.simulateEvent('adapter-capabilities', capsWithExceptionInfo);

      let releaseExceptionInfo: (() => void) | undefined;
      dependencies.mockProxyManager.setDapRequestHandler(async (command) => {
        if (command === 'exceptionInfo') {
          await new Promise<void>((resolve) => {
            releaseExceptionInfo = resolve;
          });
          return {
            success: true,
            body: { exceptionId: 'StaleError', breakMode: 'unhandled' }
          };
        }
        return { success: true };
      });

      dependencies.mockProxyManager.simulateStopped(1, 'exception');
      // A newer stop replaces lastStop while exceptionInfo is still in flight
      dependencies.mockProxyManager.simulateStopped(1, 'breakpoint');
      releaseExceptionInfo?.();
      await vi.runAllTimersAsync();

      const lastStop = sessionManager.getSession(session.id)?.lastStop;
      expect(lastStop?.reason).toBe('breakpoint');
      expect(lastStop?.exceptionInfo).toBeUndefined();
    });

    it('warns when the policy filter table declares IDs the adapter does not advertise', async () => {
      await createPausedSession();

      // Mock policy declares uncaught: ['uncaught'] and all: ['all'];
      // advertise only 'uncaught' so 'all' is drift.
      dependencies.mockProxyManager.simulateEvent('adapter-capabilities', {
        exceptionBreakpointFilters: [{ filter: 'uncaught', label: 'Uncaught Exceptions' }]
      });

      expect(dependencies.mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Exception filter drift')
      );
      expect(dependencies.mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('all')
      );
    });

    it('does not warn when the adapter advertises every declared filter', async () => {
      await createPausedSession();

      dependencies.mockProxyManager.simulateEvent('adapter-capabilities', capsWithExceptionInfo);

      const warnCalls = (dependencies.mockLogger.warn as ReturnType<typeof vi.fn>).mock.calls
        .filter((call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).includes('filter'));
      expect(warnCalls).toHaveLength(0);
    });

    it('exposes capabilities-driven enrichment through getAllSessions lastStop projection', async () => {
      const session = await createPausedSession();
      dependencies.mockProxyManager.simulateEvent('adapter-capabilities', capsWithExceptionInfo);
      dependencies.mockProxyManager.setDapRequestHandler(async (command) =>
        command === 'exceptionInfo'
          ? { success: true, body: { exceptionId: 'MockError', breakMode: 'unhandled' } }
          : { success: true }
      );

      dependencies.mockProxyManager.simulateStopped(1, 'exception');
      await vi.runAllTimersAsync();

      const info = sessionManager.getAllSessions().find(s => s.id === session.id);
      expect(info?.lastStop?.exceptionInfo?.exceptionId).toBe('MockError');
    });
  });

  describe('stop-reason normalization context (issue #302)', () => {
    // The context handed to policy.normalizeStopReason: id sets are present
    // only when the respective bookkeeping is complete; counts always are.
    function installPolicySpy() {
      const normalizeStopReason = vi.fn().mockReturnValue(undefined);
      const store = (sessionManager as unknown as { sessionStore: { selectPolicy: unknown } }).sessionStore;
      const original = store.selectPolicy;
      vi.spyOn(store as { selectPolicy: (lang: string) => unknown }, 'selectPolicy').mockImplementation(
        function (this: unknown, lang: string) {
          const policy = (original as (lang: string) => Record<string, unknown>).call(store, lang);
          return { ...policy, normalizeStopReason };
        }
      );
      return normalizeStopReason;
    }

    it('passes the line+function union, fn-bp set, and counts when bookkeeping is complete', async () => {
      const session = await createPausedSession();
      const managed = sessionManager.getSession(session.id)!;
      managed.breakpoints.set('b1', { id: 'b1', file: '/a.rs', line: 3, verified: true, adapterId: 1 });
      managed.functionBreakpoints.set('f1', { id: 'f1', functionName: 'main', verified: true, adapterId: 5 });

      const normalizeStopReason = installPolicySpy();
      normalizeStopReason.mockReturnValue('function breakpoint');
      dependencies.mockProxyManager.simulateStopped(1, 'breakpoint', {
        reason: 'breakpoint',
        threadId: 1,
        hitBreakpointIds: [5]
      });

      expect(normalizeStopReason).toHaveBeenCalledWith(
        'breakpoint',
        expect.objectContaining({ hitBreakpointIds: [5] }),
        {
          pausePending: false,
          userBreakpointIds: new Set([1, 5]),
          functionBreakpointIds: new Set([5]),
          lineBreakpointCount: 1,
          functionBreakpointCount: 1
        }
      );
      expect(managed.lastStop?.reason).toBe('function breakpoint');
      expect(managed.lastStop?.rawReason).toBe('breakpoint');
    });

    it('omits both id sets when a line breakpoint lacks an adapterId', async () => {
      const session = await createPausedSession();
      const managed = sessionManager.getSession(session.id)!;
      managed.breakpoints.set('b1', { id: 'b1', file: '/a.rs', line: 3, verified: false });
      managed.functionBreakpoints.set('f1', { id: 'f1', functionName: 'main', verified: true, adapterId: 5 });

      const normalizeStopReason = installPolicySpy();
      dependencies.mockProxyManager.simulateStopped(1, 'breakpoint', {
        reason: 'breakpoint',
        threadId: 1
      });

      expect(normalizeStopReason).toHaveBeenCalledWith(
        'breakpoint',
        expect.anything(),
        {
          pausePending: false,
          userBreakpointIds: undefined,
          functionBreakpointIds: new Set([5]),
          lineBreakpointCount: 1,
          functionBreakpointCount: 1
        }
      );
    });

    it('omits the union and the fn-bp set when a function breakpoint lacks an adapterId', async () => {
      const session = await createPausedSession();
      const managed = sessionManager.getSession(session.id)!;
      managed.breakpoints.set('b1', { id: 'b1', file: '/a.rs', line: 3, verified: true, adapterId: 1 });
      managed.functionBreakpoints.set('f1', { id: 'f1', functionName: 'main', verified: false });

      const normalizeStopReason = installPolicySpy();
      dependencies.mockProxyManager.simulateStopped(1, 'breakpoint', {
        reason: 'breakpoint',
        threadId: 1
      });

      expect(normalizeStopReason).toHaveBeenCalledWith(
        'breakpoint',
        expect.anything(),
        {
          pausePending: false,
          userBreakpointIds: undefined,
          functionBreakpointIds: undefined,
          lineBreakpointCount: 1,
          functionBreakpointCount: 1
        }
      );
    });

    it('warns at launch about unbound function breakpoints on eager adapters (#308)', async () => {
      const session = await sessionManager.createSession({
        language: DebugLanguage.MOCK,
        executablePath: 'python'
      });
      await sessionManager.setFunctionBreakpoint(session.id, { functionName: 'main' });

      const result = await sessionManager.startDebugging(session.id, 'test.py');
      await vi.runAllTimersAsync();

      // The mock's default DAP response carries no breakpoints body, so the
      // re-sync leaves the fn bp unverified — the eager-policy warning fires.
      const warning = (result.data as { warning?: string } | undefined)?.warning;
      expect(warning).toMatch(/not bound at launch/);
      expect(warning).toContain("'main'");
    });

    it('suppresses the launch warning for bind-late policies (#308)', async () => {
      const session = await sessionManager.createSession({
        language: DebugLanguage.MOCK,
        executablePath: 'python'
      });
      await sessionManager.setFunctionBreakpoint(session.id, { functionName: 'main' });

      const store = (sessionManager as unknown as { sessionStore: { selectPolicy: (lang: string) => Record<string, unknown> } }).sessionStore;
      const original = store.selectPolicy.bind(store);
      vi.spyOn(store, 'selectPolicy').mockImplementation((lang: string) => ({
        ...original(lang),
        functionBreakpointsBindLate: true
      }));

      const result = await sessionManager.startDebugging(session.id, 'test.py');
      await vi.runAllTimersAsync();

      expect((result.data as { warning?: string } | undefined)?.warning).toBeUndefined();
    });

    it('does not warn when the adapter verifies the function breakpoint', async () => {
      const session = await sessionManager.createSession({
        language: DebugLanguage.MOCK,
        executablePath: 'python'
      });
      await sessionManager.setFunctionBreakpoint(session.id, { functionName: 'main' });
      dependencies.mockProxyManager.setDapRequestHandler(async (command) =>
        command === 'setFunctionBreakpoints'
          ? { success: true, body: { breakpoints: [{ id: 3, verified: true }] } }
          : { success: true }
      );

      const result = await sessionManager.startDebugging(session.id, 'test.py');
      await vi.runAllTimersAsync();

      expect((result.data as { warning?: string } | undefined)?.warning).toBeUndefined();
    });

    it('stamps never-bound function breakpoints and writes an output warning at exit (#308)', async () => {
      const session = await createPausedSession();
      const managed = sessionManager.getSession(session.id)!;
      managed.functionBreakpoints.set('f1', { id: 'f1', functionName: 'main', verified: false });
      managed.functionBreakpoints.set('f2', { id: 'f2', functionName: 'main.main', verified: true });

      const captured: unknown[] = [];
      sessionManager.on('output-captured', (_sid: string, entry: unknown) => captured.push(entry));

      dependencies.mockProxyManager.simulateEvent('exited', 0);
      await vi.runAllTimersAsync();

      const stamped = managed.functionBreakpoints.get('f1')!;
      expect(stamped.message).toMatch(/Never bound during this run/);
      expect(stamped.message).toContain("'main'");
      // The verified one stays untouched.
      expect(managed.functionBreakpoints.get('f2')!.message).toBeUndefined();

      const entries = managed.outputBuffer!.read(0, 10).entries;
      const warningEntry = entries.find(e => e.output.includes('never bound during this run'));
      expect(warningEntry).toBeDefined();
      expect(warningEntry!.category).toBe('console');
      expect(captured.length).toBeGreaterThan(0);

      // Idempotent: a second terminal signal must not stamp or emit again.
      const before = managed.outputBuffer!.read(0, 20).entries.length;
      (sessionManager as unknown as { noteUnboundFunctionBreakpoints: (s: unknown) => void })
        .noteUnboundFunctionBreakpoints(managed);
      expect(managed.outputBuffer!.read(0, 20).entries.length).toBe(before);
    });

    it('stamps adapter ids from the pre-launch function-breakpoints-synced event', async () => {
      const session = await createPausedSession();
      const managed = sessionManager.getSession(session.id)!;
      managed.functionBreakpoints.set('f1', { id: 'f1', functionName: 'main', verified: false });
      managed.functionBreakpoints.set('f2', { id: 'f2', functionName: 'main', verified: false });

      dependencies.mockProxyManager.simulateEvent('function-breakpoints-synced', [
        { name: 'main', verified: true, id: 7, line: 3, source: '/src/main.rs' },
        { name: 'main', verified: false },
        { name: 'unknown_name', verified: true, id: 9 }
      ]);

      const first = managed.functionBreakpoints.get('f1')!;
      expect(first.adapterId).toBe(7);
      expect(first.verified).toBe(true);
      expect(first.boundLine).toBe(3);
      expect(first.boundFile).toBe('/src/main.rs');
      // Duplicate names consume distinct entries in order.
      const second = managed.functionBreakpoints.get('f2')!;
      expect(second.adapterId).toBeUndefined();
      expect(second.verified).toBe(false);
    });
  });
});
