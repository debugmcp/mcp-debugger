/**
 * Factory functions for creating properly configured mocks
 *
 * These factories ensure mocks have all required properties and
 * return appropriate values for successful test execution
 *
 * CAVEAT: every factory below is unannotated, so nothing checks it against the
 * interface it claims to double, and several have drifted -- `createMockFileSystem`
 * returns 7 of `IFileSystem`'s 16 members, `createMockEnvironment` shares no member
 * at all with `IEnvironment`, `createMockProxyProcess` lacks `sessionId` and
 * `waitForInitialization`. Prefer the annotated factories in
 * `tests/test-utils/helpers/adapter-dependencies.ts` and
 * `tests/test-utils/helpers/test-dependencies.ts` for new tests.
 */

import { vi } from 'vitest';
import { EventEmitter } from 'events';
import type { ChildProcess } from 'child_process';

/**
 * Create a fully configured mock child process
 */
export function createMockChildProcess(): ChildProcess & EventEmitter {
  // `pid`, `connected`, `exitCode`, `signalCode`, `spawnargs`, `spawnfile` and
  // `killed` are readonly on ChildProcess, so the double has to be built in one
  // step and asserted afterwards rather than assigned field by field.
  const mockProcess = Object.assign(new EventEmitter(), {
    // Streams
    stdin: new EventEmitter(),
    stdout: new EventEmitter(),
    stderr: new EventEmitter(),
    // Readonly state
    pid: 12345,
    connected: true,
    exitCode: null,
    signalCode: null,
    spawnargs: [],
    spawnfile: '',
    killed: false,
    // Methods
    send: vi.fn().mockReturnValue(true),
    kill: vi.fn().mockReturnValue(true),
    ref: vi.fn().mockReturnThis(),
    unref: vi.fn().mockReturnThis(),
    disconnect: vi.fn()
  });

  return mockProcess as unknown as ChildProcess & EventEmitter;
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
    readTail: vi.fn().mockResolvedValue(''),
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
