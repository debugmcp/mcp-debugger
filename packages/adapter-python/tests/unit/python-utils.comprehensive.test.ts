import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import path from 'node:path';
import fs from 'node:fs';

// Mock child_process before importing the module
vi.mock('child_process', async () => {
  const actual = await vi.importActual<typeof import('child_process')>('child_process');
  const spawn = vi.fn();
  return { ...actual, spawn };
});

// Mock which library
vi.mock('which', () => ({
  default: vi.fn()
}));

import { spawn } from 'child_process';
import which from 'which';
import {
  findPythonExecutable,
  getPythonVersion,
  setDefaultCommandFinder,
  CommandNotFoundError,
  type CommandFinder,
} from '../../src/utils/python-utils.js';

type ChildProcessMock = EventEmitter & {
  stdout: EventEmitter;
  stderr: EventEmitter;
  kill: () => void;
};

const spawnMock = spawn as unknown as vi.Mock;
const whichMock = which as unknown as vi.Mock;

const createSpawn = (options: { exitCode: number; stdout?: string; stderr?: string; error?: Error }) => {
  const proc = new EventEmitter() as ChildProcessMock;
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.kill = vi.fn();

  setImmediate(() => {
    if (options.error) {
      proc.emit('error', options.error);
      return;
    }
    if (options.stdout) {
      proc.stdout.emit('data', Buffer.from(options.stdout));
    }
    if (options.stderr) {
      proc.stderr.emit('data', Buffer.from(options.stderr));
    }
    proc.emit('exit', options.exitCode);
  });

  return proc;
};

const originalEnv = process.env;
const originalPlatform = process.platform;

describe('CommandNotFoundError', () => {
  it('creates error with command property', () => {
    const error = new CommandNotFoundError('python');
    expect(error.name).toBe('CommandNotFoundError');
    expect(error.command).toBe('python');
    expect(error.message).toBe('python');
  });

  it('is instance of Error', () => {
    const error = new CommandNotFoundError('python3');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(CommandNotFoundError);
  });
});

describe('setDefaultCommandFinder', () => {
  it('returns previous finder when setting new one', () => {
    const mockFinder1: CommandFinder = {
      find: vi.fn(async () => '/usr/bin/python')
    };
    const mockFinder2: CommandFinder = {
      find: vi.fn(async () => '/usr/local/bin/python')
    };

    const previous1 = setDefaultCommandFinder(mockFinder1);
    expect(previous1).toBeDefined();

    const previous2 = setDefaultCommandFinder(mockFinder2);
    expect(previous2).toBe(mockFinder1);

    // Restore original
    setDefaultCommandFinder(previous1);
  });
});

describe('WhichCommandFinder integration', () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    spawnMock.mockReset();
    whichMock.mockReset();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('Windows platform behavior', () => {
    it('handles Path to PATH conversion on Windows', async () => {
      const platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('win32');
      process.env.Path = 'C:\\Windows\\System32;C:\\Python311';
      delete process.env.PATH;
      process.env.DEBUG_PYTHON_DISCOVERY = 'false';

      whichMock.mockResolvedValue(['C:\\Python311\\python.exe']);
      spawnMock.mockImplementation(() => createSpawn({ exitCode: 0, stdout: '1.8.0' }));

      const loggerMock = { error: vi.fn(), debug: vi.fn() };

      try {
        await findPythonExecutable(undefined, loggerMock);
        expect(process.env.PATH).toBeDefined();
      } finally {
        platformSpy.mockRestore();
      }
    });

    it('filters Windows Store aliases', async () => {
      const platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('win32');
      process.env.DEBUG_PYTHON_DISCOVERY = 'false';

      // Mock which to return Windows Store alias first, then real Python
      whichMock.mockResolvedValueOnce([
        'C:\\Users\\test\\AppData\\Local\\Microsoft\\WindowsApps\\python.exe',
        'C:\\Python311\\python.exe'
      ]);

      spawnMock.mockImplementation(() => createSpawn({ exitCode: 0, stdout: '1.8.0' }));

      const loggerMock = { error: vi.fn(), debug: vi.fn() };

      try {
        const result = await findPythonExecutable(undefined, loggerMock);
        expect(result).toBe('C:\\Python311\\python.exe');
      } finally {
        platformSpy.mockRestore();
      }
    });

    it('handles .exe extension on Windows', async () => {
      const platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('win32');
      process.env.DEBUG_PYTHON_DISCOVERY = 'false';
      delete process.env.pythonLocation;

      const finder: CommandFinder = {
        find: vi.fn(async (cmd) => {
          if (cmd === 'python.exe' || cmd === 'python') {
            return 'C:\\Python311\\python.exe';
          }
          throw new CommandNotFoundError(cmd);
        })
      };
      const previousFinder = setDefaultCommandFinder(finder);

      spawnMock.mockImplementation(() => createSpawn({ exitCode: 0, stdout: '1.8.0' }));

      const loggerMock = { error: vi.fn(), debug: vi.fn() };

      try {
        const result = await findPythonExecutable(undefined, loggerMock, finder);
        expect(result).toBe('C:\\Python311\\python.exe');
        expect(finder.find).toHaveBeenCalled();
      } finally {
        setDefaultCommandFinder(previousFinder);
        platformSpy.mockRestore();
      }
    });

    it('logs verbose discovery information when DEBUG_PYTHON_DISCOVERY=true', async () => {
      const platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('win32');
      process.env.DEBUG_PYTHON_DISCOVERY = 'true';
      process.env.PATH = 'C:\\Python311;C:\\Windows';
      delete process.env.pythonLocation;
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const finder: CommandFinder = {
        find: vi.fn(async () => { throw new CommandNotFoundError('python'); })
      };
      const previousFinder = setDefaultCommandFinder(finder);

      spawnMock.mockImplementation(() => createSpawn({ exitCode: 1, error: new Error('not found') }));

      const loggerMock = { error: vi.fn(), debug: vi.fn() };

      try {
        await expect(findPythonExecutable(undefined, loggerMock, finder)).rejects.toThrow();
        // Verbose discovery logs to console.log and console.error with [PYTHON_DISCOVERY_DEBUG]
        expect(consoleLogSpy).toHaveBeenCalledWith(
          '[PYTHON_DISCOVERY_DEBUG]',
          expect.stringContaining('platform')
        );
      } finally {
        setDefaultCommandFinder(previousFinder);
        platformSpy.mockRestore();
        consoleErrorSpy.mockRestore();
        consoleLogSpy.mockRestore();
      }
    });

    it('detects Windows Store alias by stderr content', async () => {
      const platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('win32');
      process.env.DEBUG_PYTHON_DISCOVERY = 'false';
      delete process.env.pythonLocation;

      const finder: CommandFinder = {
        find: vi.fn(async (cmd) => {
          if (cmd === 'py' || cmd === 'python' || cmd === 'python3') {
            return 'C:\\fake\\python.exe';
          }
          throw new CommandNotFoundError(cmd);
        })
      };
      const previousFinder = setDefaultCommandFinder(finder);

      // First spawn validates executable (Windows Store alias detected)
      spawnMock.mockImplementation(() => createSpawn({
        exitCode: 9009,
        stderr: 'Microsoft Store',
        error: undefined
      }));

      const loggerMock = { error: vi.fn(), debug: vi.fn() };

      try {
        await expect(findPythonExecutable(undefined, loggerMock, finder)).rejects.toThrow('Python not found');
      } finally {
        setDefaultCommandFinder(previousFinder);
        platformSpy.mockRestore();
      }
    });
  });

  describe('Environment variable handling', () => {
    it('uses PYTHON_EXECUTABLE environment variable', async () => {
      const platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
      process.env.PYTHON_EXECUTABLE = '/opt/python/bin/python3';
      delete process.env.PYTHON_PATH;
      process.env.DEBUG_PYTHON_DISCOVERY = 'false';

      whichMock.mockResolvedValue([process.env.PYTHON_EXECUTABLE]);
      spawnMock.mockImplementation(() => createSpawn({ exitCode: 0, stdout: '1.8.0' }));

      const loggerMock = { error: vi.fn(), debug: vi.fn() };

      try {
        const result = await findPythonExecutable(undefined, loggerMock);
        expect(result).toBe('/opt/python/bin/python3');
      } finally {
        platformSpy.mockRestore();
      }
    });

    it('uses PythonLocation (uppercase) environment variable on Windows', async () => {
      const platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('win32');
      const pythonRoot = 'C:\\PythonLocation\\3.11.9';
      process.env.PythonLocation = pythonRoot;
      delete process.env.pythonLocation;
      delete process.env.PYTHON_PATH;
      process.env.DEBUG_PYTHON_DISCOVERY = 'false';

      const fsExists = vi
        .spyOn(fs, 'existsSync')
        .mockImplementation((candidate: fs.PathLike) =>
          typeof candidate === 'string' && candidate.startsWith(pythonRoot)
        );

      spawnMock.mockImplementation(() => createSpawn({ exitCode: 0, stdout: '1.8.0' }));

      const loggerMock = { error: vi.fn(), debug: vi.fn() };

      try {
        const result = await findPythonExecutable(undefined, loggerMock);
        expect(result).toBe(path.join(pythonRoot, 'python.exe'));
      } finally {
        setDefaultCommandFinder({ find: async () => { throw new CommandNotFoundError(''); } });
        fsExists.mockRestore();
        platformSpy.mockRestore();
      }
    });

    it('uses pythonLocation on non-Windows with bin subdirectory', async () => {
      const platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
      const pythonRoot = '/opt/python/3.11.9';
      process.env.pythonLocation = pythonRoot;
      delete process.env.PYTHON_PATH;
      process.env.DEBUG_PYTHON_DISCOVERY = 'false';

      const fsExists = vi
        .spyOn(fs, 'existsSync')
        .mockImplementation((candidate: fs.PathLike) => {
          const str = typeof candidate === 'string' ? candidate : candidate.toString();
          return str === path.join(pythonRoot, 'bin', 'python3');
        });

      spawnMock.mockImplementation(() => createSpawn({ exitCode: 0, stdout: '1.8.0' }));

      const loggerMock = { error: vi.fn(), debug: vi.fn() };

      try {
        const result = await findPythonExecutable(undefined, loggerMock);
        expect(result).toBe(path.join(pythonRoot, 'bin', 'python3'));
      } finally {
        setDefaultCommandFinder({ find: async () => { throw new CommandNotFoundError(''); } });
        fsExists.mockRestore();
        platformSpy.mockRestore();
      }
    });
  });

  describe('preferredPath parameter', () => {
    it('returns preferredPath immediately when valid on non-Windows', async () => {
      const platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
      process.env.DEBUG_PYTHON_DISCOVERY = 'false';

      const finder: CommandFinder = {
        find: vi.fn(async (cmd) => `/custom/path/${cmd}`)
      };
      const previousFinder = setDefaultCommandFinder(finder);

      spawnMock.mockImplementation(() => createSpawn({ exitCode: 0 }));

      const loggerMock = { error: vi.fn(), debug: vi.fn() };

      try {
        const result = await findPythonExecutable('my-python', loggerMock, finder);
        expect(result).toBe('/custom/path/my-python');
        expect(finder.find).toHaveBeenCalledWith('my-python');
      } finally {
        setDefaultCommandFinder(previousFinder);
        platformSpy.mockRestore();
      }
    });

    it('skips invalid preferredPath and continues discovery', async () => {
      const platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
      process.env.DEBUG_PYTHON_DISCOVERY = 'false';

      const finder: CommandFinder = {
        find: vi.fn(async (cmd) => {
          if (cmd === 'invalid-python') {
            throw new CommandNotFoundError(cmd);
          }
          return `/usr/bin/${cmd}`;
        })
      };
      const previousFinder = setDefaultCommandFinder(finder);

      spawnMock.mockImplementation(() => createSpawn({ exitCode: 0, stdout: '1.8.0' }));

      const loggerMock = { error: vi.fn(), debug: vi.fn() };

      try {
        const result = await findPythonExecutable('invalid-python', loggerMock, finder);
        expect(result).toBe('/usr/bin/python3');
      } finally {
        setDefaultCommandFinder(previousFinder);
        platformSpy.mockRestore();
      }
    });

    it('throws error when preferredPath finder throws non-CommandNotFoundError', async () => {
      const platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
      process.env.DEBUG_PYTHON_DISCOVERY = 'false';

      const customError = new Error('Permission denied');
      const finder: CommandFinder = {
        find: vi.fn(async () => { throw customError; })
      };
      const previousFinder = setDefaultCommandFinder(finder);

      const loggerMock = { error: vi.fn(), debug: vi.fn() };

      try {
        await expect(findPythonExecutable('python', loggerMock, finder)).rejects.toThrow('Permission denied');
      } finally {
        setDefaultCommandFinder(previousFinder);
        platformSpy.mockRestore();
      }
    });
  });

  describe('Multiple Python installations with debugpy preference', () => {
    it('prefers Python with debugpy installed', async () => {
      const platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
      process.env.DEBUG_PYTHON_DISCOVERY = 'false';
      delete process.env.pythonLocation;

      let callCount = 0;
      const finder: CommandFinder = {
        find: vi.fn(async (cmd) => {
          if (cmd === 'python3') return '/usr/bin/python3';
          if (cmd === 'python') return '/usr/local/bin/python';
          throw new CommandNotFoundError(cmd);
        })
      };
      const previousFinder = setDefaultCommandFinder(finder);

      // First Python validation passes, first debugpy check (no debugpy)
      // Second Python validation passes, second debugpy check (has debugpy)
      spawnMock.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First debugpy check - no debugpy
          return createSpawn({ exitCode: 1, stderr: 'No module named debugpy', error: undefined });
        } else {
          // Second debugpy check - has debugpy
          return createSpawn({ exitCode: 0, stdout: '1.8.0', error: undefined });
        }
      });

      const loggerMock = { error: vi.fn(), debug: vi.fn() };

      try {
        const result = await findPythonExecutable(undefined, loggerMock, finder);
        expect(result).toBe('/usr/local/bin/python');
        expect(loggerMock.debug).toHaveBeenCalledWith(expect.stringContaining('Found Python with debugpy'));
      } finally {
        setDefaultCommandFinder(previousFinder);
        platformSpy.mockRestore();
      }
    });

    it('returns first valid Python when none have debugpy', async () => {
      const platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
      process.env.DEBUG_PYTHON_DISCOVERY = 'false';
      delete process.env.pythonLocation;

      const finder: CommandFinder = {
        find: vi.fn(async (cmd) => {
          if (cmd === 'python3') return '/usr/bin/python3';
          if (cmd === 'python') return '/usr/local/bin/python';
          throw new CommandNotFoundError(cmd);
        })
      };
      const previousFinder = setDefaultCommandFinder(finder);

      // Both debugpy checks fail
      spawnMock.mockImplementation(() => createSpawn({ exitCode: 1, stderr: 'No module named debugpy', error: undefined }));

      const loggerMock = { error: vi.fn(), debug: vi.fn() };

      try {
        const result = await findPythonExecutable(undefined, loggerMock, finder);
        expect(result).toBe('/usr/bin/python3');
        expect(loggerMock.debug).toHaveBeenCalledWith(expect.stringContaining('debugpy will need to be installed'));
      } finally {
        setDefaultCommandFinder(previousFinder);
        platformSpy.mockRestore();
      }
    });
  });

  describe('Error scenarios', () => {
    it('throws error with tried paths when no Python found', async () => {
      const platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
      process.env.DEBUG_PYTHON_DISCOVERY = 'false';
      delete process.env.PYTHON_PATH;
      delete process.env.pythonLocation;

      whichMock.mockRejectedValue(new Error('not found'));

      const loggerMock = { error: vi.fn(), debug: vi.fn() };

      try {
        await expect(findPythonExecutable(undefined, loggerMock)).rejects.toThrow(/Python not found.*Tried:/s);
      } finally {
        platformSpy.mockRestore();
      }
    });

    it('logs detailed failure info in CI environment', async () => {
      const platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
      process.env.DEBUG_PYTHON_DISCOVERY = 'false';
      process.env.CI = 'true';
      delete process.env.pythonLocation;

      whichMock.mockRejectedValue(new Error('not found'));

      const loggerMock = { error: vi.fn(), debug: vi.fn() };

      try {
        await expect(findPythonExecutable(undefined, loggerMock)).rejects.toThrow();
        expect(loggerMock.error).toHaveBeenCalledWith(
          expect.stringContaining('[PYTHON_DISCOVERY_FAILED]')
        );
      } finally {
        platformSpy.mockRestore();
      }
    });
  });
});

describe('getPythonVersion', () => {
  beforeEach(() => {
    spawnMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns version string when successful', async () => {
    spawnMock.mockImplementation(() =>
      createSpawn({ exitCode: 0, stdout: 'Python 3.11.9' })
    );

    const version = await getPythonVersion('/usr/bin/python3');
    expect(version).toBe('3.11.9');
  });

  it('returns full output when version pattern not matched', async () => {
    spawnMock.mockImplementation(() =>
      createSpawn({ exitCode: 0, stdout: 'Python dev version' })
    );

    const version = await getPythonVersion('/usr/bin/python3');
    expect(version).toBe('Python dev version');
  });

  it('returns version from stderr if present', async () => {
    spawnMock.mockImplementation(() =>
      createSpawn({ exitCode: 0, stderr: 'Python 3.9.0' })
    );

    const version = await getPythonVersion('/usr/bin/python3');
    expect(version).toBe('3.9.0');
  });

  it('returns null when spawn fails', async () => {
    spawnMock.mockImplementation(() =>
      createSpawn({ exitCode: 0, error: new Error('spawn failed') })
    );

    const version = await getPythonVersion('/nonexistent/python');
    expect(version).toBeNull();
  });

  it('returns null when exit code is non-zero', async () => {
    spawnMock.mockImplementation(() =>
      createSpawn({ exitCode: 1, stderr: 'error' })
    );

    const version = await getPythonVersion('/usr/bin/python3');
    expect(version).toBeNull();
  });

  it('returns null when no output', async () => {
    spawnMock.mockImplementation(() =>
      createSpawn({ exitCode: 0 })
    );

    const version = await getPythonVersion('/usr/bin/python3');
    expect(version).toBeNull();
  });
});

describe('WhichCommandFinder class behavior', () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    spawnMock.mockReset();
    whichMock.mockReset();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('handles spawn error when checking debugpy', async () => {
    const platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
    process.env.DEBUG_PYTHON_DISCOVERY = 'false';
    delete process.env.pythonLocation;

    const finder: CommandFinder = {
      find: vi.fn(async (cmd) => {
        if (cmd === 'python3') return '/usr/bin/python3';
        throw new CommandNotFoundError(cmd);
      })
    };
    const previousFinder = setDefaultCommandFinder(finder);

    // Spawn error when checking debugpy
    spawnMock.mockImplementation(() => createSpawn({ exitCode: 0, error: new Error('spawn error') }));

    const loggerMock = { error: vi.fn(), debug: vi.fn() };

    try {
      const result = await findPythonExecutable(undefined, loggerMock, finder);
      // Should still return first valid Python even when debugpy check errors
      expect(result).toBe('/usr/bin/python3');
    } finally {
      setDefaultCommandFinder(previousFinder);
      platformSpy.mockRestore();
    }
  });

  it('logs debug messages during Python discovery', async () => {
    const platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
    process.env.DEBUG_PYTHON_DISCOVERY = 'false';
    delete process.env.pythonLocation;

    const finder: CommandFinder = {
      find: vi.fn(async (cmd) => {
        if (cmd === 'python3') return '/usr/bin/python3';
        throw new CommandNotFoundError(cmd);
      })
    };
    const previousFinder = setDefaultCommandFinder(finder);

    spawnMock.mockImplementation(() => createSpawn({ exitCode: 0, stdout: '1.8.0', error: undefined }));

    const loggerMock = { error: vi.fn(), debug: vi.fn() };

    try {
      await findPythonExecutable(undefined, loggerMock, finder);
      expect(loggerMock.debug).toHaveBeenCalledWith(expect.stringContaining('[Python Detection]'));
    } finally {
      setDefaultCommandFinder(previousFinder);
      platformSpy.mockRestore();
    }
  });

  it('handles Windows Store alias detected by AppData path in stderr', async () => {
    const platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('win32');
    process.env.DEBUG_PYTHON_DISCOVERY = 'false';
    delete process.env.pythonLocation;

    const finder: CommandFinder = {
      find: vi.fn(async (cmd) => {
        if (cmd === 'py') return 'C:\\fake\\python.exe';
        throw new CommandNotFoundError(cmd);
      })
    };
    const previousFinder = setDefaultCommandFinder(finder);

    // Windows Store alias detected by AppData path
    spawnMock.mockImplementation(() => createSpawn({
      exitCode: 1,
      stderr: 'AppData\\Local\\Microsoft\\WindowsApps',
      error: undefined
    }));

    const loggerMock = { error: vi.fn(), debug: vi.fn() };

    try {
      await expect(findPythonExecutable(undefined, loggerMock, finder)).rejects.toThrow('Python not found');
      expect(loggerMock.error).toHaveBeenCalledWith(expect.stringContaining('Windows Store alias'));
    } finally {
      setDefaultCommandFinder(previousFinder);
      platformSpy.mockRestore();
    }
  });

  it('handles errors other than CommandNotFoundError in environment variable lookup', async () => {
    const platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
    process.env.PYTHON_EXECUTABLE = '/invalid/python';
    process.env.DEBUG_PYTHON_DISCOVERY = 'false';

    const customError = new TypeError('Invalid path');
    const finder: CommandFinder = {
      find: vi.fn(async () => { throw customError; })
    };
    const previousFinder = setDefaultCommandFinder(finder);

    const loggerMock = { error: vi.fn(), debug: vi.fn() };

    try {
      await expect(findPythonExecutable(undefined, loggerMock, finder)).rejects.toThrow('Invalid path');
    } finally {
      setDefaultCommandFinder(previousFinder);
      platformSpy.mockRestore();
    }
  });

  it('checks all pythonLocation candidates on non-Windows', async () => {
    const platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
    const pythonRoot = '/opt/python/3.11.9';
    process.env.pythonLocation = pythonRoot;
    delete process.env.PYTHON_PATH;
    process.env.DEBUG_PYTHON_DISCOVERY = 'false';

    // Only the last candidate exists
    const fsExists = vi
      .spyOn(fs, 'existsSync')
      .mockImplementation((candidate: fs.PathLike) => {
        const str = typeof candidate === 'string' ? candidate : candidate.toString();
        return str === path.join(pythonRoot, 'python');
      });

    spawnMock.mockImplementation(() => createSpawn({ exitCode: 0, stdout: '1.8.0', error: undefined }));

    const loggerMock = { error: vi.fn(), debug: vi.fn() };

    try {
      const result = await findPythonExecutable(undefined, loggerMock);
      expect(result).toBe(path.join(pythonRoot, 'python'));
    } finally {
      setDefaultCommandFinder({ find: async () => { throw new CommandNotFoundError(''); } });
      fsExists.mockRestore();
      platformSpy.mockRestore();
    }
  });

  it('continues to next pythonLocation candidate when validation fails', async () => {
    const platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('win32');
    const pythonRoot = 'C:\\Python311';
    process.env.pythonLocation = pythonRoot;
    delete process.env.PYTHON_PATH;
    process.env.DEBUG_PYTHON_DISCOVERY = 'false';

    let callCount = 0;
    const fsExists = vi
      .spyOn(fs, 'existsSync')
      .mockImplementation((candidate: fs.PathLike) => {
        return true; // All candidates exist
      });

    // First candidate validation fails (Windows Store alias), second succeeds
    spawnMock.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return createSpawn({ exitCode: 9009, stderr: 'Microsoft Store', error: undefined });
      }
      return createSpawn({ exitCode: 0, stdout: '1.8.0', error: undefined });
    });

    const loggerMock = { error: vi.fn(), debug: vi.fn() };

    try {
      const result = await findPythonExecutable(undefined, loggerMock);
      expect(result).toBe(path.join(pythonRoot, 'python'));
    } finally {
      setDefaultCommandFinder({ find: async () => { throw new CommandNotFoundError(''); } });
      fsExists.mockRestore();
      platformSpy.mockRestore();
    }
  });
});

describe('Additional edge cases', () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    spawnMock.mockReset();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('handles errors during auto-detect loop', async () => {
    const platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
    process.env.DEBUG_PYTHON_DISCOVERY = 'false';
    delete process.env.pythonLocation;
    delete process.env.PYTHON_PATH;

    const finder: CommandFinder = {
      find: vi.fn(async (cmd) => {
        if (cmd === 'python3') throw new Error('Unexpected error');
        throw new CommandNotFoundError(cmd);
      })
    };
    const previousFinder = setDefaultCommandFinder(finder);

    const loggerMock = { error: vi.fn(), debug: vi.fn() };

    try {
      // Should handle the unexpected error and continue to next command
      await expect(findPythonExecutable(undefined, loggerMock, finder)).rejects.toThrow();
    } finally {
      setDefaultCommandFinder(previousFinder);
      platformSpy.mockRestore();
    }
  });

  it('handles Windows Store alias detected by "Windows Store" in stderr', async () => {
    const platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('win32');
    process.env.DEBUG_PYTHON_DISCOVERY = 'false';
    delete process.env.pythonLocation;

    const finder: CommandFinder = {
      find: vi.fn(async () => 'C:\\fake\\python.exe')
    };
    const previousFinder = setDefaultCommandFinder(finder);

    spawnMock.mockImplementation(() => createSpawn({
      exitCode: 1,
      stderr: 'Windows Store',
      error: undefined
    }));

    const loggerMock = { error: vi.fn(), debug: vi.fn() };

    try {
      await expect(findPythonExecutable(undefined, loggerMock, finder)).rejects.toThrow();
    } finally {
      setDefaultCommandFinder(previousFinder);
      platformSpy.mockRestore();
    }
  });

  it('validates Python executable on Windows before returning', async () => {
    const platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('win32');
    process.env.DEBUG_PYTHON_DISCOVERY = 'false';
    process.env.PYTHON_PATH = 'C:\\Python\\python.exe';

    const finder: CommandFinder = {
      find: vi.fn(async () => 'C:\\Python\\python.exe')
    };
    const previousFinder = setDefaultCommandFinder(finder);

    spawnMock.mockImplementation(() => createSpawn({ exitCode: 0, stdout: '1.8.0', error: undefined }));

    const loggerMock = { error: vi.fn(), debug: vi.fn() };

    try {
      const result = await findPythonExecutable(undefined, loggerMock, finder);
      expect(result).toBe('C:\\Python\\python.exe');
      // Verify validation was called
      expect(spawnMock).toHaveBeenCalled();
    } finally {
      setDefaultCommandFinder(previousFinder);
      platformSpy.mockRestore();
    }
  });

  it('checks multiple pythonLocation candidates when first does not exist', async () => {
    const platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('win32');
    const pythonRoot = 'C:\\Python311';
    process.env.pythonLocation = pythonRoot;
    delete process.env.PYTHON_PATH;
    process.env.DEBUG_PYTHON_DISCOVERY = 'false';

    // Only the second candidate exists
    let checkCount = 0;
    const fsExists = vi
      .spyOn(fs, 'existsSync')
      .mockImplementation((candidate: fs.PathLike) => {
        checkCount++;
        const str = typeof candidate === 'string' ? candidate : candidate.toString();
        return checkCount > 1 && str === path.join(pythonRoot, 'python');
      });

    spawnMock.mockImplementation(() => createSpawn({ exitCode: 0, stdout: '1.8.0', error: undefined }));

    const loggerMock = { error: vi.fn(), debug: vi.fn() };

    try {
      const result = await findPythonExecutable(undefined, loggerMock);
      expect(result).toBe(path.join(pythonRoot, 'python'));
      expect(fsExists).toHaveBeenCalled();
    } finally {
      setDefaultCommandFinder({ find: async () => { throw new CommandNotFoundError(''); } });
      fsExists.mockRestore();
      platformSpy.mockRestore();
    }
  });

  it('returns first valid Python when collecting multiple candidates', async () => {
    const platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
    process.env.DEBUG_PYTHON_DISCOVERY = 'false';
    delete process.env.pythonLocation;
    delete process.env.PYTHON_PATH;

    let callCount = 0;
    const finder: CommandFinder = {
      find: vi.fn(async (cmd) => {
        if (cmd === 'python3') return '/usr/bin/python3';
        if (cmd === 'python') return '/usr/local/bin/python';
        throw new CommandNotFoundError(cmd);
      })
    };
    const previousFinder = setDefaultCommandFinder(finder);

    // All debugpy checks fail
    spawnMock.mockImplementation(() => createSpawn({ exitCode: 1, stderr: 'No module named debugpy', error: undefined }));

    const loggerMock = { error: vi.fn(), debug: vi.fn() };

    try {
      const result = await findPythonExecutable(undefined, loggerMock, finder);
      expect(result).toBe('/usr/bin/python3');
      expect(loggerMock.debug).toHaveBeenCalledWith(expect.stringContaining('debugpy will need to be installed'));
    } finally {
      setDefaultCommandFinder(previousFinder);
      platformSpy.mockRestore();
    }
  });
});

describe('Verbose discovery logging', () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    spawnMock.mockReset();
    whichMock.mockReset();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('logs verbose discovery info when DEBUG_PYTHON_DISCOVERY=true on Windows', async () => {
    const platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('win32');
    process.env.DEBUG_PYTHON_DISCOVERY = 'true';
    process.env.CI = 'true';
    process.env.GITHUB_ACTIONS = 'true';
    process.env.PATH = 'C:\\Python311;C:\\Windows\\System32';
    delete process.env.pythonLocation;

    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const finder: CommandFinder = {
      find: vi.fn(async (cmd) => {
        if (cmd === 'py' || cmd === 'python') {
          return 'C:\\Python311\\python.exe';
        }
        throw new CommandNotFoundError(cmd);
      })
    };
    const previousFinder = setDefaultCommandFinder(finder);

    spawnMock.mockImplementation(() => createSpawn({ exitCode: 0, stdout: '1.8.0', error: undefined }));

    const loggerMock = { error: vi.fn(), debug: vi.fn() };

    try {
      await findPythonExecutable(undefined, loggerMock, finder);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[PYTHON_DISCOVERY_DEBUG]',
        expect.stringContaining('platform')
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[PYTHON_DISCOVERY_DEBUG]',
        expect.stringContaining('platform')
      );
    } finally {
      setDefaultCommandFinder(previousFinder);
      platformSpy.mockRestore();
      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    }
  });

  it('logs PATH issues when detected', async () => {
    const platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('win32');
    process.env.DEBUG_PYTHON_DISCOVERY = 'true';
    process.env.PATH = 'C:\\Path1;;C:\\Path2';  // Empty entry
    delete process.env.pythonLocation;

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const finder: CommandFinder = {
      find: vi.fn(async () => { throw new CommandNotFoundError('python'); })
    };
    const previousFinder = setDefaultCommandFinder(finder);

    spawnMock.mockImplementation(() => createSpawn({ exitCode: 1, error: new Error('not found') }));

    const loggerMock = { error: vi.fn(), debug: vi.fn() };

    try {
      await expect(findPythonExecutable(undefined, loggerMock, finder)).rejects.toThrow();
      // When Python is not found, verbose discovery logs basic info
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[PYTHON_DISCOVERY_DEBUG]',
        expect.stringContaining('PATH_entries')
      );
    } finally {
      setDefaultCommandFinder(previousFinder);
      platformSpy.mockRestore();
      consoleErrorSpy.mockRestore();
      consoleLogSpy.mockRestore();
    }
  });

  it('logs Python PATH entries when found', async () => {
    const platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('win32');
    process.env.DEBUG_PYTHON_DISCOVERY = 'true';
    process.env.PATH = 'C:\\Python311;C\\Windows;C:\\Python39';
    delete process.env.pythonLocation;

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const finder: CommandFinder = {
      find: vi.fn(async (cmd) => {
        if (cmd === 'py' || cmd === 'python') {
          return 'C:\\Python311\\python.exe';
        }
        throw new CommandNotFoundError(cmd);
      })
    };
    const previousFinder = setDefaultCommandFinder(finder);

    spawnMock.mockImplementation(() => createSpawn({ exitCode: 0, stdout: '1.8.0', error: undefined }));

    const loggerMock = { error: vi.fn(), debug: vi.fn() };

    try {
      await findPythonExecutable(undefined, loggerMock, finder);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[PYTHON_DISCOVERY_DEBUG] Python PATH entries found:'
      );
    } finally {
      setDefaultCommandFinder(previousFinder);
      platformSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    }
  });

  it('logs verbose failure info when discovery fails in CI with DEBUG enabled', async () => {
    const platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
    process.env.DEBUG_PYTHON_DISCOVERY = 'true';
    process.env.CI = 'true';
    process.env.PATH = '/usr/bin';
    delete process.env.pythonLocation;

    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const finder: CommandFinder = {
      find: vi.fn(async () => { throw new CommandNotFoundError('python'); })
    };
    const previousFinder = setDefaultCommandFinder(finder);

    spawnMock.mockImplementation(() => createSpawn({ exitCode: 1, error: new Error('not found') }));

    const loggerMock = { error: vi.fn(), debug: vi.fn() };

    try {
      await expect(findPythonExecutable(undefined, loggerMock, finder)).rejects.toThrow();
      // Verify verbose failure logging
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[PYTHON_DISCOVERY_FAILED]',
        expect.stringContaining('platform')
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[PYTHON_DISCOVERY_FAILED]',
        expect.stringContaining('platform')
      );
    } finally {
      setDefaultCommandFinder(previousFinder);
      platformSpy.mockRestore();
      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    }
  });
});
