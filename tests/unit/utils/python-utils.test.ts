import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { spawn } from 'child_process';
import { findPythonExecutable, getPythonVersion } from '../../../src/utils/python-utils.js';
import { EventEmitter } from 'events';

// Mock child_process module
vi.mock('child_process', () => ({
  spawn: vi.fn()
}));

const mockSpawn = vi.mocked(spawn);

describe('python-utils', () => {
  let mockProcess: any;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment variables
    delete process.env.PYTHON_PATH;
    delete process.env.PYTHON_EXECUTABLE;
    
    // Create a mock child process
    mockProcess = new EventEmitter() as any;
    mockProcess.stdout = new EventEmitter();
    mockProcess.stderr = new EventEmitter();
    mockProcess.stdio = 'ignore';
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('findPythonExecutable', () => {
    describe.each(['win32', 'linux', 'darwin'])('on %s platform', (platform) => {
      beforeEach(() => {
        vi.stubGlobal('process', { ...process, platform });
      });

      afterEach(() => {
        vi.unstubAllGlobals();
      });

      it('should return user-specified pythonPath if it exists', async () => {
        const checkCommand = platform === 'win32' ? 'where' : 'which';
        
        mockSpawn.mockImplementation((cmd, args) => {
          const proc = new EventEmitter() as any;
          proc.stdout = new EventEmitter();
          proc.stderr = new EventEmitter();
          
          if (cmd === checkCommand && args?.[0] === '/custom/python') {
            process.nextTick(() => proc.emit('exit', 0));
          } else if (platform === 'win32' && cmd === '/custom/python' && args?.[0] === '-c') {
            // Windows validation check
            process.nextTick(() => proc.emit('exit', 0));
          } else {
            process.nextTick(() => proc.emit('exit', 1));
          }
          return proc;
        });

        const result = await findPythonExecutable('/custom/python');
        expect(result).toBe('/custom/python');
        expect(mockSpawn).toHaveBeenCalledWith(checkCommand, ['/custom/python'], { stdio: 'ignore' });
      });

      it('should use PYTHON_PATH environment variable if set', async () => {
        process.env.PYTHON_PATH = '/env/python';
        const checkCommand = platform === 'win32' ? 'where' : 'which';
        
        mockSpawn.mockImplementation((cmd, args) => {
          const proc = new EventEmitter() as any;
          proc.stdout = new EventEmitter();
          proc.stderr = new EventEmitter();
          
          if (cmd === checkCommand && args?.[0] === '/env/python') {
            process.nextTick(() => proc.emit('exit', 0));
          } else if (platform === 'win32' && cmd === '/env/python' && args?.[0] === '-c') {
            // Windows validation check
            process.nextTick(() => proc.emit('exit', 0));
          } else {
            process.nextTick(() => proc.emit('exit', 1));
          }
          return proc;
        });

        const result = await findPythonExecutable();
        expect(result).toBe('/env/python');
      });

      it('should use PYTHON_EXECUTABLE environment variable if PYTHON_PATH is not set', async () => {
        process.env.PYTHON_EXECUTABLE = '/env/exec/python';
        const checkCommand = platform === 'win32' ? 'where' : 'which';
        
        mockSpawn.mockImplementation((cmd, args) => {
          const proc = new EventEmitter() as any;
          proc.stdout = new EventEmitter();
          proc.stderr = new EventEmitter();
          
          if (cmd === checkCommand && args?.[0] === '/env/exec/python') {
            process.nextTick(() => proc.emit('exit', 0));
          } else if (platform === 'win32' && cmd === '/env/exec/python' && args?.[0] === '-c') {
            // Windows validation check
            process.nextTick(() => proc.emit('exit', 0));
          } else {
            process.nextTick(() => proc.emit('exit', 1));
          }
          return proc;
        });

        const result = await findPythonExecutable();
        expect(result).toBe('/env/exec/python');
      });

      it('should auto-detect python3 first, then python', async () => {
        const checkCommand = platform === 'win32' ? 'where' : 'which';
        
        mockSpawn.mockImplementation((cmd, args) => {
          const proc = new EventEmitter() as any;
          proc.stdout = new EventEmitter();
          proc.stderr = new EventEmitter();
          
          if (platform === 'win32') {
            // On Windows, check for 'py' first
            if (cmd === checkCommand && args?.[0] === 'py') {
              process.nextTick(() => proc.emit('exit', 1)); // py not found
            } else if (cmd === checkCommand && args?.[0] === 'python3') {
              process.nextTick(() => proc.emit('exit', 0));
            } else if (cmd === 'python3' && args?.[0] === '-c') {
              // Validation check
              process.nextTick(() => proc.emit('exit', 0));
            } else {
              process.nextTick(() => proc.emit('exit', 1));
            }
          } else {
            // Non-Windows platforms
            if (cmd === checkCommand && args?.[0] === 'python3') {
              process.nextTick(() => proc.emit('exit', 0));
            } else {
              process.nextTick(() => proc.emit('exit', 1));
            }
          }
          return proc;
        });

        const result = await findPythonExecutable();
        expect(result).toBe('python3');
      });

      it('should fall back to python if python3 is not found', async () => {
        const checkCommand = platform === 'win32' ? 'where' : 'which';
        
        mockSpawn.mockImplementation((cmd, args) => {
          const proc = new EventEmitter() as any;
          proc.stdout = new EventEmitter();
          proc.stderr = new EventEmitter();
          
          if (platform === 'win32') {
            // On Windows, check multiple commands
            if (cmd === checkCommand && ['py', 'python3'].includes(args?.[0] || '')) {
              process.nextTick(() => proc.emit('exit', 1)); // Not found
            } else if (cmd === checkCommand && args?.[0] === 'python') {
              process.nextTick(() => proc.emit('exit', 0));
            } else if (cmd === 'python' && args?.[0] === '-c') {
              // Validation check
              process.nextTick(() => proc.emit('exit', 0));
            } else {
              process.nextTick(() => proc.emit('exit', 1));
            }
          } else {
            // Non-Windows platforms
            if (cmd === checkCommand && args?.[0] === 'python3') {
              process.nextTick(() => proc.emit('exit', 1)); // Not found
            } else if (cmd === checkCommand && args?.[0] === 'python') {
              process.nextTick(() => proc.emit('exit', 0));
            } else {
              process.nextTick(() => proc.emit('exit', 1));
            }
          }
          return proc;
        });

        const result = await findPythonExecutable();
        expect(result).toBe('python');
      });

      it('should try version-specific pythons if generic ones fail', async () => {
        const checkCommand = platform === 'win32' ? 'where' : 'which';
        
        mockSpawn.mockImplementation((cmd, args) => {
          const proc = new EventEmitter() as any;
          proc.stdout = new EventEmitter();
          proc.stderr = new EventEmitter();
          
          if (platform === 'win32') {
            // On Windows, check all commands before python3.10
            if (cmd === checkCommand && ['py', 'python3', 'python', 'python3.11'].includes(args?.[0] || '')) {
              process.nextTick(() => proc.emit('exit', 1)); // Not found
            } else if (cmd === checkCommand && args?.[0] === 'python3.10') {
              process.nextTick(() => proc.emit('exit', 0));
            } else if (cmd === 'python3.10' && args?.[0] === '-c') {
              // Validation check
              process.nextTick(() => proc.emit('exit', 0));
            } else {
              process.nextTick(() => proc.emit('exit', 1));
            }
          } else {
            // Non-Windows platforms
            if (cmd === checkCommand && ['python3', 'python', 'python3.11'].includes(args?.[0] || '')) {
              process.nextTick(() => proc.emit('exit', 1)); // Not found
            } else if (cmd === checkCommand && args?.[0] === 'python3.10') {
              process.nextTick(() => proc.emit('exit', 0));
            } else {
              process.nextTick(() => proc.emit('exit', 1));
            }
          }
          return proc;
        });

        const result = await findPythonExecutable();
        expect(result).toBe('python3.10');
      });

      it('should throw an error if no Python is found', async () => {
        const checkCommand = platform === 'win32' ? 'where' : 'which';
        
        mockSpawn.mockImplementation(() => {
          const proc = new EventEmitter() as any;
          process.nextTick(() => proc.emit('exit', 1));
          return proc;
        });

        await expect(findPythonExecutable()).rejects.toThrow('Python not found');
      });

      it('should handle spawn errors gracefully', async () => {
        mockSpawn.mockImplementation(() => {
          const proc = new EventEmitter() as any;
          process.nextTick(() => proc.emit('error', new Error('spawn failed')));
          return proc;
        });

        await expect(findPythonExecutable()).rejects.toThrow('Python not found');
      });
    });

    describe('Windows-specific Store alias handling', () => {
      beforeEach(() => {
        vi.stubGlobal('process', { ...process, platform: 'win32' });
      });

      afterEach(() => {
        vi.unstubAllGlobals();
      });

      it('should prioritize py launcher on Windows', async () => {
        mockSpawn.mockImplementation((cmd, args) => {
          const proc = new EventEmitter() as any;
          proc.stdout = new EventEmitter();
          proc.stderr = new EventEmitter();
          
          if (cmd === 'where' && args?.[0] === 'py') {
            process.nextTick(() => proc.emit('exit', 0));
          } else if (cmd === 'py' && args?.[0] === '-c') {
            // Validation check for py command
            process.nextTick(() => proc.emit('exit', 0));
          } else {
            process.nextTick(() => proc.emit('exit', 1));
          }
          return proc;
        });

        const result = await findPythonExecutable();
        expect(result).toBe('py');
      });

      it('should validate python executable to detect Store aliases', async () => {
        let callCount = 0;
        
        mockSpawn.mockImplementation((cmd, args) => {
          callCount++;
          const proc = new EventEmitter() as any;
          proc.stdout = new EventEmitter();
          proc.stderr = new EventEmitter();
          
          // Sequence:
          // 1. where py -> not found
          // 2. where python3 -> not found
          // 3. where python -> found (but it's a Store alias)
          // 4. python -c -> fails with Store message
          // 5. where python3.11 -> found
          // 6. python3.11 -c -> succeeds
          
          if (cmd === 'where') {
            if (args?.[0] === 'py' && callCount === 1) {
              // py not found
              process.nextTick(() => proc.emit('exit', 1));
            } else if (args?.[0] === 'python3' && callCount === 2) {
              // python3 not found
              process.nextTick(() => proc.emit('exit', 1));
            } else if (args?.[0] === 'python' && callCount === 3) {
              // python found (but it's a Store alias)
              process.nextTick(() => proc.emit('exit', 0));
            } else if (args?.[0] === 'python3.11' && callCount === 5) {
              // python3.11 found
              process.nextTick(() => proc.emit('exit', 0));
            } else {
              process.nextTick(() => proc.emit('exit', 1));
            }
          }
          // Validation commands
          else if (cmd === 'python' && args?.[0] === '-c' && callCount === 4) {
            // python validation fails with Store message
            process.nextTick(() => {
              proc.stderr.emit('data', Buffer.from('Python was not found; run without arguments to install from the Microsoft Store'));
              proc.emit('exit', 9009);
            });
          }
          else if (cmd === 'python3.11' && args?.[0] === '-c' && callCount === 6) {
            // python3.11 validation succeeds
            process.nextTick(() => proc.emit('exit', 0));
          }
          else {
            process.nextTick(() => proc.emit('exit', 1));
          }
          
          return proc;
        });

        const result = await findPythonExecutable();
        expect(result).toBe('python3.11');
        expect(callCount).toBe(6);
      });
    });
  });

  describe('getPythonVersion', () => {
    it('should return Python version string', async () => {
      mockSpawn.mockImplementation((cmd, args) => {
        const proc = new EventEmitter() as any;
        proc.stdout = new EventEmitter();
        proc.stderr = new EventEmitter();
        
        if (args?.[0] === '--version') {
          process.nextTick(() => {
            proc.stdout.emit('data', Buffer.from('Python 3.11.5\n'));
            proc.emit('exit', 0);
          });
        }
        
        return proc;
      });

      const version = await getPythonVersion('python');
      expect(version).toBe('3.11.5');
    });

    it('should handle version output on stderr', async () => {
      mockSpawn.mockImplementation((cmd, args) => {
        const proc = new EventEmitter() as any;
        proc.stdout = new EventEmitter();
        proc.stderr = new EventEmitter();
        
        if (args?.[0] === '--version') {
          process.nextTick(() => {
            proc.stderr.emit('data', Buffer.from('Python 3.9.0'));
            proc.emit('exit', 0);
          });
        }
        
        return proc;
      });

      const version = await getPythonVersion('python');
      expect(version).toBe('3.9.0');
    });

    it('should return null on spawn error', async () => {
      mockSpawn.mockImplementation(() => {
        const proc = new EventEmitter() as any;
        proc.stdout = new EventEmitter();
        proc.stderr = new EventEmitter();
        process.nextTick(() => proc.emit('error', new Error('spawn failed')));
        return proc;
      });

      const version = await getPythonVersion('python');
      expect(version).toBeNull();
    });

    it('should return null on non-zero exit code', async () => {
      mockSpawn.mockImplementation(() => {
        const proc = new EventEmitter() as any;
        proc.stdout = new EventEmitter();
        proc.stderr = new EventEmitter();
        process.nextTick(() => proc.emit('exit', 1));
        return proc;
      });

      const version = await getPythonVersion('python');
      expect(version).toBeNull();
    });

    it('should return raw output if version pattern not found', async () => {
      mockSpawn.mockImplementation((cmd, args) => {
        const proc = new EventEmitter() as any;
        proc.stdout = new EventEmitter();
        proc.stderr = new EventEmitter();
        
        if (args?.[0] === '--version') {
          process.nextTick(() => {
            proc.stdout.emit('data', Buffer.from('Custom Python Build'));
            proc.emit('exit', 0);
          });
        }
        
        return proc;
      });

      const version = await getPythonVersion('python');
      expect(version).toBe('Custom Python Build');
    });
  });
});
