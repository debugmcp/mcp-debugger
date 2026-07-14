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
  resetDefaultCommandFinder,
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

// `defaultCommandFinder` is a module-global. Several tests below swap in a custom
// or deliberately-throwing finder, and the real WhichCommandFinder also carries an
// internal resolution CACHE. Either leaking the finder or leaving cached lookups
// breaks sibling tests that rely on the default finder — invisible in source order,
// but exposed once `sequence.shuffle` randomizes test order. Reset to a fresh
// production finder (empty cache) after EVERY test so no state crosses boundaries.
afterEach(() => {
  resetDefaultCommandFinder();
});

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
    spawnMock.mockReset();
    whichMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Windows platform behavior', () => {
    it('handles Path to PATH conversion on Windows', async () => {
      // NOTE: process.env is case-insensitive on Windows, so PATH and Path alias the
      // same key. Stub PATH (undefined) FIRST, then Path, so the Path value survives on
      // Windows; on case-sensitive platforms PATH stays unset and the code copies Path→PATH.
      vi.stubEnv('PATH', undefined);
      vi.stubEnv('Path', 'C:\\Windows\\System32;C:\\Python311');
      vi.stubEnv('DEBUG_PYTHON_DISCOVERY', 'false');
      vi.stubEnv('pythonLocation', undefined);
      vi.stubEnv('PythonLocation', undefined);

      whichMock.mockResolvedValue(['C:\\Python311\\python.exe']);
      spawnMock.mockImplementation(() => createSpawn({ exitCode: 0, stdout: '1.8.0' }));

      const loggerMock = { error: vi.fn(), debug: vi.fn() };

      await findPythonExecutable(undefined, loggerMock, undefined, 'win32');
      expect(process.env.PATH).toBeDefined();
    });

    it('filters Windows Store aliases', async () => {
      vi.stubEnv('DEBUG_PYTHON_DISCOVERY', 'false');
      vi.stubEnv('pythonLocation', undefined);
      vi.stubEnv('PythonLocation', undefined);

      // Mock which to return Windows Store alias first, then real Python
      whichMock.mockResolvedValueOnce([
        'C:\\Users\\test\\AppData\\Local\\Microsoft\\WindowsApps\\python.exe',
        'C:\\Python311\\python.exe'
      ]);

      spawnMock.mockImplementation(() => createSpawn({ exitCode: 0, stdout: '1.8.0' }));

      const loggerMock = { error: vi.fn(), debug: vi.fn() };

      const result = await findPythonExecutable(undefined, loggerMock, undefined, 'win32');
      expect(result).toBe('C:\\Python311\\python.exe');
    });

    it('handles .exe extension on Windows', async () => {
      vi.stubEnv('DEBUG_PYTHON_DISCOVERY', 'false');
      vi.stubEnv('pythonLocation', undefined);

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
        const result = await findPythonExecutable(undefined, loggerMock, finder, 'win32');
        expect(result).toBe('C:\\Python311\\python.exe');
        expect(finder.find).toHaveBeenCalled();
      } finally {
        setDefaultCommandFinder(previousFinder);
      }
    });

    it('logs verbose discovery information when DEBUG_PYTHON_DISCOVERY=true', async () => {
      vi.stubEnv('DEBUG_PYTHON_DISCOVERY', 'true');
      vi.stubEnv('PATH', 'C:\\Python311;C:\\Windows');
      vi.stubEnv('pythonLocation', undefined);
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const finder: CommandFinder = {
        find: vi.fn(async () => { throw new CommandNotFoundError('python'); })
      };
      const previousFinder = setDefaultCommandFinder(finder);

      spawnMock.mockImplementation(() => createSpawn({ exitCode: 1, error: new Error('not found') }));

      const loggerMock = { error: vi.fn(), debug: vi.fn() };

      try {
        await expect(findPythonExecutable(undefined, loggerMock, finder, 'win32')).rejects.toThrow();
        // Verbose discovery logs to console.log and console.error with [PYTHON_DISCOVERY_DEBUG]
        expect(consoleLogSpy).toHaveBeenCalledWith(
          '[PYTHON_DISCOVERY_DEBUG]',
          expect.stringContaining('platform')
        );
      } finally {
        setDefaultCommandFinder(previousFinder);
        consoleErrorSpy.mockRestore();
        consoleLogSpy.mockRestore();
      }
    });

    it('detects Windows Store alias by stderr content', async () => {
      vi.stubEnv('DEBUG_PYTHON_DISCOVERY', 'false');
      vi.stubEnv('pythonLocation', undefined);

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
        await expect(findPythonExecutable(undefined, loggerMock, finder, 'win32')).rejects.toThrow('Python not found');
      } finally {
        setDefaultCommandFinder(previousFinder);
      }
    });
  });

  describe('Environment variable handling', () => {
    it('uses PYTHON_EXECUTABLE environment variable', async () => {
      vi.stubEnv('PYTHON_EXECUTABLE', '/opt/python/bin/python3');
      vi.stubEnv('PYTHON_PATH', undefined);
      vi.stubEnv('DEBUG_PYTHON_DISCOVERY', 'false');

      whichMock.mockResolvedValue([process.env.PYTHON_EXECUTABLE]);
      spawnMock.mockImplementation(() => createSpawn({ exitCode: 0, stdout: '1.8.0' }));

      const loggerMock = { error: vi.fn(), debug: vi.fn() };

      const result = await findPythonExecutable(undefined, loggerMock, undefined, 'linux');
      expect(result).toBe('/opt/python/bin/python3');
    });

    it('uses PythonLocation (uppercase) environment variable on Windows', async () => {
      const pythonRoot = 'C:\\PythonLocation\\3.11.9';
      // NOTE: process.env is case-insensitive on Windows, so pythonLocation and
      // PythonLocation alias the same key. Stub the lowercase variant (undefined) FIRST,
      // then the uppercase value, so PythonLocation survives on Windows; on case-sensitive
      // platforms the lowercase stays unset and the code falls through to PythonLocation.
      vi.stubEnv('pythonLocation', undefined);
      vi.stubEnv('PythonLocation', pythonRoot);
      vi.stubEnv('PYTHON_PATH', undefined);
      vi.stubEnv('DEBUG_PYTHON_DISCOVERY', 'false');

      const fsExists = vi
        .spyOn(fs, 'existsSync')
        .mockImplementation((candidate: fs.PathLike) =>
          typeof candidate === 'string' && candidate.startsWith(pythonRoot)
        );

      spawnMock.mockImplementation(() => createSpawn({ exitCode: 0, stdout: '1.8.0' }));

      const loggerMock = { error: vi.fn(), debug: vi.fn() };

      try {
        const result = await findPythonExecutable(undefined, loggerMock, undefined, 'win32');
        expect(result).toBe(path.join(pythonRoot, 'python.exe'));
      } finally {
        setDefaultCommandFinder({ find: async () => { throw new CommandNotFoundError(''); } });
        fsExists.mockRestore();
      }
    });

    it('uses pythonLocation on non-Windows with bin subdirectory', async () => {
      const pythonRoot = '/opt/python/3.11.9';
      vi.stubEnv('pythonLocation', pythonRoot);
      vi.stubEnv('PYTHON_PATH', undefined);
      vi.stubEnv('DEBUG_PYTHON_DISCOVERY', 'false');

      const fsExists = vi
        .spyOn(fs, 'existsSync')
        .mockImplementation((candidate: fs.PathLike) => {
          const str = typeof candidate === 'string' ? candidate : candidate.toString();
          return str === path.join(pythonRoot, 'bin', 'python3');
        });

      spawnMock.mockImplementation(() => createSpawn({ exitCode: 0, stdout: '1.8.0' }));

      const loggerMock = { error: vi.fn(), debug: vi.fn() };

      try {
        const result = await findPythonExecutable(undefined, loggerMock, undefined, 'linux');
        expect(result).toBe(path.join(pythonRoot, 'bin', 'python3'));
      } finally {
        setDefaultCommandFinder({ find: async () => { throw new CommandNotFoundError(''); } });
        fsExists.mockRestore();
      }
    });
  });

  describe('preferredPath parameter', () => {
    it('returns preferredPath immediately when valid on non-Windows', async () => {
      vi.stubEnv('DEBUG_PYTHON_DISCOVERY', 'false');

      const finder: CommandFinder = {
        find: vi.fn(async (cmd) => `/custom/path/${cmd}`)
      };
      const previousFinder = setDefaultCommandFinder(finder);

      spawnMock.mockImplementation(() => createSpawn({ exitCode: 0 }));

      const loggerMock = { error: vi.fn(), debug: vi.fn() };

      try {
        const result = await findPythonExecutable('my-python', loggerMock, finder, 'linux');
        expect(result).toBe('/custom/path/my-python');
        expect(finder.find).toHaveBeenCalledWith('my-python', 'linux');
      } finally {
        setDefaultCommandFinder(previousFinder);
      }
    });

    it('skips invalid preferredPath and continues discovery', async () => {
      vi.stubEnv('DEBUG_PYTHON_DISCOVERY', 'false');
      vi.stubEnv('pythonLocation', undefined);
      vi.stubEnv('PythonLocation', undefined);

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
        const result = await findPythonExecutable('invalid-python', loggerMock, finder, 'linux');
        expect(result).toBe('/usr/bin/python3');
      } finally {
        setDefaultCommandFinder(previousFinder);
      }
    });

    it('throws error when preferredPath finder throws non-CommandNotFoundError', async () => {
      vi.stubEnv('DEBUG_PYTHON_DISCOVERY', 'false');

      const customError = new Error('Permission denied');
      const finder: CommandFinder = {
        find: vi.fn(async () => { throw customError; })
      };
      const previousFinder = setDefaultCommandFinder(finder);

      const loggerMock = { error: vi.fn(), debug: vi.fn() };

      try {
        await expect(findPythonExecutable('python', loggerMock, finder, 'linux')).rejects.toThrow('Permission denied');
      } finally {
        setDefaultCommandFinder(previousFinder);
      }
    });
  });

  describe('Multiple Python installations with debugpy preference', () => {
    it('prefers Python with debugpy installed', async () => {
      vi.stubEnv('DEBUG_PYTHON_DISCOVERY', 'false');
      vi.stubEnv('pythonLocation', undefined);

      let callCount = 0;
      const finder: CommandFinder = {
        find: vi.fn(async (cmd) => {
          if (cmd === 'python3') return '/usr/bin/python3';
          if (cmd === 'python') return '/usr/local/bin/python';
          throw new CommandNotFoundError(cmd);
        })
      };
      const previousFinder = setDefaultCommandFinder(finder);

      // First debugpy check fails (no debugpy), second debugpy check succeeds
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
        const result = await findPythonExecutable(undefined, loggerMock, finder, 'linux');
        expect(result).toBe('/usr/local/bin/python');
        expect(loggerMock.debug).toHaveBeenCalledWith(expect.stringContaining('Found Python with debugpy'));
      } finally {
        setDefaultCommandFinder(previousFinder);
      }
    });

    it('returns first valid Python when none have debugpy', async () => {
      vi.stubEnv('DEBUG_PYTHON_DISCOVERY', 'false');
      vi.stubEnv('pythonLocation', undefined);

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
        const result = await findPythonExecutable(undefined, loggerMock, finder, 'linux');
        expect(result).toBe('/usr/bin/python3');
        expect(loggerMock.debug).toHaveBeenCalledWith(expect.stringContaining('debugpy will need to be installed'));
      } finally {
        setDefaultCommandFinder(previousFinder);
      }
    });
  });

  describe('Error scenarios', () => {
    it('throws error with tried paths when no Python found', async () => {
      vi.stubEnv('DEBUG_PYTHON_DISCOVERY', 'false');
      vi.stubEnv('PYTHON_PATH', undefined);
      vi.stubEnv('pythonLocation', undefined);

      whichMock.mockRejectedValue(new Error('not found'));

      const loggerMock = { error: vi.fn(), debug: vi.fn() };

      await expect(findPythonExecutable(undefined, loggerMock, undefined, 'linux')).rejects.toThrow(/Python not found.*Tried:/s);
    });

    it('logs detailed failure info in CI environment', async () => {
      vi.stubEnv('DEBUG_PYTHON_DISCOVERY', 'false');
      vi.stubEnv('CI', 'true');
      vi.stubEnv('pythonLocation', undefined);

      whichMock.mockRejectedValue(new Error('not found'));

      const loggerMock = { error: vi.fn(), debug: vi.fn() };

      await expect(findPythonExecutable(undefined, loggerMock, undefined, 'linux')).rejects.toThrow();
      expect(loggerMock.error).toHaveBeenCalledWith(
        expect.stringContaining('[PYTHON_DISCOVERY_FAILED]')
      );
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

  it('sanitizes the fallback output when the version regex misses', async () => {
    spawnMock.mockImplementation(() =>
      createSpawn({ exitCode: 0, stdout: 'AUTH_TOKEN: ghp_0123456789abcdefghij0123456789' })
    );

    const version = await getPythonVersion('/usr/bin/python3');
    expect(version).toBe('[REDACTED — line contained sensitive data]');
  });

  it('returns only the first line of multi-line fallback output', async () => {
    spawnMock.mockImplementation(() =>
      createSpawn({ exitCode: 0, stdout: 'Custom Python Build\ndebug noise line' })
    );

    const version = await getPythonVersion('/usr/bin/python3');
    expect(version).toBe('Custom Python Build');
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
    spawnMock.mockReset();
    whichMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('handles spawn error when checking debugpy', async () => {
    vi.stubEnv('DEBUG_PYTHON_DISCOVERY', 'false');
    vi.stubEnv('pythonLocation', undefined);

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
      const result = await findPythonExecutable(undefined, loggerMock, finder, 'linux');
      // Should still return first valid Python even when debugpy check errors
      expect(result).toBe('/usr/bin/python3');
    } finally {
      setDefaultCommandFinder(previousFinder);
    }
  });

  it('logs debug messages during Python discovery', async () => {
    vi.stubEnv('DEBUG_PYTHON_DISCOVERY', 'false');
    vi.stubEnv('pythonLocation', undefined);

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
      await findPythonExecutable(undefined, loggerMock, finder, 'linux');
      expect(loggerMock.debug).toHaveBeenCalledWith(expect.stringContaining('[Python Detection]'));
    } finally {
      setDefaultCommandFinder(previousFinder);
    }
  });

  it('handles Windows Store alias detected by AppData path in stderr', async () => {
    vi.stubEnv('DEBUG_PYTHON_DISCOVERY', 'false');
    vi.stubEnv('pythonLocation', undefined);

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
      await expect(findPythonExecutable(undefined, loggerMock, finder, 'win32')).rejects.toThrow('Python not found');
      expect(loggerMock.error).toHaveBeenCalledWith(expect.stringContaining('Windows Store alias'));
    } finally {
      setDefaultCommandFinder(previousFinder);
    }
  });

  it('handles errors other than CommandNotFoundError in environment variable lookup', async () => {
    vi.stubEnv('PYTHON_EXECUTABLE', '/invalid/python');
    vi.stubEnv('DEBUG_PYTHON_DISCOVERY', 'false');

    const customError = new TypeError('Invalid path');
    const finder: CommandFinder = {
      find: vi.fn(async () => { throw customError; })
    };
    const previousFinder = setDefaultCommandFinder(finder);

    const loggerMock = { error: vi.fn(), debug: vi.fn() };

    try {
      await expect(findPythonExecutable(undefined, loggerMock, finder, 'linux')).rejects.toThrow('Invalid path');
    } finally {
      setDefaultCommandFinder(previousFinder);
    }
  });

  it('checks all pythonLocation candidates on non-Windows', async () => {
    const pythonRoot = '/opt/python/3.11.9';
    vi.stubEnv('pythonLocation', pythonRoot);
    vi.stubEnv('PYTHON_PATH', undefined);
    vi.stubEnv('DEBUG_PYTHON_DISCOVERY', 'false');

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
      const result = await findPythonExecutable(undefined, loggerMock, undefined, 'linux');
      expect(result).toBe(path.join(pythonRoot, 'python'));
    } finally {
      setDefaultCommandFinder({ find: async () => { throw new CommandNotFoundError(''); } });
      fsExists.mockRestore();
    }
  });

  it('continues to next pythonLocation candidate when validation fails', async () => {
    const pythonRoot = 'C:\\Python311';
    vi.stubEnv('pythonLocation', pythonRoot);
    vi.stubEnv('PYTHON_PATH', undefined);
    vi.stubEnv('DEBUG_PYTHON_DISCOVERY', 'false');

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
      const result = await findPythonExecutable(undefined, loggerMock, undefined, 'win32');
      expect(result).toBe(path.join(pythonRoot, 'python'));
    } finally {
      setDefaultCommandFinder({ find: async () => { throw new CommandNotFoundError(''); } });
      fsExists.mockRestore();
    }
  });
});

describe('Additional edge cases', () => {
  beforeEach(() => {
    spawnMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('handles errors during auto-detect loop', async () => {
    vi.stubEnv('DEBUG_PYTHON_DISCOVERY', 'false');
    vi.stubEnv('pythonLocation', undefined);
    vi.stubEnv('PYTHON_PATH', undefined);

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
      await expect(findPythonExecutable(undefined, loggerMock, finder, 'linux')).rejects.toThrow();
    } finally {
      setDefaultCommandFinder(previousFinder);
    }
  });

  it('handles Windows Store alias detected by "Windows Store" in stderr', async () => {
    vi.stubEnv('DEBUG_PYTHON_DISCOVERY', 'false');
    vi.stubEnv('pythonLocation', undefined);

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
      await expect(findPythonExecutable(undefined, loggerMock, finder, 'win32')).rejects.toThrow();
    } finally {
      setDefaultCommandFinder(previousFinder);
    }
  });

  it('validates Python executable on Windows before returning', async () => {
    vi.stubEnv('DEBUG_PYTHON_DISCOVERY', 'false');
    vi.stubEnv('PYTHON_PATH', 'C:\\Python\\python.exe');

    const finder: CommandFinder = {
      find: vi.fn(async () => 'C:\\Python\\python.exe')
    };
    const previousFinder = setDefaultCommandFinder(finder);

    spawnMock.mockImplementation(() => createSpawn({ exitCode: 0, stdout: '1.8.0', error: undefined }));

    const loggerMock = { error: vi.fn(), debug: vi.fn() };

    try {
      const result = await findPythonExecutable(undefined, loggerMock, finder, 'win32');
      expect(result).toBe('C:\\Python\\python.exe');
      // Verify validation was called
      expect(spawnMock).toHaveBeenCalled();
    } finally {
      setDefaultCommandFinder(previousFinder);
    }
  });

  it('checks multiple pythonLocation candidates when first does not exist', async () => {
    const pythonRoot = 'C:\\Python311';
    vi.stubEnv('pythonLocation', pythonRoot);
    vi.stubEnv('PYTHON_PATH', undefined);
    vi.stubEnv('DEBUG_PYTHON_DISCOVERY', 'false');

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
      const result = await findPythonExecutable(undefined, loggerMock, undefined, 'win32');
      expect(result).toBe(path.join(pythonRoot, 'python'));
      expect(fsExists).toHaveBeenCalled();
    } finally {
      setDefaultCommandFinder({ find: async () => { throw new CommandNotFoundError(''); } });
      fsExists.mockRestore();
    }
  });

  it('returns first valid Python when collecting multiple candidates', async () => {
    vi.stubEnv('DEBUG_PYTHON_DISCOVERY', 'false');
    vi.stubEnv('pythonLocation', undefined);
    vi.stubEnv('PYTHON_PATH', undefined);

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
      const result = await findPythonExecutable(undefined, loggerMock, finder, 'linux');
      expect(result).toBe('/usr/bin/python3');
      expect(loggerMock.debug).toHaveBeenCalledWith(expect.stringContaining('debugpy will need to be installed'));
    } finally {
      setDefaultCommandFinder(previousFinder);
    }
  });
});

describe('Verbose discovery logging', () => {
  beforeEach(() => {
    spawnMock.mockReset();
    whichMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs verbose discovery info when DEBUG_PYTHON_DISCOVERY=true on Windows', async () => {
    vi.stubEnv('DEBUG_PYTHON_DISCOVERY', 'true');
    vi.stubEnv('CI', 'true');
    vi.stubEnv('GITHUB_ACTIONS', 'true');
    vi.stubEnv('PATH', 'C:\\Python311;C:\\Windows\\System32');
    vi.stubEnv('pythonLocation', undefined);

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
      await findPythonExecutable(undefined, loggerMock, finder, 'win32');
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
      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    }
  });

  it('logs PATH issues when detected', async () => {
    vi.stubEnv('DEBUG_PYTHON_DISCOVERY', 'true');
    vi.stubEnv('PATH', 'C:\\Path1;;C:\\Path2');  // Empty entry
    vi.stubEnv('pythonLocation', undefined);

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const finder: CommandFinder = {
      find: vi.fn(async () => { throw new CommandNotFoundError('python'); })
    };
    const previousFinder = setDefaultCommandFinder(finder);

    spawnMock.mockImplementation(() => createSpawn({ exitCode: 1, error: new Error('not found') }));

    const loggerMock = { error: vi.fn(), debug: vi.fn() };

    try {
      await expect(findPythonExecutable(undefined, loggerMock, finder, 'win32')).rejects.toThrow();
      // When Python is not found, verbose discovery logs basic info
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[PYTHON_DISCOVERY_DEBUG]',
        expect.stringContaining('PATH_entries')
      );
    } finally {
      setDefaultCommandFinder(previousFinder);
      consoleErrorSpy.mockRestore();
      consoleLogSpy.mockRestore();
    }
  });

  it('logs Python PATH entries when found', async () => {
    vi.stubEnv('DEBUG_PYTHON_DISCOVERY', 'true');
    vi.stubEnv('PATH', 'C:\\Python311;C\\Windows;C:\\Python39');
    vi.stubEnv('pythonLocation', undefined);

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
      await findPythonExecutable(undefined, loggerMock, finder, 'win32');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[PYTHON_DISCOVERY_DEBUG] Python PATH entries found:'
      );
    } finally {
      setDefaultCommandFinder(previousFinder);
      consoleErrorSpy.mockRestore();
    }
  });

  it('logs verbose failure info when discovery fails in CI with DEBUG enabled', async () => {
    vi.stubEnv('DEBUG_PYTHON_DISCOVERY', 'true');
    vi.stubEnv('CI', 'true');
    vi.stubEnv('PATH', '/usr/bin');
    vi.stubEnv('pythonLocation', undefined);

    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const finder: CommandFinder = {
      find: vi.fn(async () => { throw new CommandNotFoundError('python'); })
    };
    const previousFinder = setDefaultCommandFinder(finder);

    spawnMock.mockImplementation(() => createSpawn({ exitCode: 1, error: new Error('not found') }));

    const loggerMock = { error: vi.fn(), debug: vi.fn() };

    try {
      await expect(findPythonExecutable(undefined, loggerMock, finder, 'linux')).rejects.toThrow();
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
      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    }
  });
});
