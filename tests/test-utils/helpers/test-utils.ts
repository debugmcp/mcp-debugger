/**
 * Test utilities for Debug MCP Server tests
 */
import { EventEmitter } from 'events';
import { DebugLanguage, SessionState, DebugSession } from '@debugmcp/shared';
import { v4 as uuidv4 } from 'uuid';

/**
 * Create a mock debug session for testing
 * 
 * @param overrides - Properties to override in the default session
 * @returns A mock debug session
 */
export function createMockSession(overrides: Partial<DebugSession> = {}): DebugSession {
  const now = new Date();
  
  return {
    id: uuidv4(),
    language: 'python' as DebugLanguage,
    name: 'Test Session',
    state: SessionState.CREATED,
    createdAt: now,
    updatedAt: now,
    breakpoints: new Map(),
    ...overrides
  };
}

/**
 * Wait for a condition to be true
 * 
 * @param condition - Condition function to check
 * @param timeoutMs - Timeout in milliseconds
 * @param intervalMs - Check interval in milliseconds
 * @returns Promise that resolves when condition is true
 */
export async function waitForCondition(
  condition: () => boolean | Promise<boolean>,
  timeoutMs = 5000,
  intervalMs = 100
): Promise<void> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    if (await condition()) {
      return;
    }
    
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  
  throw new Error(`Timeout waiting for condition (${timeoutMs}ms)`);
}

/**
 * Wait for an event to be emitted
 * 
 * @param emitter - Event emitter to listen on
 * @param event - Event name to wait for
 * @param timeout - Timeout in milliseconds
 * @returns Promise that resolves with event arguments
 */
export function waitForEvent<T extends any[]>(
  emitter: EventEmitter,
  event: string,
  timeout = 5000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      emitter.removeListener(event, handler);
      reject(new Error(`Timeout waiting for event: ${event}`));
    }, timeout);
    
    const handler = (...args: any[]) => {
      clearTimeout(timer);
      resolve(args as T);
    };
    
    emitter.once(event, handler);
  });
}

/**
 * Wait for multiple events in sequence
 * 
 * @param emitter - Event emitter to listen on
 * @param events - Array of event names to wait for in sequence
 * @param timeout - Timeout for each event
 * @returns Promise that resolves when all events have been emitted
 */
export async function waitForEvents(
  emitter: EventEmitter,
  events: string[],
  timeout = 5000
): Promise<void> {
  for (const event of events) {
    await waitForEvent(emitter, event, timeout);
  }
}

/**
 * Create a mock event emitter for testing
 */
export function createMockEventEmitter() {
  const listeners: Record<string, Array<(...args: any[]) => void>> = {};
  
  return {
    on: vi.fn((event: string, callback: (...args: any[]) => void) => {
      if (!listeners[event]) {
        listeners[event] = [];
      }
      
      listeners[event].push(callback);
    }),
    
    once: vi.fn((event: string, callback: (...args: any[]) => void) => {
      const wrappedCallback = (...args: any[]) => {
        callback(...args);
        // Remove the listener after first call
        const index = listeners[event]?.indexOf(wrappedCallback);
        if (index !== undefined && index !== -1) {
          listeners[event].splice(index, 1);
        }
      };
      
      if (!listeners[event]) {
        listeners[event] = [];
      }
      
      listeners[event].push(wrappedCallback);
    }),
    
    emit: vi.fn((event: string, ...args: any[]) => {
      const eventListeners = listeners[event] || [];
      
      eventListeners.forEach(listener => {
        listener(...args);
      });
    }),
    
    removeListener: vi.fn((event: string, callback: (...args: any[]) => void) => {
      if (!listeners[event]) {
        return;
      }
      
      const index = listeners[event].indexOf(callback);
      
      if (index !== -1) {
        listeners[event].splice(index, 1);
      }
    }),
    
    removeAllListeners: vi.fn((event?: string) => {
      if (event) {
        delete listeners[event];
      } else {
        Object.keys(listeners).forEach(key => delete listeners[key]);
      }
    })
  };
}

/**
 * Mock a function that returns a promise
 * 
 * @param returnValue - Value to return from the mock
 * @returns A vitest mock function
 */
export function mockAsyncFunction<T>(returnValue: T) {
  return vi.fn().mockResolvedValue(returnValue);
}

/**
 * Create a temporary test file with the given content
 * 
 * @param filename - File name (without path)
 * @param content - File content
 * @returns Path to the created file
 */
export function createTempTestFile(filename: string, content: string): string {
  const fs = require('fs');
  const path = require('path');
  const os = require('os');
  
  const tempDir = path.join(os.tmpdir(), 'debug-mcp-tests');
  
  // Create temp directory if it doesn't exist
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  const filePath = path.join(tempDir, filename);
  
  // Write the content to the file
  fs.writeFileSync(filePath, content);
  
  return filePath;
}

/**
 * Clean up temporary test files
 */
export function cleanupTempTestFiles(): void {
  const fs = require('fs');
  const path = require('path');
  const os = require('os');
  
  const tempDir = path.join(os.tmpdir(), 'debug-mcp-tests');
  
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

/**
 * Create a delay promise
 * 
 * @param ms - Milliseconds to delay
 * @returns Promise that resolves after the delay
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Run a function with a timeout
 * 
 * @param fn - Function to run
 * @param timeout - Timeout in milliseconds
 * @returns Promise that rejects if timeout is reached
 */
export function withTimeout<T>(fn: () => Promise<T>, timeout: number): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error(`Operation timed out after ${timeout}ms`)), timeout)
    )
  ]);
}

// ===== NEW HELPERS FOR FAKE PROCESS IMPLEMENTATIONS =====

import { FakeProxyProcessLauncher, FakeProcess } from '../../implementations/test/fake-process-launcher.js';
import { ProxyManager } from '../../../src/proxy/proxy-manager.js';
import { IFileSystem, ILogger } from '../../../src/interfaces/external-dependencies.js';
import { vi } from 'vitest';

/**
 * Create a fake proxy process with common proxy behavior
 * @returns A configured fake process
 */
export function createFakeProxyProcess(): FakeProcess {
  const process = new FakeProcess();
  
  // Set up common proxy behavior
  process.on('message', (msg: any) => {
    if (typeof msg === 'string') {
      try {
        const parsed = JSON.parse(msg);
        if (parsed.cmd === 'terminate') {
          process.simulateExit(0);
        }
      } catch {
        // Not JSON, ignore
      }
    }
  });
  
  return process;
}

/**
 * Set up a ProxyManager test with all fakes configured
 * @returns Test setup with proxy manager and all dependencies
 */
export function setupProxyManagerTest() {
  const fakeLauncher = new FakeProxyProcessLauncher();
  const mockLogger: ILogger = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  };
  const mockFileSystem: IFileSystem = {
    pathExists: vi.fn().mockResolvedValue(true),
    ensureDir: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    remove: vi.fn(),
    copy: vi.fn(),
    outputFile: vi.fn(),
    exists: vi.fn(),
    mkdir: vi.fn(),
    readdir: vi.fn(),
    stat: vi.fn(),
    unlink: vi.fn(),
    rmdir: vi.fn(),
    ensureDirSync: vi.fn()
  } as any;
  
  const proxyManager = new ProxyManager(
    fakeLauncher,
    mockFileSystem,
    mockLogger
  );
  
  return {
    proxyManager,
    fakeLauncher,
    mockLogger,
    mockFileSystem
  };
}

/**
 * Create a mock logger for testing
 * @returns Mock logger with vitest mocks
 */
export function createMockLogger(): ILogger {
  return {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  };
}

/**
 * Create a mock file system for testing
 * @returns Mock file system with vitest mocks
 */
export function createMockFileSystem(): IFileSystem {
  return {
    pathExists: vi.fn().mockResolvedValue(true),
    ensureDir: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue(''),
    writeFile: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    copy: vi.fn().mockResolvedValue(undefined),
    outputFile: vi.fn().mockResolvedValue(undefined),
    exists: vi.fn().mockResolvedValue(true),
    mkdir: vi.fn().mockResolvedValue(undefined),
    readdir: vi.fn().mockResolvedValue([]),
    stat: vi.fn().mockResolvedValue({ isDirectory: () => false, isFile: () => true }),
    unlink: vi.fn().mockResolvedValue(undefined),
    rmdir: vi.fn().mockResolvedValue(undefined),
    ensureDirSync: vi.fn(),
    createWriteStream: vi.fn(),
    createReadStream: vi.fn()
  } as any;
}
