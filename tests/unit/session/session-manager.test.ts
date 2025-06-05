// @ts-nocheck - Disable TypeScript checking for tests with complex mocking
/**
 * Unit tests for the SessionManager
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionManager, SessionManagerDependencies } from '../../../src/session/session-manager';
import { DebugLanguage, SessionState } from '../../../src/session/models';
import { createMockSession } from '../../utils/test-utils';
import { EventEmitter } from 'events';
import { ChildProcess } from 'child_process';
import { 
  IFileSystem, 
  IProcessManager, 
  INetworkManager, 
  ILogger,
  IChildProcess
} from '../../../src/interfaces/external-dependencies';

vi.mock('fs-extra', () => ({
  default: {
    ensureDir: vi.fn().mockResolvedValue(undefined),
    readJson: vi.fn().mockResolvedValue({}),
    writeJson: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    pathExists: vi.fn().mockResolvedValue(true),
    copySync: vi.fn(),
  }
}));

// Mock net with inline mock
vi.mock('net', () => ({
  default: {
    createServer: vi.fn(() => ({
      listen: vi.fn(),
      close: vi.fn(),
      address: vi.fn(),
      on: vi.fn(),
      unref: vi.fn(),
      ref: vi.fn(),
      once: vi.fn(),
      emit: vi.fn(),
      removeListener: vi.fn(),
      removeAllListeners: vi.fn(),
      setMaxListeners: vi.fn(),
      getMaxListeners: vi.fn(),
      listeners: vi.fn(),
      rawListeners: vi.fn(),
      listenerCount: vi.fn(),
      prependListener: vi.fn(),
      prependOnceListener: vi.fn(),
      eventNames: vi.fn(),
      off: vi.fn()
    }))
  }
}));

// Mock ChildProcess
class MockChildProcess extends EventEmitter {
  send = vi.fn();
  kill = vi.fn();
  pid = 12345; // Example PID
  stderr = new EventEmitter();
  stdout = new EventEmitter(); // If used by SessionManager for proxy stdout
  killed = false;

  constructor() {
    super();
    this.kill = vi.fn(() => {
      this.killed = true;
      // Simulate the 'exit' event when kill is called, as a real ChildProcess would.
      // This helps test listeners for proxyWorker.on('exit', ...)
      // Emit asynchronously to allow other synchronous code in the test to complete.
      process.nextTick(() => {
        this.emit('exit', 0, null); // Simulate a normal exit
      });
      return true; // As per ChildProcess.kill signature
    });
  }

  // Helper to simulate message from proxy worker
  simulateMessage(message: object) {
    this.emit('message', message);
  }

  // Helper to simulate stderr output from proxy worker
  simulateStderr(data: string) {
    this.stderr.emit('data', data);
  }

  // Helper to simulate proxy worker exiting
  simulateExit(code: number | null, signal: NodeJS.Signals | null = null) {
    this.killed = true; // Or based on signal
    this.emit('exit', code, signal);
  }

  // Helper to simulate an error event from the proxy worker
  simulateError(error: Error) {
    this.emit('error', error);
  }
}

// Standard debug provider mock (remains as it might be used by other parts of tests, or can be removed if truly unused)
// For now, let's keep it to minimize changes until we confirm it's not used by createMockSession or other test logic.
const mockDebugProvider = {
  initialize: vi.fn().mockResolvedValue(true),
  terminate: vi.fn().mockResolvedValue(true),
  removeBreakpoint: vi.fn().mockResolvedValue(true),
  setBreakpoint: vi.fn().mockResolvedValue({}),
  startDebugging: vi.fn().mockResolvedValue({}),
  stepOver: vi.fn().mockResolvedValue({}),
  stepInto: vi.fn().mockResolvedValue({}),
  stepOut: vi.fn().mockResolvedValue({}),
  continue: vi.fn().mockResolvedValue({}),
  pause: vi.fn().mockResolvedValue({}),
  getVariables: vi.fn().mockResolvedValue([]),
  getStackTrace: vi.fn().mockResolvedValue([]),
  evaluateExpression: vi.fn().mockResolvedValue({}),
  getSourceContext: vi.fn().mockResolvedValue({})
};

// No longer need beforeAll for unstable_mockModule or debuggerFactoryMock variable

describe.skip('SessionManager', () => {
  let sessionManager: SessionManager;
  let mockChildProcess: MockChildProcess;
  const mockSpawnFn = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    
    mockChildProcess = new MockChildProcess(); // A new mockChildProcess for each test
    
    // Configure mockSpawnFn *before* SessionManager instantiation
    // mockReset() clears any previous mockReturnValue.
    mockSpawnFn.mockReset(); 
    mockSpawnFn.mockReturnValue(mockChildProcess as unknown as ChildProcess); 

    // Instantiate SessionManager, it will capture the mockSpawnFn configured above.
    // Provide minimal mocks for other dependencies to prevent early errors in setupNewRun
    const minimalDeps = {
      fileSystem: {
        ensureDir: vi.fn().mockResolvedValue(undefined),
        pathExists: vi.fn().mockResolvedValue(true),
        readFile: vi.fn().mockResolvedValue(''),
        writeFile: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
        readdir: vi.fn().mockResolvedValue([]),
        stat: vi.fn().mockResolvedValue({ isDirectory: () => false, isFile: () => true }),
        copy: vi.fn().mockResolvedValue(undefined),
        createWriteStream: vi.fn().mockReturnValue({ on: vi.fn(), end: vi.fn() }),
      } as unknown as IFileSystem,
      processManager: {
        spawn: mockSpawnFn, // This will be overridden by the third argument to SessionManager constructor
        exec: vi.fn().mockResolvedValue({ stdout: '', stderr: '' }),
        on: vi.fn(),
        kill: vi.fn(),
      } as unknown as IProcessManager,
      networkManager: {
        findFreePort: vi.fn().mockResolvedValue(12345),
        isPortInUse: vi.fn().mockResolvedValue(false),
        createNetServer: vi.fn().mockReturnValue({
        listen: vi.fn((port, cb) => { if (cb) cb(); return this; }),
        on: vi.fn(),
        close: vi.fn(cb => { if (cb) cb(); }),
        address: vi.fn(() => ({ port: 12345 })),
        }),
      } as unknown as INetworkManager,
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        getLogLevel: vi.fn(() => 'info'),
        setLogLevel: vi.fn(),
      } as unknown as ILogger,
    };
    sessionManager = new SessionManager(minimalDeps, undefined, mockSpawnFn);
    
    // Clear call history for mockSpawnFn for the upcoming test.
    // The mock implementation (returning mockChildProcess) remains.
    mockSpawnFn.mockClear(); 

    // If mockDebugProvider is used by createMockSession or other setup, ensure its mocks are reset:
    Object.values(mockDebugProvider).forEach(mockFn => {
      if (typeof mockFn === 'function' && mockFn.mockClear) {
        mockFn.mockClear();
      }
    });
  });

  afterEach(() => {
    // Clean up
    // vi.restoreAllMocks(); // This would unmock createDebuggerProvider, not desired if mock is per-file.
    // Instead, rely on mockClear() in beforeEach. If truly needed, manage mock state carefully.
    vi.useRealTimers(); // Restore real timers
  });
  
  describe('createSession', () => {
    // Increase test timeout for this particular test
    it('should create a new session with the specified parameters', async () => {
      // Reset the mock before each test
      vi.clearAllMocks();
      
      // Act
      const session = await sessionManager.createSession({
        language: DebugLanguage.PYTHON,
        name: 'Test Session'
      });
      
      // Assert
      expect(session).toBeDefined();
      expect(session.id).toBeDefined();
      expect(session.language).toBe(DebugLanguage.PYTHON);
      expect(session.name).toBe('Test Session');
      expect(session.state).toBe(SessionState.CREATED); // Initial state is CREATED
      expect(session.createdAt).toBeInstanceOf(Date);
      expect(session.updatedAt).toBeInstanceOf(Date);
      // Breakpoints map is on the ManagedSession, not DebugSessionInfo directly
    // This test checks DebugSessionInfo, so breakpoints check is not applicable here.
    // const managedSession = sessionManager.getSession(session.id);
    // expect(managedSession?.breakpoints.size).toBe(0);

    // Verify that createDebuggerProvider was NOT called, as per recent changes
    // where SessionManager.createSession defers provider creation.
    // If it *is* meant to be called, this assertion needs to change.
    // For now, assuming it's not called based on comments in original file.
    // expect(createDebuggerProvider).not.toHaveBeenCalled(); // This line is removed as createDebuggerProvider is no longer imported/mocked here.

    }, 30000); // Increased timeout

    // These tests are obsolete as createSession no longer handles debugger provider creation/initialization directly.
    // it('should throw error if debugger provider cannot be created', async () => { ... });
    // it('should throw error if debugger initialization fails', async () => { ... });
  });

  describe('startDebugging', () => {
    it('should spawn proxy and handle initialized message on startDebugging', async () => {
      const session = await sessionManager.createSession({ language: DebugLanguage.PYTHON, name: 'TestSession1' });
      const scriptPath = 'examples/python/fibonacci.py'; // Relative to project root
      
      // Act
      const startPromise = sessionManager.startDebugging(session.id, scriptPath, [], {}, false);

      // Assert spawn was called correctly
      expect(mockSpawnFn).toHaveBeenCalledWith(
        process.execPath,
        expect.arrayContaining([expect.stringContaining('proxy-bootstrap.js')]), // Check for .js
        expect.objectContaining({
          cwd: process.cwd(), // Or specific cwd if SessionManager sets one
          env: expect.objectContaining({ MCP_SERVER_CWD: expect.any(String) }),
        })
      );

      // Simulate proxy sending 'adapter_configured_and_launched' after DAP init
      // This message indicates the proxy and the debug adapter it launched are ready.
      mockChildProcess.simulateMessage({
        type: 'status',
        status: 'adapter_configured_and_launched',
        sessionId: session.id,
      });
      
      // Advance timers to allow any internal promises/timeouts in SessionManager to resolve
      vi.runAllTimers();

      await expect(startPromise).resolves.toEqual(expect.objectContaining({ success: true }));
      
      const updatedSession = sessionManager.getSession(session.id);
      // If stopOnEntry is true (default), state should be PAUSED.
      // If stopOnEntry is false, state should be RUNNING.
      // The default dapLaunchArgs in SessionManager has stopOnEntry: true.
      // The startDebugging call here passes {} for dapLaunchArgs, so defaults are used.
      expect(updatedSession?.state).toBe(SessionState.PAUSED); // Default stopOnEntry is true
    });

    it('should handle proxy sending adapter_configured_and_launched when stopOnEntry is false', async () => {
      const session = await sessionManager.createSession({ language: DebugLanguage.PYTHON, name: 'TestSessionNoStop' });
      const scriptPath = 'examples/python/fibonacci.py';
      
      // Act: Start debugging with stopOnEntry: false
      const startPromise = sessionManager.startDebugging(session.id, scriptPath, [], { stopOnEntry: false }, false);

      expect(mockSpawnFn).toHaveBeenCalledTimes(1); // Ensure spawn is called

      // Simulate proxy sending 'adapter_configured_and_launched'
      mockChildProcess.simulateMessage({
        type: 'status',
        status: 'adapter_configured_and_launched',
        sessionId: session.id,
      });

      vi.runAllTimers(); // Resolve any timeouts

      // Assert: startPromise should resolve successfully
      await expect(startPromise).resolves.toEqual(expect.objectContaining({ success: true }));
      
      const updatedSession = sessionManager.getSession(session.id);
      // When stopOnEntry is false, the session should transition to RUNNING
      // once the adapter is configured and launched.
      expect(updatedSession?.state).toBe(SessionState.RUNNING);
    });

    it('should handle spawn function throwing an error during setupNewRun', async () => {
      const session = await sessionManager.createSession({ language: DebugLanguage.PYTHON, name: 'TestSessionSpawnFail' });
      const scriptPath = 'examples/python/fibonacci.py';
      
      mockSpawnFn.mockImplementation(() => {
        throw new Error('Test spawn error');
      });

      // Act
      const startPromise = sessionManager.startDebugging(session.id, scriptPath, [], {}, false);

      // Assert
      await expect(startPromise).resolves.toEqual(expect.objectContaining({
        success: false,
        error: expect.stringContaining('Test spawn error'),
      }));
      
      const updatedSession = sessionManager.getSession(session.id);
      expect(updatedSession?.state).toBe(SessionState.ERROR);
      expect(updatedSession?.currentRun).toBeNull();
    });

    it('should handle proxy worker emitting an error event during setup', async () => {
      const session = await sessionManager.createSession({ language: DebugLanguage.PYTHON, name: 'TestSessionProxyError' });
      const scriptPath = 'examples/python/fibonacci.py';

      // Act
      const startPromise = sessionManager.startDebugging(session.id, scriptPath, [], {}, false);
      
      // Simulate proxy emitting an error *after* spawn but *before* adapter_configured_and_launched
      const proxyError = new Error('Proxy initialization failed');
      mockChildProcess.simulateError(proxyError);
      
      // vi.runAllTimers(); // With modern timers, advanceAsync might be better if specific timing is needed.
      // For this test, the error should be emitted and handled quickly.
      
      // Assert
      // If rejectDebugStarted is called, startPromise (from startDebugging) should resolve with success:false.
      // The "Unhandled error" suggests the promise rejection from rejectDebugStarted might not be caught by startDebugging's try/catch.
      // Let's ensure the test awaits the promise and checks its resolved value.
      // Using .resolves.toEqual is correct if startDebugging catches the rejection and returns a result object.
      await expect(startPromise).resolves.toEqual(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('Proxy initialization failed'),
        })
      );
      
      const updatedSession = sessionManager.getSession(session.id);
      expect(updatedSession?.state).toBe(SessionState.ERROR);
      expect(updatedSession?.currentRun).toBeNull();
    });

    it('should handle proxy worker exiting unexpectedly during setup', async () => {
      const session = await sessionManager.createSession({ language: DebugLanguage.PYTHON, name: 'TestSessionProxyExit' });
      const scriptPath = 'examples/python/fibonacci.py';

      // Act
      const startPromise = sessionManager.startDebugging(session.id, scriptPath, [], {}, false);
      
      // Simulate proxy exiting *after* spawn but *before* adapter_configured_and_launched
      mockChildProcess.simulateExit(1, null); // Exit with code 1
      
      vi.runAllTimers();

      // Assert
      await expect(startPromise).resolves.toEqual(expect.objectContaining({
        success: false,
        error: expect.stringContaining('Proxy worker exited unexpectedly'),
      }));
      
      const updatedSession = sessionManager.getSession(session.id);
      expect(updatedSession?.state).toBe(SessionState.ERROR);
      expect(updatedSession?.currentRun).toBeNull();
    });
  });

  describe('handleProxyMessage & DAP command forwarding', () => {
    let session;
    let scriptPath;

    beforeEach(async () => {
      // Use the sessionManager instance from the outer scope.
      // Reset and configure mockSpawnFn and mockChildProcess for the startDebugging call in this beforeEach.
      mockChildProcess = new MockChildProcess(); // Ensure a fresh mock child process for this block
      mockSpawnFn.mockReset().mockReturnValue(mockChildProcess as unknown as ChildProcess);
      // The existing sessionManager instance (from outer beforeEach) will use this mockSpawnFn
      // because its spawnFn was passed by reference.

      session = await sessionManager.createSession({ language: DebugLanguage.PYTHON, name: 'TestSessionDAP' });
      scriptPath = 'examples/python/fibonacci.py';
      
      // Act: Call startDebugging and immediately simulate the messages needed for it to resolve.
      // The goal is to have a fully initialized and paused session for each test in this suite.
      const startPromise = sessionManager.startDebugging(session.id, scriptPath, [], { stopOnEntry: true }, false);

      // Assert that mockSpawnFn was called. If not, setupNewRun failed before spawning.
      // This is a critical check for the beforeEach itself.
      expect(mockSpawnFn).toHaveBeenCalledTimes(1);

      // Simulate the sequence of messages from the proxy that leads to debugStartedPromise resolving
      mockChildProcess.simulateMessage({ type: 'status', status: 'adapter_configured_and_launched', sessionId: session.id });
      mockChildProcess.simulateMessage({ type: 'dapEvent', event: 'stopped', body: { reason: 'entry', threadId: 1 }, sessionId: session.id });
      
      // Ensure all timers and microtasks are processed.
      // First, advance timers.
      await vi.runAllTimersAsync();
      // Then, explicitly flush any pending promise microtasks that might have been queued by event handlers.
      await new Promise(process.nextTick); // Or await Promise.resolve();
      
      // Now, await the promise returned by startDebugging. This should resolve if the messages were processed correctly.
      const startResult = await startPromise;
      if (!startResult.success) {
        // If startDebugging failed even with simulated messages, throw to fail the beforeEach and thus the test.
        throw new Error(`startDebugging in beforeEach failed: ${startResult.error}`);
      }

      // Clear mocks for calls made during this setup, so individual tests can assert their own calls.
      mockSpawnFn.mockClear(); 
      mockChildProcess.send.mockClear(); // Clear any send calls made during init.
    });

    it('should forward DAP commands to proxy and handle successful responses', async () => {
      const managedSession = sessionManager.getSession(session.id);
      expect(managedSession?.state).toBe(SessionState.PAUSED); // Should be paused due to stopOnEntry and simulated 'stopped' event.
      expect(managedSession?.currentRun?.currentThreadId).toBe(1);

      const dapCommand = 'next'; // Example: stepOver
      const dapArgs = { threadId: 1 };
      const expectedResponse = { success: true, body: { /* DAP 'next' has no body */ } };

      // Act: Send 'next' command (stepOver is a public method that uses sendRequestToProxy)
      const responsePromise = sessionManager.stepOver(session.id);
      
      // Assert that sendToProxy (called by sendRequestToProxy) was invoked with correct DAP command
      // The actual mockChildProcess.send is called by sendToProxy
      expect(mockChildProcess.send).toHaveBeenCalledTimes(1);
      const sentMessage = JSON.parse(mockChildProcess.send.mock.calls[0][0]);
      expect(sentMessage.cmd).toBe('dap');
      expect(sentMessage.dapCommand).toBe(dapCommand);
      expect(sentMessage.dapArgs).toEqual(dapArgs); // Assuming stepOver sets threadId
      const requestId = sentMessage.requestId;

      // Simulate proxy sending back a DAP response
      mockChildProcess.simulateMessage({
        type: 'dapResponse',
        sessionId: session.id,
        requestId: requestId,
        success: true,
        response: expectedResponse // or just body: expectedResponse.body
      });
      
      // Simulate the 'stopped' event that follows a 'next' command
      mockChildProcess.simulateMessage({
        type: 'dapEvent',
        event: 'stopped',
        body: { reason: 'step', threadId: dapArgs.threadId },
        sessionId: session.id
      });

      vi.runAllTimers(); // Resolve any internal timeouts or promises

      // Assert: The public method's promise should resolve based on the DAP response and subsequent events
      await expect(responsePromise).resolves.toEqual(expect.objectContaining({ success: true }));
    });

    it('should handle DAP command failure responses from proxy', async () => {
      mockChildProcess.simulateMessage({ type: 'status', status: 'adapter_configured_and_launched', sessionId: session.id });
      vi.runAllTimers();

      const dapCommand = 'scopes';
      const dapArgs = { frameId: 1 };
      const errorMessage = 'Invalid frame ID';
      
      // Act: Call a method that sends a DAP request, e.g., getScopes
      const responsePromise = sessionManager.getScopes(session.id, dapArgs.frameId);

      const sentMessage = JSON.parse(mockChildProcess.send.mock.calls[0][0]);
      const requestId = sentMessage.requestId;

      // Simulate proxy sending back a DAP failure response
      mockChildProcess.simulateMessage({
        type: 'dapResponse',
        sessionId: session.id,
        requestId: requestId,
        success: false,
        error: errorMessage
      });
      
      vi.runAllTimers();

      // Assert: The promise from getScopes should be rejected or resolve with error indication
      // Depending on how SessionManager handles errors from sendRequestToProxy,
      // this might throw or return a result indicating failure.
      // For getScopes, it typically returns empty array on error or throws.
      // Let's assume it throws for this test.
      await expect(responsePromise).rejects.toThrow(errorMessage);
    });

    it('should handle DAP event "stopped" and update session state to PAUSED', async () => {
      mockChildProcess.simulateMessage({ type: 'status', status: 'adapter_configured_and_launched', sessionId: session.id });
      vi.runAllTimers(); // Initial setup complete

      // Pre-condition: Session might be RUNNING if stopOnEntry was false, or PAUSED if true.
      // Let's assume it was running (e.g., after a 'continue')
      const managedSession = sessionManager.getSession(session.id);
      // @ts-ignore private access
      sessionManager._updateSessionState(managedSession, SessionState.RUNNING);
      expect(managedSession.state).toBe(SessionState.RUNNING);

      // Act: Simulate DAP 'stopped' event from proxy
      mockChildProcess.simulateMessage({
        type: 'dapEvent',
        event: 'stopped',
        body: { reason: 'breakpoint', threadId: 1 },
        sessionId: session.id
      });
      vi.runAllTimers();

      // Assert
      expect(managedSession.state).toBe(SessionState.PAUSED);
      expect(managedSession.currentRun?.currentThreadId).toBe(1);
    });

    it('should handle DAP event "continued" and update session state to RUNNING', async () => {
      mockChildProcess.simulateMessage({ type: 'status', status: 'adapter_configured_and_launched', sessionId: session.id });
      // Simulate a 'stopped' event first to be in PAUSED state
      mockChildProcess.simulateMessage({ type: 'dapEvent', event: 'stopped', body: { reason: 'entry', threadId: 1 }, sessionId: session.id });
      vi.runAllTimers();
      
      const managedSession = sessionManager.getSession(session.id);
      expect(managedSession.state).toBe(SessionState.PAUSED);

      // Act: Simulate DAP 'continued' event from proxy
      mockChildProcess.simulateMessage({
        type: 'dapEvent',
        event: 'continued',
        body: { threadId: 1, allThreadsContinued: true },
        sessionId: session.id
      });
      vi.runAllTimers();

      // Assert
      expect(managedSession.state).toBe(SessionState.RUNNING);
    });
    
    it('should handle DAP event "terminated" and update session state to STOPPED', async () => {
      mockChildProcess.simulateMessage({ type: 'status', status: 'adapter_configured_and_launched', sessionId: session.id });
      vi.runAllTimers();
      
      const managedSession = sessionManager.getSession(session.id);
      // @ts-ignore private access
      sessionManager._updateSessionState(managedSession, SessionState.RUNNING); // Assume it was running

      // Act: Simulate DAP 'terminated' event
      mockChildProcess.simulateMessage({
        type: 'dapEvent',
        event: 'terminated', // This event means the debugging session is ending
        sessionId: session.id
      });
      vi.runAllTimers();
      
      // Assert
      expect(managedSession.state).toBe(SessionState.STOPPED);
      expect(managedSession.currentRun).toBeNull(); // currentRun should be cleared
      expect(mockChildProcess.kill).toHaveBeenCalled(); // Proxy should be killed
    });
    
    it('should handle proxy error messages and set session to ERROR state', async () => {
      // No need to wait for adapter_configured_and_launched if error happens early
      const managedSession = sessionManager.getSession(session.id);
      
      // Act: Simulate proxy sending an error message
      const errorMessage = "Critical proxy failure";
      mockChildProcess.simulateMessage({
        type: 'error',
        message: errorMessage,
        sessionId: session.id
      });
      vi.runAllTimers();

      // Assert
      expect(managedSession.state).toBe(SessionState.ERROR);
      expect(managedSession.currentRun).toBeNull();
      // Check if startDebugging promise was rejected
      const startPromise = managedSession.currentRun?.debugStartedPromise; // This will be null, need to get it from the startDebugging call
      // Re-trigger startDebugging to get the promise
      const newStartPromise = sessionManager.startDebugging(session.id, scriptPath, [], {}, false);
      mockChildProcess.simulateMessage({ type: 'error', message: errorMessage, sessionId: session.id });
      vi.runAllTimers();
      await expect(newStartPromise).resolves.toEqual(expect.objectContaining({
          success: false, 
          error: expect.stringContaining(errorMessage)
      }));
    });
  });
  
  describe('getSession', () => {
    it('should return the session with the specified ID', async () => {
      // Arrange
      const mockSession = createMockSession();
      
      // Add the mock session to the manager's internal store
      // @ts-ignore: Accessing private field for testing
      sessionManager.sessionStore.set(mockSession.id, mockSession);
      
      // Act
      const retrievedSession = sessionManager.getSession(mockSession.id);
      
      // Assert
      expect(retrievedSession).toBeDefined();
      expect(retrievedSession).toBe(mockSession);
    });
    
    it('should return undefined for non-existent session ID', () => {
      // Act
      const retrievedSession = sessionManager.getSession('non-existent-id');
      
      // Assert
      expect(retrievedSession).toBeUndefined();
    });
  });
  
  describe('getAllSessions', () => {
    it('should return all active sessions', () => {
      // Arrange
      const mockSession1 = createMockSession();
      const mockSession2 = createMockSession();
      
      // Add the mock sessions to the manager's internal store
      // @ts-ignore: Accessing private field for testing
      sessionManager.sessionStore.set(mockSession1.id, mockSession1);
      // @ts-ignore: Accessing private field for testing
      sessionManager.sessionStore.set(mockSession2.id, mockSession2);
      
      // Act
      const sessions = sessionManager.getAllSessions();
      
      // Assert
      expect(sessions).toHaveLength(2);
      expect(sessions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: mockSession1.id, name: mockSession1.name }),
          expect.objectContaining({ id: mockSession2.id, name: mockSession2.name }),
        ])
      );
    });
    
    it('should return empty array when no sessions exist', () => {
      // Act
      const sessions = sessionManager.getAllSessions();
      
      // Assert
      expect(sessions).toHaveLength(0);
    });
  });
  
  describe('updateSessionState', () => {
    it('should update the state of an existing session', () => {
      // Arrange
      const mockSession = createMockSession();
      const initialDate = mockSession.updatedAt;
      
      // Add the mock session to the manager's internal store
      // @ts-ignore: Accessing private field for testing
      sessionManager.sessionStore.set(mockSession.id, mockSession);
      
      // Advance timers before the update
      vi.advanceTimersByTime(100);
      
      // Act
      const sessionToUpdate = sessionManager.getSession(mockSession.id);
      expect(sessionToUpdate).toBeDefined(); // Ensure session exists before updating

      // @ts-ignore: Accessing private method for testing
      sessionManager._updateSessionState(sessionToUpdate!, SessionState.RUNNING); // Pass the ManagedSession object
      
      // Assert
      // _updateSessionState is void, so we check the modified object directly
      expect(sessionToUpdate!.state).toBe(SessionState.RUNNING);
      // Ensure the spy is effective and updatedAt is a new Date object instance
      expect(sessionToUpdate!.updatedAt).not.toBe(initialDate); 
      // Check that the time has changed from the initial time.
      expect(sessionToUpdate!.updatedAt.getTime()).not.toBe(initialDate.getTime());
    });
    
    // This test is removed as _updateSessionState expects a ManagedSession object,
    // not an ID. Testing with a non-existent ID should be part of a public method's test
    // that would first try to retrieve the session.
    // it('should return undefined for non-existent session ID', () => { ... });
  });
  
  describe('closeSession', () => {
    it('should close an existing session and terminate its debugger', async () => {
      // Arrange
      const mockDebuggerProvider = {
        initialize: vi.fn().mockResolvedValue(true),
        terminate: vi.fn().mockResolvedValue(true)
      };
      
      const mockSession = createMockSession();
      
      // Add the mock session to the manager's internal store
      // @ts-ignore: Accessing private field for testing
      sessionManager.sessionStore.set(mockSession.id, mockSession);
      
      // Mock currentRun and proxyWorker for this session
      // Use the class member mockChildProcess for consistency
      mockSession.currentRun = {
        proxyWorker: mockChildProcess as unknown as ChildProcess, // Use the class-level mock
        adapterPort: 1234,
        pendingDapRequests: new Map(),
        debugStartedPromise: Promise.resolve(),
        resolveDebugStarted: vi.fn(),
        rejectDebugStarted: vi.fn(),
        isDryRun: false, // Add missing properties from ActiveDebugRun
        adapterConfiguredAndLaunched: true, // Add missing properties
        effectiveLaunchArgs: {}, // Add missing properties
      };
      
      // Act
      const closePromise = sessionManager.closeSession(mockSession.id);
      // mockChildProcess.kill() will emit 'exit' via process.nextTick.
      // Advance timers to allow process.nextTick and any other setTimeout to run.
      vi.runAllTimers(); 
      const result = await closePromise;
      
      // Assert
      expect(result).toBe(true);
      const updatedSession = sessionManager.getSession(mockSession.id);
      expect(updatedSession).toBeDefined();
      expect(updatedSession!.state).toBe(SessionState.STOPPED);
      expect(updatedSession!.currentRun).toBeNull(); 
      expect(mockChildProcess.send).toHaveBeenCalledWith(JSON.stringify({ cmd: 'terminate' }));
      // kill() is called by the 'exit' handler of the mockProxyWorker if not already killed,
      // or by timeout logic in closeSession. Since mockChildProcess.kill() simulates an exit,
      // we expect it to have been called.
      expect(mockChildProcess.kill).toHaveBeenCalled();
    });
    
    it('should return false for non-existent session ID', async () => {
      // Act
      const result = await sessionManager.closeSession('non-existent-id');
      
      // Assert
      expect(result).toBe(false);
    });
    
    // This test's premise (handling errors when terminating the debugger) changes with the proxy model.
    // SessionManager.closeSession now sends a 'terminate' command and waits for proxy exit.
    // If the proxy fails to terminate gracefully, it's killed.
    // The SessionManager itself doesn't directly "handle errors when terminating the debugger" in the same way.
    // It ensures the session is marked STOPPED.
    it('should mark session as STOPPED even if proxy interaction has issues', async () => {
      // Arrange
      const mockSession = createMockSession();
      // @ts-ignore
      sessionManager.sessionStore.set(mockSession.id, mockSession);
      
      // Simulate error on send by having mockChildProcess.send throw
      mockChildProcess.send.mockImplementation(() => {
        throw new Error('Simulated proxy send failed');
      });
      
      mockSession.currentRun = {
        proxyWorker: mockChildProcess as unknown as ChildProcess,
        adapterPort: 1234,
        pendingDapRequests: new Map(),
        debugStartedPromise: Promise.resolve(),
        resolveDebugStarted: vi.fn(),
        rejectDebugStarted: vi.fn(),
        isDryRun: false,
        adapterConfiguredAndLaunched: true,
        effectiveLaunchArgs: {},
      };
      
      // Act
      const closePromise = sessionManager.closeSession(mockSession.id);
      vi.runAllTimers(); 
      const result = await closePromise;
      
      // Assert
      expect(result).toBe(true); 
      const updatedSession = sessionManager.getSession(mockSession.id);
      expect(updatedSession).toBeDefined();
      expect(updatedSession!.state).toBe(SessionState.STOPPED);
      // kill should still be called by the timeout mechanism in closeSession
      expect(mockChildProcess.kill).toHaveBeenCalled();
    });

    it('should handle timeout when waiting for proxy to exit during closeSession', async () => {
      const mockSession = createMockSession();
      // @ts-ignore
      sessionManager.sessionStore.set(mockSession.id, mockSession);

      // Prevent the mock 'exit' event from firing immediately by overriding kill
      const slowKillMockChildProcess = new MockChildProcess();
      slowKillMockChildProcess.kill = vi.fn(() => {
        // Don't emit 'exit' here to simulate a slow/stuck process
        slowKillMockChildProcess.killed = true;
        return true;
      });
      mockSpawnFn.mockReturnValue(slowKillMockChildProcess as unknown as ChildProcess); // Ensure this session uses the slow kill mock

      // Re-create session with the new mock if necessary, or assign currentRun directly
      // For simplicity, assign currentRun directly for this specific test setup
      mockSession.currentRun = {
        proxyWorker: slowKillMockChildProcess as unknown as ChildProcess,
        adapterPort: 1234,
        pendingDapRequests: new Map(),
        debugStartedPromise: Promise.resolve(),
        resolveDebugStarted: vi.fn(),
        rejectDebugStarted: vi.fn(),
        isDryRun: false,
        adapterConfiguredAndLaunched: true,
        effectiveLaunchArgs: {},
      };
      
      const closePromise = sessionManager.closeSession(mockSession.id);
      
      // Fast-forward timers past the 5000ms timeout in closeSession
      vi.advanceTimersByTime(5001); 
      const result = await closePromise;

      expect(result).toBe(true);
      expect(slowKillMockChildProcess.send).toHaveBeenCalledWith(JSON.stringify({ cmd: 'terminate' }));
      expect(slowKillMockChildProcess.kill).toHaveBeenCalledWith('SIGKILL'); // Should be killed with SIGKILL after timeout
      const updatedSession = sessionManager.getSession(mockSession.id);
      expect(updatedSession!.state).toBe(SessionState.STOPPED);
    });
  });
  
  describe('closeAllSessions', () => {
    it('should close all active sessions', async () => {
      // Arrange
      const session1 = await sessionManager.createSession({ language: DebugLanguage.PYTHON, name: 'SessionToClose1' });
      const session2 = await sessionManager.createSession({ language: DebugLanguage.PYTHON, name: 'SessionToClose2' });

      // Start debugging for both to create currentRun
      // We need separate mock child processes for each session if they are to be managed independently by closeSession.
      // The current beforeEach creates one global mockChildProcess. This test needs a more complex setup
      // or a spy on closeSession that doesn't rely on the global mock's state for both.

      // For simplicity, let's spy on closeSession and trust its individual logic tested above.
      const closeSessionSpy = vi.spyOn(sessionManager, 'closeSession').mockResolvedValue(true);
      
      // To make this test more meaningful without overly complex mock management for multiple child processes:
      // Manually add currentRun to the sessions for the spy to pick up.
      // @ts-ignore (accessing private sessionStore)
      const managedSession1 = sessionManager.sessionStore.get(session1.id);
      // @ts-ignore
      const managedSession2 = sessionManager.sessionStore.get(session2.id);

      if (managedSession1) {
        managedSession1.currentRun = { proxyWorker: new MockChildProcess() as any, adapterPort:1, pendingDapRequests:new Map(), debugStartedPromise:Promise.resolve(), resolveDebugStarted:vi.fn(), rejectDebugStarted:vi.fn(), isDryRun:false, adapterConfiguredAndLaunched:true, effectiveLaunchArgs:{} };
      }
      if (managedSession2) {
        managedSession2.currentRun = { proxyWorker: new MockChildProcess() as any, adapterPort:2, pendingDapRequests:new Map(), debugStartedPromise:Promise.resolve(), resolveDebugStarted:vi.fn(), rejectDebugStarted:vi.fn(), isDryRun:false, adapterConfiguredAndLaunched:true, effectiveLaunchArgs:{} };
      }
      
      // Act
      await sessionManager.closeAllSessions();
            
      // Assert
      expect(closeSessionSpy).toHaveBeenCalledTimes(2);
      expect(closeSessionSpy).toHaveBeenCalledWith(session1.id);
      expect(closeSessionSpy).toHaveBeenCalledWith(session2.id);
      
      // closeSessionSpy is mocked to resolve true, state changes are tested in individual closeSession tests.
      // If we want to check state here, the spy needs to call the original method.
      // For now, this confirms closeAllSessions iterates and calls closeSession for each.
      closeSessionSpy.mockRestore(); // Restore original after this test
    });
    
    it('should handle no active sessions', async () => {
      // Act & Assert
      await expect(sessionManager.closeAllSessions()).resolves.not.toThrow();
    });
  });

  describe('DAP Request Timeout Handling', () => {
    it('should reject DAP request promise on timeout', async () => {
      const session = await sessionManager.createSession({ language: DebugLanguage.PYTHON, name: 'TestSessionTimeout' });
      const scriptPath = 'examples/python/fibonacci.py';
      sessionManager.startDebugging(session.id, scriptPath, [], {}, false);
      
      // Simulate proxy being ready
      mockChildProcess.simulateMessage({ type: 'status', status: 'adapter_configured_and_launched', sessionId: session.id });
      vi.runAllTimers(); // Resolve debugStartedPromise

      // Act: Send a DAP command (e.g., stepOver which calls sendRequestToProxy)
      const dapPromise = sessionManager.stepOver(session.id); // This will send a 'next' command

      // Ensure sendToProxy was called
      expect(mockChildProcess.send).toHaveBeenCalledTimes(1);
      const sentMessage = JSON.parse(mockChildProcess.send.mock.calls[0][0]);
      expect(sentMessage.cmd).toBe('dap');
      
      // Do NOT simulate a response from the proxy.
      // Fast-forward time past the DAP request timeout (default 35s in SessionManager)
      vi.advanceTimersByTime(35001);

      // Assert
      await expect(dapPromise).rejects.toThrow(
        expect.stringContaining(`Timeout waiting for proxy response to next (reqId: ${sentMessage.requestId}) for session ${session.id}`)
      );
      
      // Verify that the pending request was cleared from the map
      const managedSession = sessionManager.getSession(session.id);
      expect(managedSession?.currentRun?.pendingDapRequests.has(sentMessage.requestId)).toBe(false);
    });
  });
});
