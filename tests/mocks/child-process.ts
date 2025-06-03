// @ts-nocheck
/**
 * Mocks for the child_process module
 * 
 * This provides consistent mock implementations for child_process functions
 * used throughout the tests.
 */
import { jest } from '@jest/globals';
import { EventEmitter } from 'events';

/**
 * Mock for a spawned process
 */
class MockChildProcess extends EventEmitter {
  // Stream mocks
  public stdout = new EventEmitter();
  public stderr = new EventEmitter();
  
  // Process methods
  public kill = jest.fn().mockImplementation(() => true);
  
  // Process properties
  public pid: number;
  
  constructor(pid = Math.floor(Math.random() * 10000)) {
    super();
    this.pid = pid;
  }
  
  /**
   * Helper to simulate process exit
   */
  simulateExit(code: number = 0): void {
    this.emit('close', code);
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
   * Reset all mock event listeners
   */
  reset(): void {
    this.removeAllListeners();
    this.stdout.removeAllListeners();
    this.stderr.removeAllListeners();
    this.kill.mockClear();
  }
}

class ChildProcessMock {
  // Mock function implementations
  public spawn = jest.fn();
  public exec = jest.fn();
  public execSync = jest.fn();
  public fork = jest.fn();
  
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
}

// Export a singleton instance
export const childProcessMock = new ChildProcessMock();

// Export the MockChildProcess class for test code to create mock processes
export { MockChildProcess };

// Export the mock functions for direct use
export const {
  spawn,
  exec,
  execSync,
  fork
} = childProcessMock;

// Export the module mock for use with jest.mock
export default {
  spawn,
  exec,
  execSync,
  fork,
  // Helper method for internal test control
  __childProcessMock: childProcessMock
};
