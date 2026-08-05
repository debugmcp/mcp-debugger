/**
 * SessionManager DAP operations tests
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionManager, SessionManagerConfig } from '../../../../src/session/session-manager.js';
import { DebugLanguage, SessionState } from '@debugmcp/shared';
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
      
      const bp1 = await sessionManager.setBreakpoint(session.id, 'test.py', 10);
      const bp2 = await sessionManager.setBreakpoint(session.id, 'test.py', 20);
      
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
      const bp = await sessionManager.setBreakpoint(session.id, 'test.py', 15);
      
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
      
      const bp = await sessionManager.setBreakpoint(
        session.id, 
        'test.py', 
        25, 
        'x > 10'
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

      const bp = await sessionManager.setBreakpoint(session.id, 'test.py', 15);

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

      const bp = await sessionManager.setBreakpoint(
        session.id, 'test.py', 20, undefined, undefined, 'value is {x}'
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
        session.id, 'test.py', 20, 'x > 1', 'thread', 'value is {x}'
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
        session.id, 'test.py', 21, 'x > 5', undefined, 'big x: {x}'
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

      const bp = await sessionManager.setBreakpoint(session.id, 'test.py', 10);
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

      await sessionManager.setBreakpoint(session.id, 'b.py', 20);
      await sessionManager.setBreakpoint(session.id, 'a.py', 30);
      await sessionManager.setBreakpoint(session.id, 'a.py', 10);

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

      await sessionManager.setBreakpoint(session.id, 'a.py', 10);
      await sessionManager.setBreakpoint(session.id, 'b.py', 20);

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

      const bp1 = await sessionManager.setBreakpoint(session.id, 'test.py', 10);
      await sessionManager.setBreakpoint(session.id, 'test.py', 20);

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

      const bp1 = await sessionManager.setBreakpoint(session.id, 'test.py', 10);
      await sessionManager.setBreakpoint(session.id, 'test.py', 20);
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

      const bp = await sessionManager.setBreakpoint(session.id, 'test.py', 10);
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

      await sessionManager.setBreakpoint(session.id, 'test.py', 10, 'x > 1');
      await sessionManager.setBreakpoint(session.id, 'test.py', 10, 'x > 2');
      await sessionManager.setBreakpoint(session.id, 'test.py', 20);

      const result = await sessionManager.removeBreakpointsByLocation(session.id, 'test.py', 10);

      expect(result.removed).toHaveLength(2);
      expect(sessionManager.listBreakpoints(session.id).map(bp => bp.line)).toEqual([20]);
    });

    it('removes nothing when no breakpoint exists at the location', async () => {
      const session = await sessionManager.createSession({
        language: DebugLanguage.MOCK,
        executablePath: 'python'
      });

      await sessionManager.setBreakpoint(session.id, 'test.py', 10);

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

      await sessionManager.setBreakpoint(session.id, 'a.py', 10);
      await sessionManager.setBreakpoint(session.id, 'a.py', 20);
      await sessionManager.setBreakpoint(session.id, 'b.py', 30);
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

      await sessionManager.setBreakpoint(session.id, 'a.py', 10);
      await sessionManager.setBreakpoint(session.id, 'b.py', 20);
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

      const bp1 = await sessionManager.setBreakpoint(session.id, 'test.py', 10);
      await sessionManager.setBreakpoint(session.id, 'test.py', 20);

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

      const bp1 = await sessionManager.setBreakpoint(session.id, 'test.py', 10);
      await sessionManager.setBreakpoint(session.id, 'test.py', 20);
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

      const bp = await sessionManager.setBreakpoint(session.id, 'test.py', 10);
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
      const bp = await sessionManager.setBreakpoint(session.id, 'C:\\proj\\app.js', 9);
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
      const bp = await sessionManager.setBreakpoint(
        session.id, 'test.py', 20, undefined, undefined, 'x is {x}'
      );

      dependencies.mockProxyManager.simulateEvent('adapter-capabilities', { supportsLogPoints: false });

      const [stored] = sessionManager.listBreakpoints(session.id);
      expect(stored.id).toBe(bp.id);
      expect(stored.message).toMatch(/logpoint/i);
    });

    it('leaves logpoints unannotated when live capabilities advertise support', async () => {
      const session = await createPausedSession();
      await sessionManager.setBreakpoint(
        session.id, 'test.py', 20, undefined, undefined, 'x is {x}'
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
});
