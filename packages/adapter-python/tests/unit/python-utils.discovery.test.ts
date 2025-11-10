import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { EventEmitter } from 'node:events';

vi.mock('child_process', async () => {
  const actual = await vi.importActual<typeof import('child_process')>('child_process');
  const spawn = vi.fn();
  return { ...actual, spawn };
});

import { spawn } from 'child_process';
import {
  findPythonExecutable,
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

const createSpawn = (options: { exitCode: number; stdout?: string; stderr?: string }) => {
  const proc = new EventEmitter() as ChildProcessMock;
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.kill = vi.fn();

  setImmediate(() => {
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

describe('python-utils discovery behaviour', () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    spawnMock.mockReset();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('auto-detects python from PATH on non-Windows when debugpy present', async () => {
    const platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
    process.env.DEBUG_PYTHON_DISCOVERY = 'false';

    const finder: CommandFinder = {
      find: vi.fn(async (cmd) => {
        if (cmd === 'python3') return `/usr/bin/${cmd}`;
        if (cmd === 'python') return `/usr/local/bin/${cmd}`;
        throw new CommandNotFoundError(cmd);
      }),
    };

    const previousFinder = setDefaultCommandFinder(finder);
    const loggerMock = { error: vi.fn(), debug: vi.fn() };

    spawnMock.mockImplementation(() => createSpawn({ exitCode: 0, stdout: '1.8.17' }));

    try {
      const result = await findPythonExecutable(undefined, loggerMock);
      expect(result).toBe('/usr/bin/python3');
      expect(finder.find).toHaveBeenCalledWith('python3');
      expect(spawnMock).toHaveBeenCalled();
    } finally {
      setDefaultCommandFinder(previousFinder);
      platformSpy.mockRestore();
    }
  });

  it('prefers pythonLocation when available on Windows', async () => {
    const platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('win32');
    const pythonRoot = 'C:\\HostedPython\\3.11.9\\x64';
    process.env.pythonLocation = pythonRoot;
    process.env.DEBUG_PYTHON_DISCOVERY = 'false';

    const fsExists = vi
      .spyOn(fs, 'existsSync')
      .mockImplementation((candidate: fs.PathLike) =>
        typeof candidate === 'string' && candidate.startsWith(pythonRoot)
      );

    spawnMock.mockImplementation((_cmd: string, args?: readonly string[]) => {
      if (args && args.includes('debugpy')) {
        return createSpawn({ exitCode: 0, stdout: '1.8.17' });
      }
      return createSpawn({ exitCode: 0 });
    });

    const finder: CommandFinder = {
      find: vi.fn(async (cmd) => {
        throw new CommandNotFoundError(cmd);
      }),
    };
    const previousFinder = setDefaultCommandFinder(finder);
    const loggerMock = { error: vi.fn(), debug: vi.fn() };

    try {
      const result = await findPythonExecutable(undefined, loggerMock);
      expect(result).toBe(path.join(pythonRoot, 'python.exe'));
      expect(spawnMock).toHaveBeenCalledWith(
        expect.stringContaining('python.exe'),
        expect.arrayContaining(['-c', 'import sys; sys.exit(0)']),
        expect.any(Object)
      );
    } finally {
      setDefaultCommandFinder(previousFinder);
      fsExists.mockRestore();
      platformSpy.mockRestore();
    }
  });

  it('uses PYTHON_PATH environment variable when provided', async () => {
    const platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('win32');
    process.env.PYTHON_PATH = 'C:\\CustomPython\\python.exe';
    delete process.env.pythonLocation;

    const fsExists = vi
      .spyOn(fs, 'existsSync')
      .mockImplementation((candidate: fs.PathLike) =>
        typeof candidate === 'string' && candidate.includes('CustomPython')
      );

    spawnMock.mockImplementation((_cmd: string, args?: readonly string[]) => {
      if (args && args.includes('debugpy')) {
        return createSpawn({ exitCode: 0, stdout: '1.9.0' });
      }
      return createSpawn({ exitCode: 0 });
    });

    const finder: CommandFinder = {
      find: vi.fn(async (cmd) => {
        if (cmd === process.env.PYTHON_PATH) {
          return cmd;
        }
        throw new CommandNotFoundError(cmd);
      }),
    };
    const previousFinder = setDefaultCommandFinder(finder);
    const loggerMock = { error: vi.fn(), debug: vi.fn() };

    try {
      const result = await findPythonExecutable(undefined, loggerMock);
      expect(result).toBe(process.env.PYTHON_PATH);
      expect(finder.find).toHaveBeenCalledWith(process.env.PYTHON_PATH);
    } finally {
      setDefaultCommandFinder(previousFinder);
      fsExists.mockRestore();
      platformSpy.mockRestore();
    }
  });

  it('reports discovery failure details through logger', async () => {
    const platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('win32');
    delete process.env.pythonLocation;
    delete process.env.PYTHON_PATH;
    process.env.PATH = '';

    const fsExists = vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    process.env.CI = 'true';
    spawnMock.mockImplementation(() => createSpawn({ exitCode: 1, stderr: 'missing python' }));

    const finder: CommandFinder = {
      find: vi.fn(async () => {
        throw new CommandNotFoundError('python');
      }),
    };
    const previousFinder = setDefaultCommandFinder(finder);
    const loggerMock = { error: vi.fn(), debug: vi.fn() };

    try {
      await expect(findPythonExecutable(undefined, loggerMock)).rejects.toThrow('Python not found');
      expect(loggerMock.error).toHaveBeenCalledWith(
        expect.stringContaining('[PYTHON_DISCOVERY_FAILED]')
      );
    } finally {
      setDefaultCommandFinder(previousFinder);
      fsExists.mockRestore();
      platformSpy.mockRestore();
    }
  });

  it('falls back to first valid python when debugpy is missing', async () => {
    const platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
    process.env.DEBUG_PYTHON_DISCOVERY = 'false';

    const finder: CommandFinder = {
      find: vi.fn(async (cmd) => {
        if (cmd === 'python3') return `/usr/bin/${cmd}`;
        if (cmd === 'python') return `/usr/local/bin/${cmd}`;
        throw new CommandNotFoundError(cmd);
      }),
    };
    const previousFinder = setDefaultCommandFinder(finder);
    const loggerMock = { error: vi.fn(), debug: vi.fn() };

    spawnMock
      .mockImplementationOnce(() => createSpawn({ exitCode: 1, stderr: 'ModuleNotFoundError: debugpy' }))
      .mockImplementationOnce(() => createSpawn({ exitCode: 1, stderr: 'ModuleNotFoundError: debugpy' }));

    try {
      const result = await findPythonExecutable(undefined, loggerMock);
      expect(result).toBe('/usr/bin/python3');
      expect(spawnMock).toHaveBeenCalledTimes(2);
    } finally {
      setDefaultCommandFinder(previousFinder);
      platformSpy.mockRestore();
    }
  });
});
