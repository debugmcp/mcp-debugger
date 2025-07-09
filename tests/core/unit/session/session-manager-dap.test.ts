/**
 * SessionManager DAP operations tests
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionManager, SessionManagerConfig } from '../../../../src/session/session-manager.js';
import { DebugLanguage } from '../../../../src/session/models.js';
import { createMockDependencies } from './session-manager-test-utils.js';
import { ErrorMessages } from '../../../../src/utils/error-messages.js';

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

  describe('Breakpoint Management', () => {
    it('should queue breakpoints before session starts', async () => {
      const session = await sessionManager.createSession({ 
        language: DebugLanguage.MOCK,
        pythonPath: 'python'
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
        pythonPath: 'python'
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
        pythonPath: 'python'
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
  });

  describe('Step Operations', () => {
    async function setupPausedSession() {
      const session = await sessionManager.createSession({ 
        language: DebugLanguage.MOCK,
        pythonPath: 'python'
      });
      
      await sessionManager.startDebugging(session.id, 'test.py');
      await vi.runAllTimersAsync();
      
      // Simulate being paused with a thread ID
      dependencies.mockProxyManager.simulateStopped(1, 'entry');
      
      // Clear previous calls
      dependencies.mockProxyManager.dapRequestCalls = [];
      
      return session;
    }

    it('should handle step over correctly', async () => {
      const session = await setupPausedSession();
      
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
      const session = await setupPausedSession();
      
      const result = await sessionManager.stepInto(session.id);
      
      expect(result.success).toBe(true);
      expect(dependencies.mockProxyManager.dapRequestCalls).toContainEqual({
        command: 'stepIn',
        args: { threadId: 1 }
      });
    });

    it('should handle step out correctly', async () => {
      const session = await setupPausedSession();
      
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
        pythonPath: 'python'
      });
      
      // Try stepping without starting
      let result = await sessionManager.stepOver(session.id);
      expect(result.success).toBe(false);
      expect(result.error).toBe('No active debug run');
      
      // Start but simulate running state  
      await sessionManager.startDebugging(session.id, 'test.py', [], { stopOnEntry: false });
      await vi.runAllTimersAsync();
      
      result = await sessionManager.stepOver(session.id);
      expect(result.success).toBe(false);
      // When running, it should say "Not paused"
      expect(result.error).toBe('Not paused');
    });

    it('should handle step timeout', async () => {
      const session = await setupPausedSession();
      
      // Configure mock to not emit stopped event after step
      dependencies.mockProxyManager.sendDapRequest = vi.fn().mockResolvedValue({ success: true });
      
      const stepPromise = sessionManager.stepOver(session.id);
      
      // Fast forward past timeout
      await vi.advanceTimersByTimeAsync(6000);
      
      const result = await stepPromise;
      expect(result.success).toBe(false);
      expect(result.error).toBe(ErrorMessages.stepTimeout(5));
    });
  });

  describe('Variable and Stack Inspection', () => {
    it('should retrieve variables for a scope', async () => {
      const session = await sessionManager.createSession({ 
        language: DebugLanguage.MOCK,
        pythonPath: 'python'
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
        pythonPath: 'python'
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
        pythonPath: 'python'
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
        pythonPath: 'python'
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
});
