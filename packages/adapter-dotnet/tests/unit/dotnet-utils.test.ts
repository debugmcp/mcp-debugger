import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import path from 'node:path';

// Mock child_process before importing the module
vi.mock('child_process', async () => {
  const actual = await vi.importActual<typeof import('child_process')>('child_process');
  return { ...actual, spawn: vi.fn() };
});

// Mock which library
vi.mock('which', () => ({
  default: vi.fn()
}));

// Mock fs — source uses `import fs from 'node:fs'` (default import)
const { existsSyncMock, readdirSyncMock, openSyncMock, readSyncMock, closeSyncMock } = vi.hoisted(() => ({
  existsSyncMock: vi.fn(),
  readdirSyncMock: vi.fn(),
  openSyncMock: vi.fn(),
  readSyncMock: vi.fn(),
  closeSyncMock: vi.fn()
}));
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    __esModule: true,
    ...actual,
    default: {
      ...actual.default,
      existsSync: existsSyncMock,
      readdirSync: readdirSyncMock,
      openSync: openSyncMock,
      readSync: readSyncMock,
      closeSync: closeSyncMock
    },
    existsSync: existsSyncMock,
    readdirSync: readdirSyncMock,
    openSync: openSyncMock,
    readSync: readSyncMock,
    closeSync: closeSyncMock
  };
});

import { spawn } from 'child_process';
import which from 'which';
import {
  findNetcoredbgExecutable,
  findDotnetBackend,
  listDotnetProcesses,
  isPortablePdb,
  findPdb2PdbExecutable,
  CommandNotFoundError
} from '../../src/utils/dotnet-utils.js';

type ChildProcessMock = EventEmitter & {
  stdout: EventEmitter;
  stderr: EventEmitter;
  stdin: EventEmitter;
  kill: () => void;
};

const spawnMock = spawn as unknown as vi.Mock;
const whichMock = which as unknown as vi.Mock;

const createSpawn = (options: { exitCode: number; stdout?: string; stderr?: string; error?: Error }) => {
  const proc = new EventEmitter() as ChildProcessMock;
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.stdin = new EventEmitter();
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

const savedEnv = { ...process.env };

describe('CommandNotFoundError', () => {
  it('creates error with command property', () => {
    const error = new CommandNotFoundError('netcoredbg');
    expect(error.name).toBe('CommandNotFoundError');
    expect(error.command).toBe('netcoredbg');
    expect(error.message).toBe('netcoredbg');
  });

  it('is instance of Error', () => {
    const error = new CommandNotFoundError('netcoredbg');
    expect(error).toBeInstanceOf(Error);
  });
});

describe('findNetcoredbgExecutable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...savedEnv };
    delete process.env.NETCOREDBG_PATH;
  });

  afterEach(() => {
    process.env = savedEnv;
  });

  it('uses NETCOREDBG_PATH environment variable when set and file exists', async () => {
    process.env.NETCOREDBG_PATH = '/custom/netcoredbg';
    existsSyncMock.mockImplementation((p: string) => p === '/custom/netcoredbg');

    const result = await findNetcoredbgExecutable();
    expect(result).toBe('/custom/netcoredbg');
  });

  it('uses preferred path when file exists', async () => {
    existsSyncMock.mockImplementation((p: string) => p === '/preferred/netcoredbg');

    const result = await findNetcoredbgExecutable('/preferred/netcoredbg');
    expect(result).toBe('/preferred/netcoredbg');
  });

  it('finds netcoredbg via which', async () => {
    existsSyncMock.mockReturnValue(false);
    whichMock.mockResolvedValue('/usr/local/bin/netcoredbg');

    const result = await findNetcoredbgExecutable();
    expect(result).toBe('/usr/local/bin/netcoredbg');
  });

  it('throws when netcoredbg is not found anywhere', async () => {
    existsSyncMock.mockReturnValue(false);
    whichMock.mockRejectedValue(new Error('not found'));

    await expect(findNetcoredbgExecutable()).rejects.toThrow('netcoredbg not found');
  });
});

describe('findDotnetBackend', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...savedEnv };
    delete process.env.NETCOREDBG_PATH;
  });

  afterEach(() => {
    process.env = savedEnv;
  });

  it('returns netcoredbg when available', async () => {
    process.env.NETCOREDBG_PATH = '/path/netcoredbg';
    existsSyncMock.mockImplementation((p: string) => p === '/path/netcoredbg');

    const result = await findDotnetBackend();
    expect(result.backend).toBe('netcoredbg');
    expect(result.path).toBe('/path/netcoredbg');
  });

  it('throws when netcoredbg is not found', async () => {
    existsSyncMock.mockReturnValue(false);
    whichMock.mockRejectedValue(new Error('not found'));

    await expect(findDotnetBackend()).rejects.toThrow('netcoredbg not found');
  });
});

describe('listDotnetProcesses', () => {
  const originalPlatform = process.platform;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty array on non-Windows platforms', async () => {
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });

    const result = await listDotnetProcesses();
    expect(result).toEqual([]);

    Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
  });

  it('parses tasklist CSV output on Windows', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });

    spawnMock.mockReturnValue(createSpawn({
      exitCode: 0,
      stdout: [
        '"NinjaTrader.exe","12345","Console","1","500,000 K"',
        '"devenv.exe","67890","Console","1","1,200,000 K"',
        '"notepad.exe","11111","Console","1","10,000 K"',
        ''
      ].join('\n')
    }));

    const result = await listDotnetProcesses();

    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ name: 'NinjaTrader.exe', pid: 12345 });
    expect(result).toContainEqual({ name: 'devenv.exe', pid: 67890 });

    Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
  });

  it('returns empty array when tasklist fails', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });

    spawnMock.mockReturnValue(createSpawn({ exitCode: 1 }));

    const result = await listDotnetProcesses();
    expect(result).toEqual([]);

    Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
  });

  it('returns empty array when tasklist spawn errors', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });

    spawnMock.mockReturnValue(createSpawn({ exitCode: 0, error: new Error('spawn failed') }));

    const result = await listDotnetProcesses();
    expect(result).toEqual([]);

    Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
  });
});

describe('isPortablePdb', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns true for a Portable PDB (BSJB magic)', () => {
    openSyncMock.mockReturnValue(42);
    readSyncMock.mockImplementation((fd: number, buf: Buffer) => {
      buf[0] = 0x42; buf[1] = 0x53; buf[2] = 0x4A; buf[3] = 0x42;
      return 4;
    });
    closeSyncMock.mockReturnValue(undefined);

    expect(isPortablePdb('/some/file.pdb')).toBe(true);
    expect(closeSyncMock).toHaveBeenCalledWith(42);
  });

  it('returns false for a Windows-format PDB', () => {
    openSyncMock.mockReturnValue(42);
    readSyncMock.mockImplementation((fd: number, buf: Buffer) => {
      buf[0] = 0x4D; buf[1] = 0x69; buf[2] = 0x63; buf[3] = 0x72;
      return 4;
    });
    closeSyncMock.mockReturnValue(undefined);

    expect(isPortablePdb('/some/windows.pdb')).toBe(false);
  });

  it('returns false when file cannot be opened', () => {
    openSyncMock.mockImplementation(() => { throw new Error('ENOENT'); });

    expect(isPortablePdb('/nonexistent.pdb')).toBe(false);
  });

  it('returns false when fewer than 4 bytes can be read', () => {
    openSyncMock.mockReturnValue(42);
    readSyncMock.mockReturnValue(2);
    closeSyncMock.mockReturnValue(undefined);

    expect(isPortablePdb('/tiny.pdb')).toBe(false);
  });
});

describe('findPdb2PdbExecutable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...savedEnv };
    delete process.env.PDB2PDB_PATH;
  });

  afterEach(() => {
    process.env = savedEnv;
  });

  it('uses PDB2PDB_PATH environment variable when set and file exists', () => {
    process.env.PDB2PDB_PATH = '/custom/Pdb2Pdb.exe';
    existsSyncMock.mockImplementation((p: string) => p === '/custom/Pdb2Pdb.exe');

    const result = findPdb2PdbExecutable();
    expect(result).toBe('/custom/Pdb2Pdb.exe');
  });

  it('falls through when PDB2PDB_PATH is set but file does not exist', () => {
    process.env.PDB2PDB_PATH = '/nonexistent/Pdb2Pdb.exe';
    existsSyncMock.mockReturnValue(false);

    const result = findPdb2PdbExecutable();
    expect(result).toBeNull();
  });

  it('returns null when Pdb2Pdb.exe is not found anywhere', () => {
    existsSyncMock.mockReturnValue(false);

    const result = findPdb2PdbExecutable();
    expect(result).toBeNull();
  });

  it('finds fallback at /tmp/pdb2pdb-tool/Pdb2Pdb.exe', () => {
    existsSyncMock.mockImplementation((p: string) => p === '/tmp/pdb2pdb-tool/Pdb2Pdb.exe');

    const result = findPdb2PdbExecutable();
    expect(result).toBe('/tmp/pdb2pdb-tool/Pdb2Pdb.exe');
  });
});
