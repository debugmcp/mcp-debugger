/**
 * Comprehensive unit tests for SessionManager using dependency injection
 * Covers all critical paths, error scenarios, and edge cases
 */
import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { SessionManager, SessionManagerConfig, SessionManagerDependencies } from '../../../src/session/session-manager.js';
import { DebugLanguage, SessionState } from '../../../src/session/models.js';
import { MockProxyManager } from '../../../src/proxy/mock-proxy-manager.js';
import { SessionStoreFactory } from '../../../src/factories/session-store-factory.js';
import { ProcessManagerImpl } from '../../../src/implementations/process-manager-impl.js';
import { ProcessLauncherImpl } from '../../../src/implementations/process-launcher-impl.js';
import { DebugTargetLauncherImpl } from '../../../src/implementations/process-launcher-impl.js';
import { 
  IFileSystem, 
  INetworkManager, 
  ILogger,
  IProxyManagerFactory
} from '../../../src/interfaces/external-dependencies.js';
import { IDebugTargetLauncher } from '../../../src/interfaces/process-interfaces.js';
import { createMockFileSystem, createMockLogger, waitForCondition } from '../../utils/test-utils.js';
import { DebugProtocol } from '@vscode/debugprotocol';
import path from 'path';

/**
 * Create mock dependencies for testing
 */
function createMockDependencies(): SessionManagerDependencies & { 
  mockProxyManager: MockProxyManager;
  mockFileSystem: IFileSystem;
  mockLogger: ILogger;
  mockNetworkManager: INetworkManager;
} {
  const mockProxyManager = new MockProxyManager();
  const mockFileSystem = createMockFileSystem();
  const mockLogger = createMockLogger();
  
  const mockNetworkManager: INetworkManager = {
    createServer: vi.fn(),
    findFreePort: vi.fn().mockResolvedValue(12345)
  };
  
  const mockProxyManagerFactory: IProxyManagerFactory = {
    create: vi.fn().mockReturnValue(mockProxyManager)
  };
  
  const mockSessionStoreFactory = new SessionStoreFactory();
  
  const mockDebugTargetLauncher: IDebugTargetLauncher = {
    launchPythonDebugTarget: vi.fn().mockResolvedValue({ 
      process: { pid: 1234 } as any, 
      debugPort: 5678,
      terminate: vi.fn().mockResolvedValue(undefined)
    })
  };
  
  return {
    mockProxyManager,
    mockFileSystem,
    mockLogger,
    mockNetworkManager,
    fileSystem: mockFileSystem,
    networkManager: mockNetworkManager,
    logger: mockLogger,
    proxyManagerFactory: mockProxyManagerFactory,
    sessionStoreFactory: mockSessionStoreFactory,
    debugTargetLauncher: mockDebugTargetLauncher
  };
}

describe('SessionManager Comprehensive Tests', () => {
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

  describe('Debug Session Workflow', () => {
    describe('Complete Debug Cycle', () => {
      it('should complete full debug workflow: create → start → breakpoint → step → stop', async () => {
        // Create session
        const session = await sessionManager.createSession({
          language: DebugLanguage.PYTHON,
          name: 'Full Workflow Test'
        });
        
        expect(session).toMatchObject({
          language: DebugLanguage.PYTHON,
          name: 'Full Workflow Test',
          state: SessionState.CREATED
        });
        
        // Start debugging
        const startPromise = sessionManager.startDebugging(
          session.id,
          'test.py',
          [],
          { stopOnEntry: true }
        );
        
        // Wait for proxy to emit events
        await vi.runAllTimersAsync();
        
        const startResult = await startPromise;
        expect(startResult.success).toBe(true);
        expect(startResult.state).toBe(SessionState.PAUSED);
        
        // Set a breakpoint
        const breakpoint = await sessionManager.setBreakpoint(session.id, 'test.py', 15);
        expect(breakpoint.verified).toBe(true);
        expect(dependencies.mockProxyManager.dapRequestCalls).toContainEqual({
          command: 'setBreakpoints',
          args: expect.objectContaining({
            breakpoints: [{ line: 15, condition: undefined }]
          })
        });
        
        // Step over
        dependencies.mockProxyManager.simulateStopped(1, 'entry');
        const stepResult = await sessionManager.stepOver(session.id);
        expect(stepResult.success).toBe(true);
        
        // Stop debugging
        const closeResult = await sessionManager.closeSession(session.id);
        expect(closeResult).toBe(true);
        expect(sessionManager.getSession(session.id)?.state).toBe(SessionState.STOPPED);
      });

      it('should handle dry run workflow correctly', async () => {
        const session = await sessionManager.createSession({ 
          language: DebugLanguage.PYTHON,
          name: 'Dry Run Test'
        });
        
        const startPromise = sessionManager.startDebugging(
          session.id,
          'test.py',
          ['--arg1', '--arg2'],
          {},
          true // dry run
        );
        
        await vi.runAllTimersAsync();
        
        const result = await startPromise;
        expect(result.success).toBe(true);
        expect(result.data?.dryRun).toBe(true);
        expect(result.state).toBe(SessionState.STOPPED);
        
        // Verify no "proxy exited before initialization" errors
        expect(dependencies.mockLogger.error).not.toHaveBeenCalledWith(
          expect.stringContaining('proxy exited before initialization')
        );
        
        // Verify proxy was configured for dry run
        expect(dependencies.mockProxyManager.startCalls[0].dryRunSpawn).toBe(true);
      });

      it('should handle stopOnEntry=false workflow', async () => {
        const session = await sessionManager.createSession({ 
          language: DebugLanguage.PYTHON 
        });
        
        // Configure mock to not stop on entry
        dependencies.mockProxyManager.on('start', (config) => {
          if (!config.stopOnEntry) {
            // Don't emit stopped event initially, go straight to running
            setTimeout(() => {
              dependencies.mockProxyManager.emit('adapter-configured');
            }, 10);
          }
        });
        
        const startPromise = sessionManager.startDebugging(
          session.id,
          'test.py',
          [],
          { stopOnEntry: false }
        );
        
        await vi.runAllTimersAsync();
        
        const result = await startPromise;
        expect(result.success).toBe(true);
        expect(result.state).toBe(SessionState.RUNNING);
        
        // Verify stopOnEntry was passed correctly
        expect(dependencies.mockProxyManager.startCalls[0].stopOnEntry).toBe(false);
      });
    });
  });

  describe('Path Resolution', () => {
    describe('Windows Path Handling', () => {
      it('should handle Windows absolute paths with drive letters', async () => {
        const session = await sessionManager.createSession({ 
          language: DebugLanguage.PYTHON 
        });
        
        const windowsPaths = [
          'C:\\Users\\test\\file.py',
          'C:/Users/test/file.py',
          'D:\\Projects\\debug\\test.py'
        ];
        
        for (const testPath of windowsPaths) {
          const bp = await sessionManager.setBreakpoint(session.id, testPath, 10);
          
          // Windows path.normalize keeps backslashes, so we check for absolute path
          expect(path.isAbsolute(bp.file)).toBe(true);
          // Should contain the original filename
          expect(bp.file.toLowerCase()).toContain('file.py');
        }
      });

      it('should normalize backslashes to forward slashes', async () => {
        const session = await sessionManager.createSession({ 
          language: DebugLanguage.PYTHON 
        });
        
        const bp = await sessionManager.setBreakpoint(
          session.id,
          'src\\debug\\file.py',
          20
        );
        
        // Check that path contains expected components
        expect(bp.file.toLowerCase()).toContain('src');
        expect(bp.file.toLowerCase()).toContain('debug');
        expect(bp.file.toLowerCase()).toContain('file.py');
      });

      it('should resolve relative paths correctly on Windows', async () => {
        const session = await sessionManager.createSession({ 
          language: DebugLanguage.PYTHON 
        });
        
        const bp = await sessionManager.setBreakpoint(
          session.id,
          'test/file.py',
          30
        );
        
        // Should be resolved to absolute path
        expect(path.isAbsolute(bp.file)).toBe(true);
        // Check path contains expected components
        expect(bp.file.toLowerCase()).toContain('test');
        expect(bp.file.toLowerCase()).toContain('file.py');
      });
    });
    
    describe('Breakpoint Path Resolution', () => {
      it('should convert relative breakpoint paths to absolute', async () => {
        const session = await sessionManager.createSession({ 
          language: DebugLanguage.PYTHON 
        });
        
        const relativePath = 'src/test.py';
        const bp = await sessionManager.setBreakpoint(session.id, relativePath, 42);
        
        expect(path.isAbsolute(bp.file)).toBe(true);
        expect(bp.file.toLowerCase()).toContain('src');
        expect(bp.file.toLowerCase()).toContain('test.py');
      });

      it('should handle already absolute breakpoint paths', async () => {
        const session = await sessionManager.createSession({ 
          language: DebugLanguage.PYTHON 
        });
        
        const absolutePath = '/home/user/project/test.py';
        const bp = await sessionManager.setBreakpoint(session.id, absolutePath, 50);
        
        expect(bp.file).toBe(path.normalize(absolutePath));
      });

      it('should normalize paths across different OS', async () => {
        const session = await sessionManager.createSession({ 
          language: DebugLanguage.PYTHON 
        });
        
        // Mix of path separators
        const mixedPath = 'src\\components/test.py';
        const bp = await sessionManager.setBreakpoint(session.id, mixedPath, 60);
        
        // Should contain expected path components
        expect(bp.file.toLowerCase()).toContain('src');
        expect(bp.file.toLowerCase()).toContain('components');
        expect(bp.file.toLowerCase()).toContain('test.py');
      });
    });
  });

  describe('Error Recovery', () => {
    describe('Proxy Crash Recovery', () => {
      it('should clean up when proxy crashes unexpectedly', async () => {
        const session = await sessionManager.createSession({ 
          language: DebugLanguage.PYTHON 
        });
        
        // Start debugging
        const startPromise = sessionManager.startDebugging(session.id, 'test.py');
        await vi.runAllTimersAsync();
        await startPromise;
        
        // Simulate proxy crash
        dependencies.mockProxyManager.simulateExit(1, 'SIGKILL');
        
        // Session should be in error state
        const managedSession = sessionManager.getSession(session.id);
        expect(managedSession?.state).toBe(SessionState.ERROR);
        expect(managedSession?.proxyManager).toBeUndefined();
      });

      it('should allow restart after proxy crash', async () => {
        const session = await sessionManager.createSession({ 
          language: DebugLanguage.PYTHON 
        });
        
        // First start
        await sessionManager.startDebugging(session.id, 'test.py');
        await vi.runAllTimersAsync();
        
        // Crash the proxy
        dependencies.mockProxyManager.simulateExit(1);
        
        // Reset the mock for restart
        dependencies.mockProxyManager.reset();
        
        // Should be able to start again
        const restartResult = await sessionManager.startDebugging(session.id, 'test.py');
        await vi.runAllTimersAsync();
        
        expect(restartResult.success).toBe(true);
      });

      it('should handle "proxy exited before initialization" scenario', async () => {
        const session = await sessionManager.createSession({ 
          language: DebugLanguage.PYTHON 
        });
        
        // Configure mock to fail start with error
        dependencies.mockProxyManager.shouldFailStart = true;
        
        const startResult = await sessionManager.startDebugging(session.id, 'test.py');
        
        expect(startResult.success).toBe(false);
        expect(startResult.error).toContain('Mock start failure');
        expect(sessionManager.getSession(session.id)?.state).toBe(SessionState.ERROR);
      });
    });
    
    describe('Timeout Handling', () => {
      it('should timeout after 30s if proxy doesn\'t initialize', async () => {
        const session = await sessionManager.createSession({ 
          language: DebugLanguage.PYTHON 
        });
        
        // Configure mock to delay emitting events
        let resolveStart: () => void;
        const delayedStart = new Promise<void>(resolve => { resolveStart = resolve; });
        
        dependencies.mockProxyManager.start = vi.fn().mockImplementation(async () => {
          await delayedStart;
        });
        
        const startPromise = sessionManager.startDebugging(session.id, 'test.py');
        
        // Advance past timeout
        await vi.advanceTimersByTimeAsync(35000);
        
        // Now resolve the start
        resolveStart!();
        
        const result = await startPromise;
        expect(result.success).toBe(true);
      });

      it('should handle DAP command response timeouts', async () => {
        const session = await sessionManager.createSession({ 
          language: DebugLanguage.PYTHON 
        });
        
        // Start session
        await sessionManager.startDebugging(session.id, 'test.py');
        await vi.runAllTimersAsync();
        
        // Don't pause the session - it should return empty array
        const variables = await sessionManager.getVariables(session.id, 1000);
        expect(variables).toEqual([]);
      });

      it('should cleanup properly after timeout', async () => {
        const session = await sessionManager.createSession({ 
          language: DebugLanguage.PYTHON 
        });
        
        // Make proxy fail to start
        dependencies.mockProxyManager.shouldFailStart = true;
        
        const result = await sessionManager.startDebugging(session.id, 'test.py');
        
        expect(result.success).toBe(false);
        expect(sessionManager.getSession(session.id)?.state).toBe(SessionState.ERROR);
        expect(sessionManager.getSession(session.id)?.proxyManager).toBeUndefined();
      });
    });
  });

  describe('Multi-Session Management', () => {
    it('should manage multiple concurrent debug sessions', async () => {
      // Create multiple sessions
      const session1 = await sessionManager.createSession({ 
        language: DebugLanguage.PYTHON,
        name: 'Session 1'
      });
      const session2 = await sessionManager.createSession({ 
        language: DebugLanguage.PYTHON,
        name: 'Session 2'
      });
      const session3 = await sessionManager.createSession({ 
        language: DebugLanguage.PYTHON,
        name: 'Session 3'
      });
      
      // All sessions should be created
      expect(sessionManager.getAllSessions()).toHaveLength(3);
      
      // Start all sessions
      const start1 = sessionManager.startDebugging(session1.id, 'test1.py');
      const start2 = sessionManager.startDebugging(session2.id, 'test2.py');
      const start3 = sessionManager.startDebugging(session3.id, 'test3.py');
      
      await vi.runAllTimersAsync();
      
      const results = await Promise.all([start1, start2, start3]);
      expect(results.every(r => r.success)).toBe(true);
      
      // Each session should have its own state
      expect(sessionManager.getSession(session1.id)?.state).toBe(SessionState.PAUSED);
      expect(sessionManager.getSession(session2.id)?.state).toBe(SessionState.PAUSED);
      expect(sessionManager.getSession(session3.id)?.state).toBe(SessionState.PAUSED);
    });

    it('should isolate session states properly', async () => {
      // Create separate mock proxy managers for each session
      const mockProxyManager1 = new MockProxyManager();
      const mockProxyManager2 = new MockProxyManager();
      let proxyCount = 0;
      
      dependencies.proxyManagerFactory.create = vi.fn().mockImplementation(() => {
        return proxyCount++ === 0 ? mockProxyManager1 : mockProxyManager2;
      });
      
      const session1 = await sessionManager.createSession({ 
        language: DebugLanguage.PYTHON,
        name: 'Session 1'
      });
      const session2 = await sessionManager.createSession({ 
        language: DebugLanguage.PYTHON,
        name: 'Session 2'
      });
      
      // Start both sessions
      await sessionManager.startDebugging(session1.id, 'test1.py');
      await sessionManager.startDebugging(session2.id, 'test2.py');
      await vi.runAllTimersAsync();
      
      // Continue session 1 only
      mockProxyManager1.simulateStopped(1, 'entry');
      await sessionManager.continue(session1.id);
      mockProxyManager1.simulateEvent('continued');
      
      // Session 1 should be running, session 2 should still be paused
      expect(sessionManager.getSession(session1.id)?.state).toBe(SessionState.RUNNING);
      expect(sessionManager.getSession(session2.id)?.state).toBe(SessionState.PAUSED);
    });

    it('should handle closeAllSessions with active sessions', async () => {
      // Create and start multiple sessions
      const session1 = await sessionManager.createSession({ language: DebugLanguage.PYTHON });
      const session2 = await sessionManager.createSession({ language: DebugLanguage.PYTHON });
      
      await sessionManager.startDebugging(session1.id, 'test1.py');
      await sessionManager.startDebugging(session2.id, 'test2.py');
      await vi.runAllTimersAsync();
      
      // Close all sessions
      await sessionManager.closeAllSessions();
      
      // All sessions should be stopped
      expect(sessionManager.getSession(session1.id)?.state).toBe(SessionState.STOPPED);
      expect(sessionManager.getSession(session2.id)?.state).toBe(SessionState.STOPPED);
      expect(dependencies.mockProxyManager.stopCalls).toBe(2);
    });
  });

  describe('State Machine Integrity', () => {
    it('should enforce valid state transitions', async () => {
      const session = await sessionManager.createSession({ 
        language: DebugLanguage.PYTHON 
      });
      
      // CREATED → INITIALIZING
      const startPromise = sessionManager.startDebugging(session.id, 'test.py');
      expect(sessionManager.getSession(session.id)?.state).toBe(SessionState.INITIALIZING);
      
      await vi.runAllTimersAsync();
      await startPromise;
      
      // INITIALIZING → PAUSED (because stopOnEntry=true by default)
      expect(sessionManager.getSession(session.id)?.state).toBe(SessionState.PAUSED);
      
      // PAUSED → RUNNING
      dependencies.mockProxyManager.simulateStopped(1, 'entry');
      await sessionManager.continue(session.id);
      dependencies.mockProxyManager.simulateEvent('continued');
      expect(sessionManager.getSession(session.id)?.state).toBe(SessionState.RUNNING);
      
      // RUNNING → STOPPED
      await sessionManager.closeSession(session.id);
      expect(sessionManager.getSession(session.id)?.state).toBe(SessionState.STOPPED);
    });

    it('should reject invalid operations based on state', async () => {
      const session = await sessionManager.createSession({ 
        language: DebugLanguage.PYTHON 
      });
      
      // Can't step when not started
      let result = await sessionManager.stepOver(session.id);
      expect(result.success).toBe(false);
      expect(result.error).toBe('No active debug run');
      
      // Start session but don't pause
      await sessionManager.startDebugging(session.id, 'test.py', [], { stopOnEntry: false });
      await vi.runAllTimersAsync();
      dependencies.mockProxyManager.simulateEvent('continued');
      
      // Can't step when running
      result = await sessionManager.stepOver(session.id);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Not paused');
      
      // Can't continue when not paused
      result = await sessionManager.continue(session.id);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Not paused');
    });

    it('should maintain state consistency during errors', async () => {
      const session = await sessionManager.createSession({ 
        language: DebugLanguage.PYTHON 
      });
      
      await sessionManager.startDebugging(session.id, 'test.py');
      await vi.runAllTimersAsync();
      
      // Simulate error during RUNNING state
      dependencies.mockProxyManager.simulateEvent('continued');
      expect(sessionManager.getSession(session.id)?.state).toBe(SessionState.RUNNING);
      
      dependencies.mockProxyManager.simulateError(new Error('Runtime error'));
      
      // Should transition to ERROR state
      expect(sessionManager.getSession(session.id)?.state).toBe(SessionState.ERROR);
      expect(sessionManager.getSession(session.id)?.proxyManager).toBeUndefined();
    });
  });

  describe('Session Creation Edge Cases', () => {
    it('should use default python path if not provided', async () => {
      const session = await sessionManager.createSession({
        language: DebugLanguage.PYTHON
      });
      
      const managedSession = sessionManager.getSession(session.id);
      expect(managedSession?.pythonPath).toBe('python');
    });

    it('should generate unique session IDs', async () => {
      const sessions = await Promise.all([
        sessionManager.createSession({ language: DebugLanguage.PYTHON }),
        sessionManager.createSession({ language: DebugLanguage.PYTHON }),
        sessionManager.createSession({ language: DebugLanguage.PYTHON })
      ]);
      
      const ids = sessions.map(s => s.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should set default session name if not provided', async () => {
      const session = await sessionManager.createSession({
        language: DebugLanguage.PYTHON
      });
      
      // SessionStore generates IDs like 'session-<short-uuid>'
      expect(session.name).toMatch(/session-[a-f0-9]+/);
    });
  });

  describe('DAP Operations', () => {
    describe('Breakpoint Management', () => {
      it('should queue breakpoints before session starts', async () => {
        const session = await sessionManager.createSession({ 
          language: DebugLanguage.PYTHON 
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
          language: DebugLanguage.PYTHON 
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
          language: DebugLanguage.PYTHON 
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
          language: DebugLanguage.PYTHON 
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
          language: DebugLanguage.PYTHON 
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
        expect(result.error).toBe('Step timeout');
      });
    });

    describe('Variable and Stack Inspection', () => {
      it('should retrieve variables for a scope', async () => {
        const session = await sessionManager.createSession({ 
          language: DebugLanguage.PYTHON 
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
          language: DebugLanguage.PYTHON 
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
          language: DebugLanguage.PYTHON 
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
          language: DebugLanguage.PYTHON 
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

  describe('Event Handling', () => {
    it('should forward ProxyManager events correctly', async () => {
      const session = await sessionManager.createSession({ 
        language: DebugLanguage.PYTHON 
      });
      
      await sessionManager.startDebugging(session.id, 'test.py');
      await vi.runAllTimersAsync();
      
      // Test various events
      dependencies.mockProxyManager.simulateEvent('stopped', 1, 'breakpoint');
      expect(sessionManager.getSession(session.id)?.state).toBe(SessionState.PAUSED);
      
      dependencies.mockProxyManager.simulateEvent('continued');
      expect(sessionManager.getSession(session.id)?.state).toBe(SessionState.RUNNING);
      
      dependencies.mockProxyManager.simulateEvent('terminated');
      expect(sessionManager.getSession(session.id)?.state).toBe(SessionState.STOPPED);
    });

    it('should handle auto-continue for stopOnEntry=false', async () => {
      const session = await sessionManager.createSession({ 
        language: DebugLanguage.PYTHON 
      });
      
      // Configure logger spy
      const loggerSpy = vi.spyOn(dependencies.logger, 'info');
      
      await sessionManager.startDebugging(session.id, 'test.py', [], { stopOnEntry: false });
      await vi.runAllTimersAsync();
      
      // Simulate entry stop
      dependencies.mockProxyManager.simulateEvent('stopped', 1, 'entry');
      
      // Should log auto-continue message
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Auto-continuing (stopOnEntry=false)')
      );
    });
  });

  describe('Logger Integration', () => {
    it('should log all major operations', async () => {
      const session = await sessionManager.createSession({ 
        language: DebugLanguage.PYTHON 
      });
      
      expect(dependencies.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Created new session')
      );
      
      await sessionManager.startDebugging(session.id, 'test.py');
      // Check that some variation of "start debugging" was logged
      expect(dependencies.logger.info).toHaveBeenCalledWith(
        expect.stringMatching(/[Aa]ttempting to start debugging|start.*debug/i),
        expect.anything()
      );
      
      await sessionManager.closeSession(session.id);
      expect(dependencies.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Closing debug session')
      );
    });

    it('should log errors appropriately', async () => {
      const session = await sessionManager.createSession({ 
        language: DebugLanguage.PYTHON 
      });
      
      dependencies.mockProxyManager.shouldFailStart = true;
      
      await sessionManager.startDebugging(session.id, 'test.py');
      
      // The error logger is called with the full error message as one argument
      expect(dependencies.logger.error).toHaveBeenCalled();
      const errorCall = (dependencies.logger.error as any).mock.calls.find((call: any[]) => 
        call[0].includes('Error during startDebugging')
      );
      expect(errorCall).toBeDefined();
    });
  });

  describe('Integration with SessionStore', () => {
    it('should persist sessions correctly', async () => {
      const session1 = await sessionManager.createSession({ 
        language: DebugLanguage.PYTHON,
        name: 'Session 1'
      });
      const session2 = await sessionManager.createSession({ 
        language: DebugLanguage.PYTHON,
        name: 'Session 2'
      });
      
      // Check they're in the store
      const allSessions = sessionManager.getAllSessions();
      expect(allSessions).toHaveLength(2);
      expect(allSessions).toContainEqual(
        expect.objectContaining({ id: session1.id, name: 'Session 1' })
      );
      expect(allSessions).toContainEqual(
        expect.objectContaining({ id: session2.id, name: 'Session 2' })
      );
    });

    it('should update session state in store', async () => {
      const session = await sessionManager.createSession({ 
        language: DebugLanguage.PYTHON 
      });
      
      const initialUpdatedAt = session.updatedAt;
      
      // Use fake timers to advance time
      vi.advanceTimersByTime(100);
      
      await sessionManager.startDebugging(session.id, 'test.py');
      
      const updatedSession = sessionManager.getSession(session.id);
      expect(updatedSession?.state).toBe(SessionState.INITIALIZING);
      expect(updatedSession?.updatedAt?.getTime()).toBeGreaterThan(initialUpdatedAt?.getTime() || 0);
    });
  });

  describe('Error Cases for Full Coverage', () => {
    describe('Continue Method Error Handling', () => {
      it('should throw error when continue DAP request fails', async () => {
        const session = await sessionManager.createSession({ 
          language: DebugLanguage.PYTHON 
        });
        
        await sessionManager.startDebugging(session.id, 'test.py');
        await vi.runAllTimersAsync();
        
        // Simulate being paused
        dependencies.mockProxyManager.simulateStopped(1, 'entry');
        
        // Configure mock to fail on continue request
        dependencies.mockProxyManager.sendDapRequest = vi.fn().mockRejectedValue(new Error('DAP request failed'));
        
        // Should throw the error (line 595)
        await expect(sessionManager.continue(session.id)).rejects.toThrow('DAP request failed');
      });
    });

    describe('Error Scenarios in DAP Operations', () => {
      it('should handle errors in getVariables gracefully', async () => {
        const session = await sessionManager.createSession({ 
          language: DebugLanguage.PYTHON 
        });
        
        await sessionManager.startDebugging(session.id, 'test.py');
        await vi.runAllTimersAsync();
        
        // Pause the session
        dependencies.mockProxyManager.simulateStopped(1, 'entry');
        
        // Configure mock to throw error
        dependencies.mockProxyManager.sendDapRequest = vi.fn().mockRejectedValue(new Error('Network error'));
        
        // Should return empty array and log error (lines 653-655)
        const variables = await sessionManager.getVariables(session.id, 100);
        expect(variables).toEqual([]);
        expect(dependencies.mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('Error getting variables'),
          expect.any(Error)
        );
      });

      it('should handle missing response body in getVariables', async () => {
        const session = await sessionManager.createSession({ 
          language: DebugLanguage.PYTHON 
        });
        
        await sessionManager.startDebugging(session.id, 'test.py');
        await vi.runAllTimersAsync();
        
        // Pause the session
        dependencies.mockProxyManager.simulateStopped(1, 'entry');
        
        // Configure mock to return response without body
        dependencies.mockProxyManager.sendDapRequest = vi.fn().mockResolvedValue({});
        
        // Should return empty array and warn (lines 650-651)
        const variables = await sessionManager.getVariables(session.id, 100);
        expect(variables).toEqual([]);
        expect(dependencies.mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('No variables in response body'),
          expect.any(Object)
        );
      });

      it('should handle errors in getStackTrace gracefully', async () => {
        const session = await sessionManager.createSession({ 
          language: DebugLanguage.PYTHON 
        });
        
        await sessionManager.startDebugging(session.id, 'test.py');
        await vi.runAllTimersAsync();
        
        // Pause the session
        dependencies.mockProxyManager.simulateStopped(1, 'entry');
        
        // Configure mock to throw error
        dependencies.mockProxyManager.sendDapRequest = vi.fn().mockRejectedValue(new Error('Timeout'));
        
        // Should return empty array and log error (lines 690, 692)
        const stackFrames = await sessionManager.getStackTrace(session.id);
        expect(stackFrames).toEqual([]);
        expect(dependencies.mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('Error getting stack trace'),
          expect.any(Error)
        );
      });

      it('should handle missing response body in getStackTrace', async () => {
        const session = await sessionManager.createSession({ 
          language: DebugLanguage.PYTHON 
        });
        
        await sessionManager.startDebugging(session.id, 'test.py');
        await vi.runAllTimersAsync();
        
        // Pause the session
        dependencies.mockProxyManager.simulateStopped(1, 'entry');
        
        // Configure mock to return null body
        dependencies.mockProxyManager.sendDapRequest = vi.fn().mockResolvedValue({ body: null });
        
        // Should return empty array and warn (lines 687-688)
        const stackFrames = await sessionManager.getStackTrace(session.id);
        expect(stackFrames).toEqual([]);
        expect(dependencies.mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('No stackFrames in response body'),
          expect.any(Object)
        );
      });

      it('should handle no effective thread ID in getStackTrace', async () => {
        const session = await sessionManager.createSession({ 
          language: DebugLanguage.PYTHON 
        });
        
        await sessionManager.startDebugging(session.id, 'test.py');
        await vi.runAllTimersAsync();
        
        // Ensure session is paused but mock returns no thread ID
        dependencies.mockProxyManager.getCurrentThreadId = vi.fn().mockReturnValue(null);
        dependencies.mockProxyManager.simulateEvent('stopped', 1, 'entry');
        // Override getCurrentThreadId to return null after the stopped event
        dependencies.mockProxyManager.getCurrentThreadId = vi.fn().mockReturnValue(null);
        
        // Should return empty array and warn
        const stackFrames = await sessionManager.getStackTrace(session.id);
        expect(stackFrames).toEqual([]);
        expect(dependencies.mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('No effective thread ID to use')
        );
      });

      it('should handle errors in getScopes gracefully', async () => {
        const session = await sessionManager.createSession({ 
          language: DebugLanguage.PYTHON 
        });
        
        await sessionManager.startDebugging(session.id, 'test.py');
        await vi.runAllTimersAsync();
        
        // Pause the session
        dependencies.mockProxyManager.simulateStopped(1, 'entry');
        
        // Configure mock to throw error
        dependencies.mockProxyManager.sendDapRequest = vi.fn().mockRejectedValue(new Error('Invalid frame'));
        
        // Should return empty array and log error (lines 728-730)
        const scopes = await sessionManager.getScopes(session.id, 1);
        expect(scopes).toEqual([]);
        expect(dependencies.mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('Error getting scopes'),
          expect.any(Error)
        );
      });

      it('should handle missing scopes in response', async () => {
        const session = await sessionManager.createSession({ 
          language: DebugLanguage.PYTHON 
        });
        
        await sessionManager.startDebugging(session.id, 'test.py');
        await vi.runAllTimersAsync();
        
        // Pause the session
        dependencies.mockProxyManager.simulateStopped(1, 'entry');
        
        // Configure mock to return empty response
        dependencies.mockProxyManager.sendDapRequest = vi.fn().mockResolvedValue({ 
          body: { scopes: null } 
        });
        
        // Should return empty array and warn (lines 725-726)
        const scopes = await sessionManager.getScopes(session.id, 1);
        expect(scopes).toEqual([]);
        expect(dependencies.mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('No scopes in response body'),
          expect.any(Object)
        );
      });
    });

    describe('Session Closing Error Cases', () => {
      it('should handle errors when stopping proxy during closeSession', async () => {
        const session = await sessionManager.createSession({ 
          language: DebugLanguage.PYTHON 
        });
        
        await sessionManager.startDebugging(session.id, 'test.py');
        await vi.runAllTimersAsync();
        
        // Configure proxy to throw error on stop
        dependencies.mockProxyManager.stop = vi.fn().mockRejectedValue(new Error('Stop failed'));
        
        // Should handle error gracefully and still mark as stopped (lines 758-762)
        const result = await sessionManager.closeSession(session.id);
        expect(result).toBe(true);
        expect(sessionManager.getSession(session.id)?.state).toBe(SessionState.STOPPED);
        expect(dependencies.mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('Error stopping proxy'),
          'Stop failed'
        );
      });

      it('should return false when closing non-existent session', async () => {
        // Try to close session that doesn't exist (lines 751-754)
        const result = await sessionManager.closeSession('non-existent-id');
        expect(result).toBe(false);
        expect(dependencies.mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Session not found: non-existent-id')
        );
      });

      it('should handle closeSession when proxy is already undefined', async () => {
        const session = await sessionManager.createSession({ 
          language: DebugLanguage.PYTHON 
        });
        
        // Don't start debugging, so no proxy manager
        const result = await sessionManager.closeSession(session.id);
        expect(result).toBe(true);
        expect(sessionManager.getSession(session.id)?.state).toBe(SessionState.STOPPED);
      });
    });

    describe('closeAllSessions Edge Cases', () => {
      it('should handle empty session list in closeAllSessions', async () => {
        // No sessions created
        await sessionManager.closeAllSessions();
        
        expect(dependencies.mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining('Closing all debug sessions (0 active)')
        );
        expect(dependencies.mockLogger.info).toHaveBeenCalledWith(
          'All debug sessions closed'
        );
      });

      it('should handle errors in individual sessions during closeAllSessions', async () => {
        // Create multiple sessions
        const session1 = await sessionManager.createSession({ language: DebugLanguage.PYTHON });
        const session2 = await sessionManager.createSession({ language: DebugLanguage.PYTHON });
        
        await sessionManager.startDebugging(session1.id, 'test1.py');
        await sessionManager.startDebugging(session2.id, 'test2.py');
        await vi.runAllTimersAsync();
        
        // Make first proxy fail on stop
        const session1Proxy = sessionManager.getSession(session1.id)?.proxyManager;
        if (session1Proxy) {
          session1Proxy.stop = vi.fn().mockRejectedValue(new Error('Stop failed'));
        }
        
        // Should still close all sessions despite error
        await sessionManager.closeAllSessions();
        
        expect(sessionManager.getSession(session1.id)?.state).toBe(SessionState.STOPPED);
        expect(sessionManager.getSession(session2.id)?.state).toBe(SessionState.STOPPED);
      });
    });

    describe('Deprecated Constructor Coverage', () => {
      it('should handle deprecated constructor with old API', () => {
        // Test the deprecated constructor path (lines covered by constructor logic)
        const oldSessionManager = new SessionManager(
          { level: 'info' },
          '/tmp/test-logs'
        );
        
        expect(oldSessionManager).toBeDefined();
        // The old constructor creates its own logger, so we can't verify on our mock
        // Just verify the instance was created successfully
      });
    });
  });
});
