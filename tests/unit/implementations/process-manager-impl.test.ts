/**
 * Unit tests for ProcessManagerImpl
 * 
 * These tests cover various edge cases in how util.promisify might transform
 * the exec callback, which can vary across Node.js versions and implementations.
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Create a variable to control promisify behavior
const promisifyResult: any = null;
const promisifyBehavior: 'resolve' | 'reject' = 'resolve';

// Mock modules - vi.mock is hoisted, so we can't use external variables
vi.mock('child_process', () => ({
  spawn: vi.fn(),
  exec: vi.fn()
}));

vi.mock('util', () => ({
  promisify: vi.fn((fn: any) => {
    // Return a function that uses our controlled behavior
    // We'll access the control variables from the global scope
    return async (...args: any[]) => {
      // Access from global
      const behavior = (globalThis as any).__promisifyBehavior || 'resolve';
      const result = (globalThis as any).__promisifyResult || null;
      
      if (behavior === 'reject') {
        throw result;
      }
      return result;
    };
  })
}));

// Now import the class and mocked functions
import { ProcessManagerImpl } from '../../../src/implementations/process-manager-impl.js';
import { spawn, exec } from 'child_process';

describe('ProcessManagerImpl', () => {
  let processManager: ProcessManagerImpl;
  let consoleWarnSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    processManager = new ProcessManagerImpl();
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    
    // Reset promisify behavior using global variables
    (globalThis as any).__promisifyResult = null;
    (globalThis as any).__promisifyBehavior = 'resolve';
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    // Clean up globals
    delete (globalThis as any).__promisifyResult;
    delete (globalThis as any).__promisifyBehavior;
  });

  describe('spawn', () => {
    it('should spawn a process with given command and args', () => {
      const mockProcess = {
        pid: 12345,
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn(),
        kill: vi.fn()
      };
      (spawn as any).mockReturnValue(mockProcess);
      
      const result = processManager.spawn('node', ['--version'], { cwd: '/test/dir', env: { NODE_ENV: 'test' } });
      
      expect(spawn).toHaveBeenCalledWith('node', ['--version'], { cwd: '/test/dir', env: { NODE_ENV: 'test' } });
      expect(result).toBe(mockProcess);
    });

    it('should spawn a process without options', () => {
      const mockProcess = { pid: 12345, stdout: { on: vi.fn() }, stderr: { on: vi.fn() }, on: vi.fn(), kill: vi.fn() };
      (spawn as any).mockReturnValue(mockProcess);
      
      const result = processManager.spawn('ls', ['-la']);
      
      expect(spawn).toHaveBeenCalledWith('ls', ['-la'], {});
      expect(result).toBe(mockProcess);
    });

    it('should handle spawn errors', () => {
      (spawn as any).mockImplementation(() => { throw new Error('Command not found'); });
      
      expect(() => processManager.spawn('invalid-command', [])).toThrow('Command not found');
    });

    it('should spawn a process with default empty args when args not provided', () => {
      const mockProcess = { pid: 12345, stdout: { on: vi.fn() }, stderr: { on: vi.fn() }, on: vi.fn(), kill: vi.fn() };
      (spawn as any).mockReturnValue(mockProcess);
      
      // Call spawn without args parameter to test default value
      const result = processManager.spawn('pwd');
      
      expect(spawn).toHaveBeenCalledWith('pwd', [], {});
      expect(result).toBe(mockProcess);
    });
  });

  describe('exec', () => {
    it('should handle promisify returning object with stdout/stderr properties (line 22)', async () => {
      // Set promisify to return an object with stdout/stderr
      (globalThis as any).__promisifyResult = {
        stdout: 'output from command',
        stderr: 'error output'
      };

      const result = await processManager.exec('test-command');
      
      expect(result).toEqual({ 
        stdout: 'output from command',
        stderr: 'error output'
      });
    });

    it('should handle promisify returning array [stdout, stderr] (line 27)', async () => {
      // Set promisify to return an array
      (globalThis as any).__promisifyResult = ['array stdout', 'array stderr'];

      const result = await processManager.exec('array-command');
      
      expect(result).toEqual({ 
        stdout: 'array stdout',
        stderr: 'array stderr'
      });
    });

    it('should handle promisify returning string (line 32)', async () => {
      // Set promisify to return just a string
      (globalThis as any).__promisifyResult = 'string output';

      const result = await processManager.exec('string-command');
      
      expect(result).toEqual({ 
        stdout: 'string output',
        stderr: ''
      });
    });

    it('should handle promisify returning unexpected type with warning (lines 39-40)', async () => {
      // Set promisify to return an unexpected type (number)
      (globalThis as any).__promisifyResult = 42;

      const result = await processManager.exec('unexpected-command');
      
      // Should warn about unexpected type
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[ProcessManagerImpl] execAsync resolved to unexpected type:',
        42
      );
      
      // Should return the value cast to the expected type
      expect(result).toBe(42);
    });

    it('should handle promisify returning null (fallback case)', async () => {
      // Set promisify to return null
      (globalThis as any).__promisifyResult = null;

      const result = await processManager.exec('null-command');
      
      // Should warn about unexpected type
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[ProcessManagerImpl] execAsync resolved to unexpected type:',
        null
      );
      
      // Should return null cast to the expected type
      expect(result).toBe(null);
    });

    it('should handle promisify returning object without stdout/stderr (fallback case)', async () => {
      // Set promisify to return an object without stdout/stderr properties
      (globalThis as any).__promisifyResult = { foo: 'bar', baz: 123 };

      const result = await processManager.exec('object-command');
      
      // Should warn about unexpected type
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[ProcessManagerImpl] execAsync resolved to unexpected type:',
        { foo: 'bar', baz: 123 }
      );
      
      // Should return the object cast to the expected type
      expect(result).toBe((globalThis as any).__promisifyResult);
    });

    it('should handle empty array from promisify', async () => {
      // Set promisify to return an empty array
      (globalThis as any).__promisifyResult = [];

      const result = await processManager.exec('empty-array-command');
      
      expect(result).toEqual({ 
        stdout: undefined,
        stderr: undefined
      });
    });

    it('should handle exec errors', async () => {
      const error = new Error('Command failed');
      (globalThis as any).__promisifyBehavior = 'reject';
      (globalThis as any).__promisifyResult = error;

      await expect(processManager.exec('invalid-command')).rejects.toThrow('Command failed');
    });

    it('should handle exec with non-error code (error object passed to callback)', async () => {
      const error: any = new Error('Command failed with code');
      error.code = 127;
      error.stdout = 'partial stdout';
      error.stderr = 'actual stderr';

      (globalThis as any).__promisifyBehavior = 'reject';
      (globalThis as any).__promisifyResult = error;
      
      await expect(processManager.exec('failing-command')).rejects.toThrow('Command failed with code');
      
      // Check that the error object received by the catch block in the test has the properties
      try {
        await processManager.exec('failing-command');
      } catch (e: any) {
        expect(e.code).toBe(127);
        expect(e.stdout).toBe('partial stdout');
        expect(e.stderr).toBe('actual stderr');
      }
    });
  });
});
