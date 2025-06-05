/**
 * Clean unit tests for SessionManager using dependency injection
 * This demonstrates the improved testability with the new architecture
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionManager, SessionManagerDependencies } from '../../../src/session/session-manager.js';
import { DebugLanguage, SessionState } from '../../../src/session/models.js';
import { 
  IFileSystem, 
  IProcessManager, 
  INetworkManager, 
  ILogger,
  IChildProcess,
  IServer,
  IProxyManagerFactory
} from '../../../src/interfaces/external-dependencies.js';
import { EventEmitter } from 'events';
import { MockProxyManager } from '../../../src/proxy/mock-proxy-manager.js';

/**
 * Create a mock child process for testing
 */
class MockChildProcess extends EventEmitter implements IChildProcess {
  send = vi.fn<(message: any) => boolean>().mockReturnValue(true);
  kill = vi.fn<(signal?: string) => boolean>().mockReturnValue(true);
  stderr: NodeJS.ReadableStream | null = null;
  stdout: NodeJS.ReadableStream | null = null;
  stdin: NodeJS.WritableStream | null = null;
  pid = 12345;
  killed = false;
  exitCode: number | null = null;

  constructor() {
    super();
    // Create mock streams that extend EventEmitter
    this.stderr = new EventEmitter() as any;
    this.stdout = new EventEmitter() as any;
    this.stdin = new EventEmitter() as any;
  }

  simulateMessage(message: any) {
    this.emit('message', message);
  }

  simulateExit(code: number | null, signal: NodeJS.Signals | null = null) {
    this.exitCode = code;
    this.killed = true;
    this.emit('exit', code, signal);
  }

  simulateError(error: Error) {
    this.emit('error', error);
  }
}

/**
 * Create mock dependencies for testing
 */
function createMockDependencies(): Required<SessionManagerDependencies> & { mockProxyManager: MockProxyManager } {
  const mockProxyManager = new MockProxyManager();
  const mockChildProcess = new MockChildProcess();
  
  const mockFileSystem: IFileSystem = {
    // Basic fs operations
    readFile: vi.fn<() => Promise<string>>().mockResolvedValue(''),
    writeFile: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    exists: vi.fn<() => Promise<boolean>>().mockResolvedValue(true),
    mkdir: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    readdir: vi.fn<() => Promise<string[]>>().mockResolvedValue([]),
    stat: vi.fn<() => Promise<any>>().mockResolvedValue({}),
    unlink: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    rmdir: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    
    // fs-extra methods
    ensureDir: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    ensureDirSync: vi.fn<() => void>(),
    pathExists: vi.fn<() => Promise<boolean>>().mockResolvedValue(true),
    remove: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    copy: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    outputFile: vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
  };

  const mockProcessManager: IProcessManager = {
    spawn: vi.fn<() => IChildProcess>().mockReturnValue(mockChildProcess),
    exec: vi.fn<() => Promise<{ stdout: string; stderr: string }>>()
      .mockResolvedValue({ stdout: '', stderr: '' })
  };

  const mockNetworkManager: INetworkManager = {
    createServer: vi.fn<() => IServer>(),
    findFreePort: vi.fn<() => Promise<number>>().mockResolvedValue(12345)
  };

  const mockLogger: ILogger = {
    info: vi.fn<() => void>(),
    error: vi.fn<() => void>(),
    debug: vi.fn<() => void>(),
    warn: vi.fn<() => void>()
  };
  
  const mockProxyManagerFactory: IProxyManagerFactory = {
    create: vi.fn<() => MockProxyManager>().mockReturnValue(mockProxyManager)
  };
  
  return {
    mockProxyManager,
    fileSystem: mockFileSystem,
    processManager: mockProcessManager,
    networkManager: mockNetworkManager,
    logger: mockLogger,
    proxyManagerFactory: mockProxyManagerFactory
  };
}

describe.skip('SessionManager with Dependency Injection', () => {
  let sessionManager: SessionManager;
  let deps: Required<SessionManagerDependencies> & { mockProxyManager: MockProxyManager };

  beforeEach(() => {
    vi.useFakeTimers();
    deps = createMockDependencies();
    sessionManager = new SessionManager({}, undefined, deps);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    deps.mockProxyManager.reset();
  });

  describe('Session Creation', () => {
    it('should create a new Python session', async () => {
      const session = await sessionManager.createSession({
        language: DebugLanguage.PYTHON,
        name: 'Test Session'
      });

      expect(session).toMatchObject({
        language: DebugLanguage.PYTHON,
        name: 'Test Session',
        state: SessionState.CREATED
      });
      expect(session.id).toBeDefined();
      expect(session.createdAt).toBeInstanceOf(Date);
    });

    it('should use default python path if not provided', async () => {
      const session = await sessionManager.createSession({
        language: DebugLanguage.PYTHON
      });

      const managedSession = sessionManager.getSession(session.id);
      expect(managedSession?.pythonPath).toBe('python');
    });

    it('should reject unsupported languages', async () => {
      await expect(
        sessionManager.createSession({
          language: 'javascript' as DebugLanguage
        })
      ).rejects.toThrow("Language 'javascript' is not supported");
    });
  });

  describe('Debug Session Lifecycle', () => {
    it('should start debugging with proper initialization', async () => {
      const session = await sessionManager.createSession({
        language: DebugLanguage.PYTHON,
        name: 'Debug Test'
      });

      const startPromise = sessionManager.startDebugging(
        session.id,
        'test.py',
        [],
        { stopOnEntry: true }
      );

      // Verify dependencies were called correctly
      expect(deps.fileSystem.ensureDir).toHaveBeenCalled();
      expect(deps.networkManager.findFreePort).toHaveBeenCalled();
      expect(deps.proxyManagerFactory.create).toHaveBeenCalled();

      // The ProxyManager will automatically simulate events based on config
      // Wait for the result
      vi.runAllTimers();

      const result = await startPromise;
      expect(result).toMatchObject({
        success: true,
        state: SessionState.PAUSED
      });
      expect(deps.mockProxyManager.startCalls).toHaveLength(1);
    });

    it('should handle dry run mode', async () => {
      const session = await sessionManager.createSession({
        language: DebugLanguage.PYTHON
      });

      const startPromise = sessionManager.startDebugging(
        session.id,
        'test.py',
        [],
        {},
        true // dry run
      );

      // The MockProxyManager will automatically emit dry-run-complete
      vi.runAllTimers();

      const result = await startPromise;
      expect(result).toMatchObject({
        success: true,
        state: SessionState.STOPPED,
        data: {
          dryRun: true
        }
      });
      expect(deps.mockProxyManager.startCalls[0].dryRunSpawn).toBe(true);
    });

    it('should handle spawn failures gracefully', async () => {
      const session = await sessionManager.createSession({
        language: DebugLanguage.PYTHON
      });

      // Make ProxyManager start fail
      deps.mockProxyManager.shouldFailStart = true;

      const result = await sessionManager.startDebugging(session.id, 'test.py');
      
      expect(result).toMatchObject({
        success: false,
        error: expect.stringContaining('Mock start failure'),
        state: SessionState.ERROR
      });
    });
  });

  describe('Breakpoint Management', () => {
    it('should queue breakpoints before session starts', async () => {
      const session = await sessionManager.createSession({
        language: DebugLanguage.PYTHON
      });

      const breakpoint = await sessionManager.setBreakpoint(
        session.id,
        'test.py',
        10
      );

      expect(breakpoint).toMatchObject({
        line: 10,
        verified: false
      });
      expect(breakpoint.file).toContain('test.py');
    });

    it('should send breakpoints to active session', async () => {
      const session = await sessionManager.createSession({
        language: DebugLanguage.PYTHON
      });

      // Start debugging first
      const startPromise = sessionManager.startDebugging(session.id, 'test.py', [], { stopOnEntry: true });
      vi.runAllTimers();
      await startPromise;

      // Clear previous DAP calls
      deps.mockProxyManager.dapRequestCalls = [];

      // Set breakpoint on active session
      const breakpoint = await sessionManager.setBreakpoint(session.id, 'test.py', 15);

      // Verify the DAP request was made
      expect(deps.mockProxyManager.dapRequestCalls).toHaveLength(1);
      expect(deps.mockProxyManager.dapRequestCalls[0].command).toBe('setBreakpoints');
      expect(breakpoint.verified).toBe(true);
    });
  });

  describe('Session State Management', () => {
    it('should transition states correctly during debugging', async () => {
      const session = await sessionManager.createSession({
        language: DebugLanguage.PYTHON
      });

      // Initial state
      expect(sessionManager.getSession(session.id)?.state).toBe(SessionState.CREATED);

      // Start debugging with stopOnEntry
      const startPromise = sessionManager.startDebugging(session.id, 'test.py', [], { stopOnEntry: true });
      expect(sessionManager.getSession(session.id)?.state).toBe(SessionState.INITIALIZING);

      // MockProxyManager will automatically emit events
      vi.runAllTimers();
      await startPromise;
      expect(sessionManager.getSession(session.id)?.state).toBe(SessionState.PAUSED);

      // Continue execution
      deps.mockProxyManager.simulateEvent('continued');
      vi.runAllTimers();
      expect(sessionManager.getSession(session.id)?.state).toBe(SessionState.RUNNING);
    });

    it('should handle error states', async () => {
      const session = await sessionManager.createSession({
        language: DebugLanguage.PYTHON
      });

      const startPromise = sessionManager.startDebugging(session.id, 'test.py');
      
      // Simulate error during startup
      setTimeout(() => {
        deps.mockProxyManager.simulateError(new Error('Adapter failed to start'));
      }, 10);

      vi.runAllTimers();
      
      await expect(startPromise).rejects.toThrow();
      expect(sessionManager.getSession(session.id)?.state).toBe(SessionState.ERROR);
    });
  });

  describe('Session Cleanup', () => {
    it('should clean up resources when closing session', async () => {
      const session = await sessionManager.createSession({
        language: DebugLanguage.PYTHON
      });

      // Start a debug session
      const startPromise = sessionManager.startDebugging(session.id, 'test.py');
      vi.runAllTimers();
      await startPromise;

      // Close the session
      const result = await sessionManager.closeSession(session.id);
      
      expect(result).toBe(true);
      expect(deps.mockProxyManager.stopCalls).toBe(1);
      expect(sessionManager.getSession(session.id)?.state).toBe(SessionState.STOPPED);
    });

    it('should handle proxy stop failures gracefully', async () => {
      const session = await sessionManager.createSession({
        language: DebugLanguage.PYTHON
      });

      // Start a debug session
      const startPromise = sessionManager.startDebugging(session.id, 'test.py');
      vi.runAllTimers();
      await startPromise;

      // Make proxy stop throw an error
      deps.mockProxyManager.stop = vi.fn<() => Promise<void>>().mockRejectedValue(new Error('Stop failed'));

      // Close should still succeed
      const result = await sessionManager.closeSession(session.id);
      expect(result).toBe(true);
      expect(sessionManager.getSession(session.id)?.state).toBe(SessionState.STOPPED);
    });
  });

  describe('Step Operations', () => {
    async function setupPausedSession() {
      const session = await sessionManager.createSession({
        language: DebugLanguage.PYTHON
      });

      const startPromise = sessionManager.startDebugging(session.id, 'test.py', [], { stopOnEntry: true });
      vi.runAllTimers();
      await startPromise;
      
      // Clear previous DAP calls
      deps.mockProxyManager.dapRequestCalls = [];
      
      return session;
    }

    it('should handle step over correctly', async () => {
      const session = await setupPausedSession();

      // Simulate a thread ID
      deps.mockProxyManager.simulateStopped(1, 'entry');

      const stepPromise = sessionManager.stepOver(session.id);

      // Wait for the step to complete
      vi.runAllTimers();
      const result = await stepPromise;

      expect(result.success).toBe(true);
      expect(deps.mockProxyManager.dapRequestCalls).toContainEqual({
        command: 'next',
        args: { threadId: 1 }
      });
      expect(sessionManager.getSession(session.id)?.state).toBe(SessionState.PAUSED);
    });

    it('should reject step operations when not paused', async () => {
      const session = await sessionManager.createSession({
        language: DebugLanguage.PYTHON
      });

      const result = await sessionManager.stepOver(session.id);
      expect(result).toMatchObject({
        success: false,
        error: 'No active debug run'
      });
    });
  });

  describe('Variable and Stack Inspection', () => {
    it('should retrieve variables for a scope', async () => {
      const session = await sessionManager.createSession({
        language: DebugLanguage.PYTHON
      });

      const startPromise = sessionManager.startDebugging(session.id, 'test.py', [], { stopOnEntry: true });
      vi.runAllTimers();
      await startPromise;

      const variables = await sessionManager.getVariables(session.id, 1000);
      
      expect(variables).toHaveLength(2);
      expect(variables[0]).toMatchObject({
        name: 'test_var',
        value: '42',
        type: 'int',
        expandable: false
      });
      expect(deps.mockProxyManager.dapRequestCalls).toContainEqual({
        command: 'variables',
        args: { variablesReference: 1000 }
      });
    });

    it('should return empty array when not paused', async () => {
      const session = await sessionManager.createSession({
        language: DebugLanguage.PYTHON
      });

      const variables = await sessionManager.getVariables(session.id, 1000);
      expect(variables).toEqual([]);
    });
  });
});
