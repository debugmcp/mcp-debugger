/**
 * Factory functions for creating properly configured mocks
 *
 * These factories ensure mocks have all required properties and
 * return appropriate values for successful test execution
 */

import { vi } from 'vitest';
import { EventEmitter } from 'events';
import type { ChildProcess } from 'child_process';

/**
 * Create a fully configured mock child process
 */
export function createMockChildProcess(): ChildProcess & EventEmitter {
  const mockProcess = new EventEmitter() as ChildProcess & EventEmitter;

  // Add all required properties
  mockProcess.stdin = new EventEmitter() as any;
  mockProcess.stdout = new EventEmitter() as any;
  mockProcess.stderr = new EventEmitter() as any;
  mockProcess.pid = 12345;
  mockProcess.connected = true;
  mockProcess.exitCode = null;
  mockProcess.signalCode = null;
  mockProcess.spawnargs = [];
  mockProcess.spawnfile = '';
  mockProcess.killed = false;

  // Add required methods
  mockProcess.send = vi.fn().mockReturnValue(true);
  mockProcess.kill = vi.fn().mockReturnValue(true);
  mockProcess.ref = vi.fn().mockReturnThis();
  mockProcess.unref = vi.fn().mockReturnThis();
  mockProcess.disconnect = vi.fn();

  return mockProcess;
}

/**
 * Create a mock proxy process with all required methods
 */
export function createMockProxyProcess() {
  const mockProcess = new EventEmitter();

  return Object.assign(mockProcess, {
    send: vi.fn(),
    sendCommand: vi.fn(),
    kill: vi.fn(),
    pid: 12345,
    stderr: new EventEmitter(),
    stdout: new EventEmitter()
  });
}

/**
 * Create a mock SessionManager with proper return values
 */
export function createMockSessionManager() {
  return {
    createSession: vi.fn().mockResolvedValue({
      sessionId: 'session-123',
      success: true
    }),
    getAllSessions: vi.fn().mockReturnValue([]),
    getSession: vi.fn(),
    getSessionById: vi.fn().mockReturnValue({
      id: 'session-123',
      language: 'python',
      state: { lifecycleState: 'READY' }
    }),
    closeSession: vi.fn().mockResolvedValue({ success: true }),
    closeAllSessions: vi.fn().mockResolvedValue({ success: true }),
    setBreakpoint: vi.fn().mockResolvedValue({
      success: true,
      breakpointId: 'bp-1'
    }),
    startDebugging: vi.fn().mockResolvedValue({
      success: true
    }),
    stepOver: vi.fn().mockResolvedValue({ success: true }),
    stepInto: vi.fn().mockResolvedValue({ success: true }),
    stepOut: vi.fn().mockResolvedValue({ success: true }),
    continue: vi.fn().mockResolvedValue({ success: true }),
    getVariables: vi.fn().mockResolvedValue({
      success: true,
      variables: []
    }),
    getStackTrace: vi.fn().mockResolvedValue({
      success: true,
      frames: []
    }),
    getScopes: vi.fn().mockResolvedValue({
      success: true,
      scopes: []
    }),
    evaluateExpression: vi.fn().mockResolvedValue({
      success: true,
      result: '',
      type: 'string'
    }),
    getAdapterRegistry: vi.fn().mockReturnValue(null),
    adapterRegistry: null
  };
}

/**
 * Create a mock adapter registry with all methods
 */
export function createMockAdapterRegistry() {
  return {
    getSupportedLanguages: vi.fn().mockReturnValue(['python', 'mock']),
    listLanguages: vi.fn().mockResolvedValue(['python', 'mock']),
    listAvailableAdapters: vi.fn().mockResolvedValue(['python', 'mock']),
    isLanguageSupported: vi.fn().mockReturnValue(true),
    create: vi.fn().mockResolvedValue(null),
    register: vi.fn(),
    getAdapter: vi.fn().mockResolvedValue(null),
    hasAdapter: vi.fn().mockReturnValue(false),
    listAdapters: vi.fn().mockReturnValue([])
  };
}

/**
 * Create a mock WhichCommandFinder that always works
 */
export function createMockWhichFinder() {
  return {
    find: vi.fn().mockResolvedValue('/usr/bin/python3')
  };
}

/**
 * Create a properly configured mock logger
 */
export function createMockLogger() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  };
}

/**
 * Create a mock file system
 */
export function createMockFileSystem() {
  return {
    ensureDir: vi.fn().mockResolvedValue(undefined),
    ensureDirSync: vi.fn(),
    pathExists: vi.fn().mockResolvedValue(true),
    writeFile: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue(''),
    stat: vi.fn().mockResolvedValue({
      isFile: () => true,
      isDirectory: () => false,
      size: 0,
      mtime: new Date()
    })
  };
}

/**
 * Create a mock network manager
 */
export function createMockNetworkManager() {
  return {
    findFreePort: vi.fn().mockResolvedValue(12345)
  };
}

/**
 * Create mock environment
 */
export function createMockEnvironment() {
  return {
    isContainer: false,
    containerWorkspaceRoot: undefined
  };
}

/**
 * Helper to create a mock that simulates Python validation success
 */
export function createPythonValidationProcess() {
  const mockProcess = createMockChildProcess();

  // Simulate successful Python validation immediately on next tick
  process.nextTick(() => {
    mockProcess.emit('exit', 0);
  });

  return mockProcess;
}

/**
 * Helper to create a mock that simulates Python validation failure
 */
export function createFailedPythonValidationProcess() {
  const mockProcess = createMockChildProcess();

  // Simulate failed Python validation immediately on next tick
  process.nextTick(() => {
    mockProcess.emit('exit', 1);
  });

  return mockProcess;
}