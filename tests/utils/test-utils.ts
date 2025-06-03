/**
 * Test utilities for Debug MCP Server tests
 */
import { DebugLanguage, SessionState, DebugSession } from '../../src/session/models.js';
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
 * Create a mock event emitter for testing
 */
export function createMockEventEmitter() {
  const listeners: Record<string, Array<(...args: any[]) => void>> = {};
  
  return {
    on: jest.fn((event: string, callback: (...args: any[]) => void) => {
      if (!listeners[event]) {
        listeners[event] = [];
      }
      
      listeners[event].push(callback);
    }),
    
    emit: jest.fn((event: string, ...args: any[]) => {
      const eventListeners = listeners[event] || [];
      
      eventListeners.forEach(listener => {
        listener(...args);
      });
    }),
    
    removeListener: jest.fn((event: string, callback: (...args: any[]) => void) => {
      if (!listeners[event]) {
        return;
      }
      
      const index = listeners[event].indexOf(callback);
      
      if (index !== -1) {
        listeners[event].splice(index, 1);
      }
    })
  };
}

/**
 * Mock a function that returns a promise
 * 
 * @param returnValue - Value to return from the mock
 * @returns A jest mock function
 */
export function mockAsyncFunction<T>(returnValue: T) {
  return jest.fn().mockResolvedValue(returnValue);
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
