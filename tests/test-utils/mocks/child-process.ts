// @ts-nocheck
/**
 * Mocks for the child_process module
 * 
 * This provides consistent mock implementations for child_process functions
 * used throughout the tests.
 */
import { vi } from 'vitest';
import { EventEmitter } from 'events';

/**
 * Mock for a spawned process with IPC support
 */
export class MockChildProcess extends EventEmitter {
  // Stream mocks - these need to be proper stream-like objects
  public stdin: NodeJS.WritableStream | null = null;
  public stdout: NodeJS.ReadableStream | null = new EventEmitter() as any;
  public stderr: NodeJS.ReadableStream | null = new EventEmitter() as any;
  
  // Process methods
  public kill = vi.fn().mockImplementation(() => true);
  public send = vi.fn().mockImplementation((message: any) => {
    // By default, send returns true to indicate success
    return true;
  });
  
  // Process properties
  public pid: number;
  public killed: boolean = false;
  
  constructor(pid = Math.floor(Math.random() * 10000)) {
    super();
    this.pid = pid;
    
    // Update killed status when kill is called
    this.kill.mockImplementation((signal?: string) => {
      this.killed = true;
      return true;
    });
  }
  
  /**
   * Helper to simulate process exit
   */
  simulateExit(code: number = 0, signal?: string): void {
    this.emit('exit', code, signal);
    this.emit('close', code, signal);
  }
  
  /**
   * Helper to simulate process error
   */
  simulateError(error: Error): void {
    this.emit('error', error);
  }
  
  /**
   * Helper to simulate stdout data
   */
  simulateStdout(data: string): void {
    this.stdout.emit('data', Buffer.from(data));
  }
  
  /**
   * Helper to simulate stderr data
   */
  simulateStderr(data: string): void {
    this.stderr.emit('data', Buffer.from(data));
  }
  
  /**
   * Helper to simulate IPC message from child process
   */
  simulateMessage(message: any): void {
    this.emit('message', message);
  }
  
  /**
   * Reset all mock event listeners
   */
  reset(): void {
    this.removeAllListeners();
    this.stdout.removeAllListeners();
    this.stderr.removeAllListeners();
    this.kill.mockClear();
    this.send.mockClear();
    this.killed = false;
  }
}

class ChildProcessMock {
  // Mock function implementations
  public spawn = vi.fn();
  public exec = vi.fn();
  public execSync = vi.fn();
  public fork = vi.fn();
  
  // Track created mock processes
  private mockProcesses: MockChildProcess[] = [];
  
  constructor() {
    this.setupMocks();
  }
  
  /**
   * Reset all mocks and clear mock process state
   */
  reset(): void {
    // Reset all mock functions
    this.spawn.mockReset();
    this.exec.mockReset();
    this.execSync.mockReset();
    this.fork.mockReset();
    
    // Reset all mock processes
    this.mockProcesses.forEach(process => process.reset());
    this.mockProcesses = [];
    
    // Re-setup mocks with default implementations
    this.setupMocks();
  }
  
  /**
   * Setup default implementations for all mock functions
   */
  private setupMocks(): void {
    // Default implementation for spawn
    this.spawn.mockImplementation((command: string, args: string[] = [], options = {}) => {
      const childProcess = new MockChildProcess();
      this.mockProcesses.push(childProcess);
      
      // By default, simulate successful process exit after a small delay
      setTimeout(() => {
        childProcess.simulateExit(0);
      }, 50);
      
      return childProcess;
    });
    
    // Default implementation for exec
    this.exec.mockImplementation((command: string, options: any, callback?: any) => {
      // Handle optional options
      if (typeof options === 'function') {
        callback = options;
        options = {};
      }
      
      // Default successful result
      const result = {
        stdout: 'mock stdout output',
        stderr: ''
      };
      
      // Call the callback with success
      if (callback) {
        setTimeout(() => {
          callback(null, result);
        }, 10);
      }
      
      // Return a mock child process
      const childProcess = new MockChildProcess();
      this.mockProcesses.push(childProcess);
      return childProcess;
    });
    
    // Default implementation for execSync
    this.execSync.mockImplementation((command: string, options = {}) => {
      return Buffer.from('mock stdout output');
    });
    
    // Default implementation for fork
    this.fork.mockImplementation((modulePath: string, args: string[] = [], options = {}) => {
      const childProcess = new MockChildProcess();
      this.mockProcesses.push(childProcess);
      
      // By default, simulate successful process exit after a small delay
      setTimeout(() => {
        childProcess.simulateExit(0);
      }, 50);
      
      return childProcess;
    });
  }
  
  /**
   * Create a new mock process without attaching it to any method
   */
  createMockProcess(): MockChildProcess {
    const process = new MockChildProcess();
    this.mockProcesses.push(process);
    return process;
  }
  
  /**
   * Get all created mock processes
   */
  getAllMockProcesses(): MockChildProcess[] {
    return [...this.mockProcesses];
  }
  
  /**
   * Configure spawn to simulate Python processes
   * 
   * This is useful for tests involving Python debugging
   */
  setupPythonSpawnMock(options: {
    exitCode?: number,
    exitDelay?: number,
    stdout?: string[],
    stderr?: string[]
  } = {}): void {
    const {
      exitCode = 0,
      exitDelay = 100,
      stdout = [],
      stderr = []
    } = options;
    
    this.spawn.mockImplementation((command: string, args: string[] = [], spawnOptions = {}) => {
      const childProcess = new MockChildProcess();
      this.mockProcesses.push(childProcess);
      
      // Emit configured stdout messages with small delays
      if (stdout.length > 0) {
        stdout.forEach((msg, index) => {
          setTimeout(() => {
            childProcess.simulateStdout(msg);
          }, 10 * (index + 1));
        });
      }
      
      // Emit configured stderr messages with small delays
      if (stderr.length > 0) {
        stderr.forEach((msg, index) => {
          setTimeout(() => {
            childProcess.simulateStderr(msg);
          }, 10 * (index + 1));
        });
      }
      
      // Simulate process exit after the configured delay
      setTimeout(() => {
        childProcess.simulateExit(exitCode);
      }, exitDelay);
      
      return childProcess;
    });
  }
  
  /**
   * Configure exec to simulate Python version check
   */
  setupPythonVersionCheckMock(pythonVersion: string = '3.10.0'): void {
    this.exec.mockImplementation((command: string, options: any, callback?: any) => {
      // Handle optional options
      if (typeof options === 'function') {
        callback = options;
        options = {};
      }
      
      // Check if this is a Python version check
      const isPythonVersionCheck = command.includes('python') && command.includes('--version');
      
      // Default successful result
      const result = {
        stdout: isPythonVersionCheck ? `Python ${pythonVersion}` : 'mock stdout output',
        stderr: ''
      };
      
      // Call the callback with success
      if (callback) {
        setTimeout(() => {
          callback(null, result);
        }, 10);
      }
      
      // Return a mock child process
      const childProcess = new MockChildProcess();
      this.mockProcesses.push(childProcess);
      return childProcess;
    });
  }
  
  /**
   * Configure spawn to simulate a proxy process with IPC support
   */
  setupProxySpawnMock(options: {
    respondToInit?: boolean,
    initDelay?: number,
    simulateError?: boolean
  } = {}): MockChildProcess {
    const {
      respondToInit = true,
      initDelay = 50,
      simulateError = false
    } = options;
    
    let mockProcess: MockChildProcess | null = null;
    
    this.spawn.mockImplementation((command: string, args: string[] = [], spawnOptions = {}) => {
      mockProcess = new MockChildProcess();
      this.mockProcesses.push(mockProcess);
      
      if (respondToInit) {
        // Listen for init message and respond
        mockProcess.send.mockImplementation((message: any) => {
          if (typeof message === 'string') {
            try {
              const parsed = JSON.parse(message);
              if (parsed.cmd === 'init') {
                setTimeout(() => {
                  if (simulateError) {
                    mockProcess!.simulateMessage({
                      type: 'error',
                      sessionId: parsed.sessionId,
                      message: 'Failed to initialize proxy'
                    });
                  } else {
                    mockProcess!.simulateMessage({
                      type: 'status',
                      sessionId: parsed.sessionId,
                      status: 'adapter_configured_and_launched'
                    });
                  }
                }, initDelay);
              }
            } catch (e) {
              // Invalid JSON
            }
          }
          return true;
        });
      }
      
      return mockProcess;
    });
    
    // Return a getter function that will return the mock process once created
    return {
      get: () => mockProcess
    };
  }
}

// Export a singleton instance
export const childProcessMock = new ChildProcessMock();

// Export the mock functions for direct use
export const {
  spawn,
  exec,
  execSync,
  fork
} = childProcessMock;

// Export the module mock for use with vi.mock
export default {
  spawn,
  exec,
  execSync,
  fork,
  // Helper method for internal test control
  __childProcessMock: childProcessMock
};
