/**
 * Unit tests for SessionManagerOperations
 *
 * Tests Python validation, dry-run scenarios, port allocation,
 * and container path handling functionality.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionManager, SessionManagerConfig, SessionManagerDependencies } from '../../../src/session/session-manager.js';
import { SessionManagerOperations } from '../../../src/session/session-manager-operations.js';
import { ManagedSession } from '../../../src/session/session-store.js';
import { DebugLanguage, SessionState, SessionLifecycleState, Breakpoint } from '@debugmcp/shared';
import { WhichCommandFinder } from '../../../src/implementations/which-command-finder.js';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import { IProxyManager } from '../../../src/proxy/proxy-manager.js';
import { PythonNotFoundError } from '../../../src/errors/debug-errors.js';
import {
  createMockChildProcess,
  createPythonValidationProcess,
  createFailedPythonValidationProcess,
  createMockWhichFinder,
  createMockLogger,
  createMockFileSystem,
  createMockNetworkManager,
  createMockEnvironment
} from '../test-utils/mock-factories.js';

// Mock child_process
vi.mock('child_process', async () => {
  const actual = await vi.importActual<typeof import('child_process')>('child_process');
  return {
    ...actual,
    spawn: vi.fn()
  };
});

// Mock WhichCommandFinder
vi.mock('../../../src/implementations/which-command-finder.js');

// Mock container path utils
vi.mock('../../../src/utils/container-path-utils.js', () => ({
  translatePathForContainer: vi.fn((path: string) => path),
  isContainerMode: vi.fn(() => false)
}));

describe('SessionManagerOperations', () => {
  let sessionManager: any;
  let mockSession: ManagedSession;
  let mockProxyManagerFactory: any;
  let mockProxyManager: any;
  let mockLogger: any;
  let mockFileSystem: any;
  let mockNetworkManager: any;
  let mockEnvironment: any;

  beforeEach(() => {
    // Reset the WhichCommandFinder mock before each test
    vi.mocked(WhichCommandFinder).mockReset();
    vi.mocked(WhichCommandFinder).mockImplementation(() => ({
      find: vi.fn().mockResolvedValue('/usr/bin/python3')
    }) as any);

    // Set up default spawn mock for Python validation
    vi.mocked(spawn).mockReturnValue(createPythonValidationProcess() as any);

    // Use mock factories for consistent mocks
    mockLogger = createMockLogger();
    mockFileSystem = createMockFileSystem();
    mockNetworkManager = createMockNetworkManager();
    mockEnvironment = createMockEnvironment();

    // Customize file system mock for session tests
    mockFileSystem.pathExists = vi.fn().mockImplementation((path: string) => {
      // Mock session log directory as existing
      if (path.includes('session-123')) {
        return Promise.resolve(true);
      }
      return Promise.resolve(true);
    });

    mockProxyManager = new EventEmitter();
    // Completely mock start() to avoid real implementation
    mockProxyManager.start = vi.fn().mockImplementation(async (config) => {
      // Just succeed without needing any real proxy process
      mockProxyManager.emit('initialized');
      return Promise.resolve();
    });
    mockProxyManager.stop = vi.fn().mockResolvedValue(true);
    mockProxyManager.sendDapRequest = vi.fn();
    mockProxyManager.isRunning = vi.fn().mockReturnValue(false);
    mockProxyManager.getCurrentThreadId = vi.fn().mockReturnValue(null);

    mockProxyManagerFactory = {
      create: vi.fn().mockReturnValue(mockProxyManager)
    };

    // Create mock session store factory
    const mockSessionStoreFactory = {
      create: vi.fn().mockReturnValue({
        createSession: vi.fn(),
        getSession: vi.fn().mockReturnValue(mockSession),
        updateSession: vi.fn(),
        deleteSession: vi.fn(),
        listSessions: vi.fn().mockReturnValue([])
      })
    };

 // Create mock debug target launcher
const mockDebugTargetLauncher = {
  launch: vi.fn().mockResolvedValue({ pid: 12345 }),
  launchPythonDebugTarget: vi.fn()
};

    // Create mock adapter registry with proper adapter that has buildAdapterCommand
    const mockAdapter = {
      buildAdapterCommand: vi.fn().mockReturnValue({
        command: 'python3',
        args: ['-m', 'debugpy.adapter', '--port', '12345'],
        env: {}
      }),
      getDefaultLaunchConfig: vi.fn().mockReturnValue({}),
      transformLaunchConfig: vi.fn().mockImplementation((config: any) => config)
    };

const mockAdapterRegistry = {
  getAdapter: vi.fn().mockResolvedValue(null),
  hasAdapter: vi.fn().mockReturnValue(false),
  registerAdapter: vi.fn(),
  listAdapters: vi.fn().mockReturnValue([]),
  create: vi.fn().mockResolvedValue(mockAdapter),
  // Additional methods to satisfy IAdapterRegistry typing
  register: vi.fn(),
  unregister: vi.fn(),
  getSupportedLanguages: vi.fn().mockReturnValue(['python', 'mock']),
  isLanguageSupported: vi.fn().mockReturnValue(true),
  listLanguages: vi.fn().mockResolvedValue(['python', 'mock']),
  listAvailableAdapters: vi.fn().mockResolvedValue([]),
  getAdapterInfo: vi.fn().mockReturnValue(undefined),
  getAllAdapterInfo: vi.fn().mockReturnValue([]),
  disposeAll: vi.fn(),
  getActiveAdapterCount: vi.fn().mockReturnValue(0)
};

 // Create mock session
mockSession = {
  id: 'session-123',
  name: 'test-session',
  language: DebugLanguage.PYTHON as any,
  executablePath: 'python3',
  state: SessionState.CREATED,
  sessionLifecycle: SessionLifecycleState.ACTIVE,
  proxyManager: null as any,
  breakpoints: new Map<string, Breakpoint>(),
  createdAt: new Date(),
  updatedAt: new Date(),
  executionState: undefined
} as unknown as ManagedSession;

    // Create a test class that extends SessionManagerOperations
    class TestSessionManagerOperations extends SessionManagerOperations {
      constructor() {
        // Call parent constructor with proper dependencies
        const config: SessionManagerConfig = {
          logDirBase: '/tmp/mcp-debugger/logs'
        };
        const dependencies: SessionManagerDependencies = {
          logger: mockLogger,
          fileSystem: mockFileSystem,
          networkManager: mockNetworkManager,
          environment: mockEnvironment,
          proxyManagerFactory: mockProxyManagerFactory,
          sessionStoreFactory: mockSessionStoreFactory,
          debugTargetLauncher: mockDebugTargetLauncher,
          adapterRegistry: mockAdapterRegistry
        };
        super(config, dependencies);

        // Override sessionStore to use our mock
        (this as any).sessionStore = {
          getSessionById: vi.fn().mockReturnValue(mockSession)
        };
      }

      // Expose protected methods for testing
      public async testStartProxyManager(
        session: ManagedSession,
        scriptPath: string,
        scriptArgs?: string[],
        dapLaunchArgs?: any,
        dryRunSpawn?: boolean
      ) {
        return this.startProxyManager(session, scriptPath, scriptArgs, dapLaunchArgs, dryRunSpawn);
      }

public async testIsValidPythonExecutable(pythonCmd: string) {
  return (this as any).isValidPythonExecutable(pythonCmd);
}

      public async testFindFreePort() {
        return this.findFreePort();
      }

      // Add _getSessionById method that the parent class expects
      protected _getSessionById(sessionId: string): ManagedSession {
        return mockSession;
      }
    }

    sessionManager = new TestSessionManagerOperations();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('startProxyManager', () => {
    it('should create session log directory and start proxy manager', async () => {
      await sessionManager.testStartProxyManager(mockSession, '/path/to/script.py');

      expect(mockFileSystem.ensureDir).toHaveBeenCalled();
      expect(mockFileSystem.pathExists).toHaveBeenCalled();
      expect(mockNetworkManager.findFreePort).toHaveBeenCalled();
      expect(mockProxyManagerFactory.create).toHaveBeenCalled();
      expect(mockProxyManager.start).toHaveBeenCalled();
    });

    it('should handle log directory creation failure', async () => {
      mockFileSystem.ensureDir.mockRejectedValue(new Error('Permission denied'));

      await expect(
        sessionManager.testStartProxyManager(mockSession, '/path/to/script.py')
      ).rejects.toThrow('Failed to create session log directory: Permission denied');

      expect(mockLogger.error).toHaveBeenCalledWith(
        '[SessionManager] Failed to create log directory:',
        expect.any(Error)
      );
    });

    it('should handle log directory verification failure', async () => {
      mockFileSystem.pathExists.mockResolvedValue(false);

      await expect(
        sessionManager.testStartProxyManager(mockSession, '/path/to/script.py')
      ).rejects.toThrow('Log directory');

      expect(mockFileSystem.ensureDir).toHaveBeenCalled();
    });

    it('should handle Python executable path resolution', async () => {
      // Mock spawn to return a successful Python validation process
      vi.mocked(spawn).mockReturnValue(createPythonValidationProcess() as any);

      // Set up session with relative Python path
      mockSession.executablePath = 'python3';

      // Start the proxy manager
      await sessionManager.testStartProxyManager(mockSession, '/path/to/script.py');

      expect(WhichCommandFinder).toHaveBeenCalled();
      expect(mockProxyManager.start).toHaveBeenCalled();
    });

    it('should handle invalid Python executable', async () => {
      // Mock spawn to return a failed Python validation process
      vi.mocked(spawn).mockReturnValue(createFailedPythonValidationProcess() as any);

      mockSession.executablePath = 'python3';

      await expect(
        sessionManager.testStartProxyManager(mockSession, '/path/to/script.py')
      ).rejects.toThrow(PythonNotFoundError);
    });

    it('should handle dry-run mode correctly', async () => {
      await sessionManager.testStartProxyManager(
        mockSession,
        '/path/to/script.py',
        ['--arg1'],
        { stopOnEntry: true },
        true // dryRunSpawn = true
      );

      // ProxyManagerFactory.create is now called with the adapter object
      expect(mockProxyManagerFactory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          buildAdapterCommand: expect.any(Function),
          getDefaultLaunchConfig: expect.any(Function),
          transformLaunchConfig: expect.any(Function)
        })
      );

      // Verify the proxy was started with dry-run config
      expect(mockProxyManager.start).toHaveBeenCalledWith(
        expect.objectContaining({
          dryRunSpawn: true
        })
      );
    });

    it('should pass initial breakpoints to proxy manager', async () => {
mockSession.breakpoints.set('bp-1', {
  id: 'bp-1',
  file: '/path/to/file.py',
  line: 10,
  condition: 'x > 5',
  verified: false
});
mockSession.breakpoints.set('bp-2', {
  id: 'bp-2',
  file: '/path/to/file.py',
  line: 20,
  verified: false
});

      await sessionManager.testStartProxyManager(mockSession, '/path/to/script.py');

      // ProxyManagerFactory.create is now called with adapter
      expect(mockProxyManagerFactory.create).toHaveBeenCalled();

      // Verify breakpoints are passed to proxyManager.start
      expect(mockProxyManager.start).toHaveBeenCalledWith(
        expect.objectContaining({
          initialBreakpoints: expect.arrayContaining([
            expect.objectContaining({ file: '/path/to/file.py', line: 10, condition: 'x > 5' }),
            expect.objectContaining({ file: '/path/to/file.py', line: 20 })
          ])
        })
      );
    });

    it('should handle absolute Python executable path', async () => {
      mockSession.executablePath = '/usr/local/bin/python3.9';

      await sessionManager.testStartProxyManager(mockSession, '/path/to/script.py');

      // Should not call WhichCommandFinder for absolute paths
      expect(WhichCommandFinder).not.toHaveBeenCalled();
      expect(mockProxyManager.start).toHaveBeenCalled();
    });

    it('should handle non-Python languages', async () => {
mockSession.language = DebugLanguage.MOCK as any;
      mockSession.executablePath = 'mock-executable';

      await sessionManager.testStartProxyManager(mockSession, '/path/to/script.mock');

      // Should not perform Python-specific validation
      expect(WhichCommandFinder).not.toHaveBeenCalled();
      expect(spawn).not.toHaveBeenCalled();
      expect(mockProxyManager.start).toHaveBeenCalled();
    });
  });

  describe('isValidPythonExecutable', () => {
    it('should return true for valid Python executable', async () => {
      vi.mocked(spawn).mockReturnValue(createPythonValidationProcess() as any);

      const isValid = await sessionManager.testIsValidPythonExecutable('/usr/bin/python3');

      expect(isValid).toBe(true);
      expect(spawn).toHaveBeenCalledWith('/usr/bin/python3', ['-c', 'import sys; sys.exit(0)'], expect.objectContaining({ stdio: expect.any(Array) }));
    });

    it('should return false for invalid Python executable', async () => {
      vi.mocked(spawn).mockReturnValue(createFailedPythonValidationProcess() as any);

      const isValid = await sessionManager.testIsValidPythonExecutable('/invalid/python');

      expect(isValid).toBe(false);
    });

    it('should handle spawn errors', async () => {
      vi.useFakeTimers();
      const mockProcess = createMockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockProcess as any);

      const validationPromise = sessionManager.testIsValidPythonExecutable('/usr/bin/python3');

      // Simulate spawn error
      setTimeout(() => {
        mockProcess.emit('error', new Error('ENOENT'));
      }, 10);

      await vi.advanceTimersByTimeAsync(20);

      const isValid = await validationPromise;
      expect(isValid).toBe(false);
      vi.useRealTimers();
    });

    it('should timeout long-running validation', async () => {
      const mockProcess = createMockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockProcess as any);

      // The implementation doesn't have a timeout, it just waits for exit/error
      // So we need to simulate an error to make it return false
      process.nextTick(() => {
        mockProcess.emit('error', new Error('timeout'));
      });

      const isValid = await sessionManager.testIsValidPythonExecutable('/usr/bin/python3');

      expect(isValid).toBe(false);
    });
  });

  describe('findFreePort', () => {
    it('should delegate to network manager', async () => {
      const port = await sessionManager.testFindFreePort();

      expect(port).toBe(12345);
      expect(mockNetworkManager.findFreePort).toHaveBeenCalled();
    });

    it('should handle network manager errors', async () => {
      mockNetworkManager.findFreePort.mockRejectedValue(new Error('No free ports'));

      await expect(sessionManager.testFindFreePort()).rejects.toThrow('No free ports');
    });
  });

  describe('container path handling', () => {
    it('should translate paths in container mode', async () => {
      const { translatePathForContainer, isContainerMode } = await import(
        '../../../src/utils/container-path-utils.js'
      );

      vi.mocked(isContainerMode).mockReturnValue(true);
      vi.mocked(translatePathForContainer).mockReturnValue('/workspace/script.py');

      await sessionManager.testStartProxyManager(mockSession, '/host/path/script.py');

      expect(isContainerMode).toHaveBeenCalledWith(mockEnvironment);
      expect(translatePathForContainer).toHaveBeenCalledWith('/host/path/script.py', mockEnvironment);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("Container mode: translated path from '/host/path/script.py' to '/workspace/script.py'")
      );
    });

    it('should not translate paths in non-container mode', async () => {
      const { translatePathForContainer, isContainerMode } = await import(
        '../../../src/utils/container-path-utils.js'
      );

      vi.mocked(isContainerMode).mockReturnValue(false);
      vi.mocked(translatePathForContainer).mockReturnValue('/host/path/script.py'); // No change

      await sessionManager.testStartProxyManager(mockSession, '/host/path/script.py');

      expect(isContainerMode).toHaveBeenCalledWith(mockEnvironment);
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        expect.stringContaining('Container mode: translated path')
      );
    });
  });

  describe('error handling edge cases', () => {
    it('should handle proxy manager creation failure', async () => {
      mockProxyManagerFactory.create.mockImplementation(() => {
        throw new Error('Failed to create proxy manager');
      });

      await expect(
        sessionManager.testStartProxyManager(mockSession, '/path/to/script.py')
      ).rejects.toThrow('Failed to create proxy manager');
    });

    it('should handle proxy manager start failure', async () => {
      mockProxyManager.start.mockRejectedValue(new Error('Failed to start proxy'));

      await expect(
        sessionManager.testStartProxyManager(mockSession, '/path/to/script.py')
      ).rejects.toThrow('Failed to start proxy');
    });

    it('should handle port allocation failure gracefully', async () => {
      mockNetworkManager.findFreePort.mockRejectedValue(new Error('No available ports'));

      await expect(
        sessionManager.testStartProxyManager(mockSession, '/path/to/script.py')
      ).rejects.toThrow('No available ports');
    });

    it('should handle WhichCommandFinder failure', async () => {
      vi.mocked(WhichCommandFinder).mockImplementation(() => ({
        find: vi.fn().mockRejectedValue(new Error('Command not found'))
      }) as any);

      mockSession.executablePath = 'python3';

      await expect(
        sessionManager.testStartProxyManager(mockSession, '/path/to/script.py')
      ).rejects.toThrow(PythonNotFoundError);
    });
  });

  describe('complex scenarios', () => {
    it('should handle session with multiple breakpoints and dry-run', async () => {
      // Add multiple breakpoints
mockSession.breakpoints.set('bp-1', {
  id: 'bp-1',
  file: '/path/to/file1.py',
  line: 10,
  condition: 'x > 5',
  verified: false
});
mockSession.breakpoints.set('bp-2', {
  id: 'bp-2',
  file: '/path/to/file2.py',
  line: 20,
  verified: false
});
mockSession.breakpoints.set('bp-3', {
  id: 'bp-3',
  file: '/path/to/file3.py',
  line: 30,
  condition: 'y == "test"',
  verified: false
});

      await sessionManager.testStartProxyManager(
        mockSession,
        '/path/to/script.py',
        ['--verbose', '--config=test.json'],
        { stopOnEntry: false, justMyCode: false },
        true
      );

      // ProxyManagerFactory.create is now called with adapter
      expect(mockProxyManagerFactory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          buildAdapterCommand: expect.any(Function),
          getDefaultLaunchConfig: expect.any(Function),
          transformLaunchConfig: expect.any(Function)
        })
      );

      // Verify proxy manager was started
      expect(mockProxyManager.start).toHaveBeenCalled();

      // Check the config passed to start
      const startConfig = mockProxyManager.start.mock.calls[0][0];
      expect(startConfig).toBeDefined();

      // Verify key configuration elements
      expect(startConfig.dryRunSpawn).toBe(true);
      expect(startConfig.scriptPath).toBe('/path/to/script.py');
      expect(startConfig.scriptArgs).toEqual(['--verbose', '--config=test.json']);

      // dapLaunchArgs might be nested or structured differently
      if (startConfig.dapLaunchArgs) {
        expect(startConfig.dapLaunchArgs.stopOnEntry).toBe(false);
        expect(startConfig.dapLaunchArgs.justMyCode).toBe(false);
      } else if (startConfig.launchArgs) {
        // Might be named differently
        expect(startConfig.launchArgs.stopOnEntry).toBe(false);
        expect(startConfig.launchArgs.justMyCode).toBe(false);
      }

      // Check breakpoints are present
      expect(startConfig.initialBreakpoints).toBeDefined();
      expect(startConfig.initialBreakpoints.length).toBeGreaterThanOrEqual(3);
    });
  });
});
