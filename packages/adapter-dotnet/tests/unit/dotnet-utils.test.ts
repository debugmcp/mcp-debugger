import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'node:events';

// Mock child_process before importing the module
vi.mock('child_process', async () => {
  const actual = await vi.importActual<typeof import('child_process')>('child_process');
  return { ...actual, spawn: vi.fn(), spawnSync: vi.fn() };
});

// Mock which library
vi.mock('which', () => ({
  default: vi.fn()
}));

// Mock fs — source uses `import fs from 'node:fs'` (default import)
const { existsSyncMock, readdirSyncMock, openSyncMock, readSyncMock, closeSyncMock, mkdirSyncMock, copyFileSyncMock, renameSyncMock } = vi.hoisted(() => ({
  existsSyncMock: vi.fn(),
  readdirSyncMock: vi.fn(),
  openSyncMock: vi.fn(),
  readSyncMock: vi.fn(),
  closeSyncMock: vi.fn(),
  mkdirSyncMock: vi.fn(),
  copyFileSyncMock: vi.fn(),
  renameSyncMock: vi.fn()
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
      closeSync: closeSyncMock,
      mkdirSync: mkdirSyncMock,
      copyFileSync: copyFileSyncMock,
      renameSync: renameSyncMock
    },
    existsSync: existsSyncMock,
    readdirSync: readdirSyncMock,
    openSync: openSyncMock,
    readSync: readSyncMock,
    closeSync: closeSyncMock,
    mkdirSync: mkdirSyncMock,
    copyFileSync: copyFileSyncMock,
    renameSync: renameSyncMock
  };
});

import { spawn, spawnSync } from 'child_process';
import which from 'which';
import {
  findNetcoredbgExecutable,
  findDotnetBackend,
  listDotnetProcesses,
  isPortablePdb,
  findPdb2PdbExecutable,
  convertPdbsToTemp,
  getExeArchitecture,
  getProcessArchitecture,
  getProcessExecutablePath,
  CommandNotFoundError
} from '../../src/utils/dotnet-utils.js';

type ChildProcessMock = EventEmitter & {
  stdout: EventEmitter;
  stderr: EventEmitter;
  stdin: EventEmitter;
  kill: () => void;
};

const spawnMock = spawn as unknown as vi.Mock;
const spawnSyncMock = spawnSync as unknown as vi.Mock;
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

describe('findNetcoredbgExecutable (additional coverage)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...savedEnv };
    delete process.env.NETCOREDBG_PATH;
  });

  afterEach(() => {
    process.env = savedEnv;
  });

  it('falls through when NETCOREDBG_PATH is set but file does not exist', async () => {
    process.env.NETCOREDBG_PATH = '/nonexistent/netcoredbg';
    existsSyncMock.mockReturnValue(false);
    whichMock.mockRejectedValue(new Error('not found'));

    await expect(findNetcoredbgExecutable()).rejects.toThrow('netcoredbg not found');
  });

  it('falls through preferred path when file does not exist', async () => {
    existsSyncMock.mockReturnValue(false);
    whichMock.mockRejectedValue(new Error('not found'));

    await expect(findNetcoredbgExecutable('/missing/netcoredbg')).rejects.toThrow('netcoredbg not found');
  });

  it('finds netcoredbg in common install location', async () => {
    const commonPath = process.platform === 'win32'
      ? 'C:\\netcoredbg\\netcoredbg.exe'
      : '/usr/local/bin/netcoredbg';

    existsSyncMock.mockImplementation((p: string) => p === commonPath);
    whichMock.mockRejectedValue(new Error('not found'));

    const result = await findNetcoredbgExecutable();
    expect(result).toBe(commonPath);
  });

  it('throws CommandNotFoundError when not found anywhere', async () => {
    existsSyncMock.mockReturnValue(false);
    whichMock.mockRejectedValue(new Error('not found'));

    await expect(findNetcoredbgExecutable()).rejects.toBeInstanceOf(CommandNotFoundError);
  });

  it('calls logger.debug when available', async () => {
    const logger = { error: vi.fn(), debug: vi.fn() };
    process.env.NETCOREDBG_PATH = '/found/netcoredbg';
    existsSyncMock.mockImplementation((p: string) => p === '/found/netcoredbg');

    await findNetcoredbgExecutable(undefined, logger);
    expect(logger.debug).toHaveBeenCalled();
  });
});

describe('listDotnetProcesses (additional coverage)', () => {
  const originalPlatform = process.platform;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
  });

  it('skips malformed CSV lines', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });

    spawnMock.mockReturnValue(createSpawn({
      exitCode: 0,
      stdout: [
        'this is not csv',
        '"NinjaTrader.exe","12345","Console","1","500,000 K"',
        'another bad line',
        ''
      ].join('\n')
    }));

    const result = await listDotnetProcesses();
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ name: 'NinjaTrader.exe', pid: 12345 });
  });

  it('returns empty array for empty output', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });

    spawnMock.mockReturnValue(createSpawn({ exitCode: 0, stdout: '' }));

    const result = await listDotnetProcesses();
    expect(result).toEqual([]);
  });

  it('recognizes all known .NET processes', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });

    spawnMock.mockReturnValue(createSpawn({
      exitCode: 0,
      stdout: [
        '"NinjaTrader.exe","1001","Console","1","100 K"',
        '"devenv.exe","1002","Console","1","100 K"',
        '"dotnet.exe","1003","Console","1","100 K"',
        '"w3wp.exe","1004","Console","1","100 K"',
        '"iisexpress.exe","1005","Console","1","100 K"',
        ''
      ].join('\n')
    }));

    const result = await listDotnetProcesses();
    expect(result).toHaveLength(5);
  });
});

describe('convertPdbsToTemp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when no source directories exist', () => {
    existsSyncMock.mockReturnValue(false);

    const result = convertPdbsToTemp(['/nonexistent/dir'], '/path/to/Pdb2Pdb.exe');
    expect(result).toBeNull();
  });

  it('returns null when directory has no PDB files', () => {
    existsSyncMock.mockImplementation((p: string) => p === '/src/dir');
    readdirSyncMock.mockReturnValue(['file.cs', 'file.dll', 'readme.txt']);

    const result = convertPdbsToTemp(['/src/dir'], '/path/to/Pdb2Pdb.exe');
    expect(result).toBeNull();
  });

  it('returns null when readdirSync throws', () => {
    existsSyncMock.mockImplementation((p: string) => p === '/src/dir');
    readdirSyncMock.mockImplementation(() => { throw new Error('EACCES'); });

    const result = convertPdbsToTemp(['/src/dir'], '/path/to/Pdb2Pdb.exe');
    expect(result).toBeNull();
  });

  it('skips PDBs that are already Portable format', () => {
    existsSyncMock.mockImplementation((p: string) => p === '/src/dir');
    readdirSyncMock.mockReturnValue(['App.pdb', 'App.dll']);

    // isPortablePdb check: open, read BSJB magic, close
    openSyncMock.mockReturnValue(42);
    readSyncMock.mockImplementation((_fd: number, buf: Buffer) => {
      buf[0] = 0x42; buf[1] = 0x53; buf[2] = 0x4A; buf[3] = 0x42;
      return 4;
    });
    closeSyncMock.mockReturnValue(undefined);

    const result = convertPdbsToTemp(['/src/dir'], '/path/to/Pdb2Pdb.exe');
    expect(result).toBeNull();
    expect(spawnSyncMock).not.toHaveBeenCalled();
  });

  it('skips PDBs without matching DLL', () => {
    existsSyncMock.mockImplementation((p: string) => {
      if (p === '/src/dir') return true;
      // No matching DLL exists
      return false;
    });
    readdirSyncMock.mockReturnValue(['App.pdb']);

    // isPortablePdb returns false (Windows PDB)
    openSyncMock.mockReturnValue(42);
    readSyncMock.mockImplementation((_fd: number, buf: Buffer) => {
      buf[0] = 0x4D; buf[1] = 0x69; buf[2] = 0x63; buf[3] = 0x72;
      return 4;
    });
    closeSyncMock.mockReturnValue(undefined);

    const result = convertPdbsToTemp(['/src/dir'], '/path/to/Pdb2Pdb.exe');
    expect(result).toBeNull();
  });

  it('converts Windows PDB and renames .pdb2 output', () => {
    const existsMap = new Map<string, boolean>([
      ['/src/dir', true],
    ]);
    // Track temp dir creation to allow .pdb2 check
    let tempDirCreated = false;

    existsSyncMock.mockImplementation((p: string) => {
      if (existsMap.has(p)) return existsMap.get(p);
      // DLL must exist for conversion
      if (p.endsWith('App.dll') && !p.includes('mcp-debugger-pdbs')) return true;
      // Temp dir doesn't exist initially, then does after mkdirSync
      if (p.includes('mcp-debugger-pdbs') && !p.endsWith('.pdb2')) return tempDirCreated;
      // .pdb2 output file exists after spawnSync
      if (p.endsWith('.pdb2')) return true;
      return false;
    });

    mkdirSyncMock.mockImplementation(() => { tempDirCreated = true; });
    readdirSyncMock.mockReturnValue(['App.pdb', 'App.dll']);
    copyFileSyncMock.mockReturnValue(undefined);
    renameSyncMock.mockReturnValue(undefined);

    // isPortablePdb returns false (Windows PDB)
    openSyncMock.mockReturnValue(42);
    readSyncMock.mockImplementation((_fd: number, buf: Buffer) => {
      buf[0] = 0x4D; buf[1] = 0x69; buf[2] = 0x63; buf[3] = 0x72;
      return 4;
    });
    closeSyncMock.mockReturnValue(undefined);

    spawnSyncMock.mockReturnValue({ status: 0, stdout: '', stderr: '' });

    const result = convertPdbsToTemp(['/src/dir'], '/path/to/Pdb2Pdb.exe');
    expect(result).not.toBeNull();
    expect(result).toContain('mcp-debugger-pdbs');
    expect(copyFileSyncMock).toHaveBeenCalledTimes(2); // DLL + PDB
    expect(renameSyncMock).toHaveBeenCalledTimes(1);
  });

  it('counts conversion when Pdb2Pdb overwrites in-place (no .pdb2 output)', () => {
    let tempDirCreated = false;

    existsSyncMock.mockImplementation((p: string) => {
      if (p === '/src/dir') return true;
      if (p.endsWith('App.dll') && !p.includes('mcp-debugger-pdbs')) return true;
      if (p.includes('mcp-debugger-pdbs') && !p.endsWith('.pdb2')) return tempDirCreated;
      // .pdb2 file does NOT exist (in-place overwrite)
      if (p.endsWith('.pdb2')) return false;
      return false;
    });

    mkdirSyncMock.mockImplementation(() => { tempDirCreated = true; });
    readdirSyncMock.mockReturnValue(['App.pdb', 'App.dll']);
    copyFileSyncMock.mockReturnValue(undefined);

    // Windows PDB
    openSyncMock.mockReturnValue(42);
    readSyncMock.mockImplementation((_fd: number, buf: Buffer) => {
      buf[0] = 0x4D; buf[1] = 0x69; buf[2] = 0x63; buf[3] = 0x72;
      return 4;
    });
    closeSyncMock.mockReturnValue(undefined);

    spawnSyncMock.mockReturnValue({ status: 0, stdout: '', stderr: '' });

    const result = convertPdbsToTemp(['/src/dir'], '/path/to/Pdb2Pdb.exe');
    expect(result).not.toBeNull();
    expect(renameSyncMock).not.toHaveBeenCalled();
  });

  it('continues when copyFileSync throws', () => {
    existsSyncMock.mockImplementation((p: string) => {
      if (p === '/src/dir') return true;
      if (p.endsWith('App.dll') && !p.includes('mcp-debugger-pdbs')) return true;
      if (p.includes('mcp-debugger-pdbs') && !p.endsWith('.pdb2')) return true;
      return false;
    });

    readdirSyncMock.mockReturnValue(['App.pdb', 'App.dll']);

    // Windows PDB
    openSyncMock.mockReturnValue(42);
    readSyncMock.mockImplementation((_fd: number, buf: Buffer) => {
      buf[0] = 0x4D; buf[1] = 0x69; buf[2] = 0x63; buf[3] = 0x72;
      return 4;
    });
    closeSyncMock.mockReturnValue(undefined);

    copyFileSyncMock.mockImplementation(() => { throw new Error('EBUSY'); });

    const result = convertPdbsToTemp(['/src/dir'], '/path/to/Pdb2Pdb.exe');
    expect(result).toBeNull();
    expect(spawnSyncMock).not.toHaveBeenCalled();
  });

  it('continues when rename fails', () => {
    let tempDirCreated = false;

    existsSyncMock.mockImplementation((p: string) => {
      if (p === '/src/dir') return true;
      if (p.endsWith('App.dll') && !p.includes('mcp-debugger-pdbs')) return true;
      if (p.includes('mcp-debugger-pdbs') && !p.endsWith('.pdb2')) return tempDirCreated;
      if (p.endsWith('.pdb2')) return true;
      return false;
    });

    mkdirSyncMock.mockImplementation(() => { tempDirCreated = true; });
    readdirSyncMock.mockReturnValue(['App.pdb', 'App.dll']);
    copyFileSyncMock.mockReturnValue(undefined);
    renameSyncMock.mockImplementation(() => { throw new Error('EPERM'); });

    openSyncMock.mockReturnValue(42);
    readSyncMock.mockImplementation((_fd: number, buf: Buffer) => {
      buf[0] = 0x4D; buf[1] = 0x69; buf[2] = 0x63; buf[3] = 0x72;
      return 4;
    });
    closeSyncMock.mockReturnValue(undefined);

    spawnSyncMock.mockReturnValue({ status: 0, stdout: '', stderr: '' });

    const result = convertPdbsToTemp(['/src/dir'], '/path/to/Pdb2Pdb.exe');
    // rename failed, so converted stays 0
    expect(result).toBeNull();
  });

  it('processes multiple directories', () => {
    let tempDirCreated = false;

    existsSyncMock.mockImplementation((p: string) => {
      if (p === '/dir1' || p === '/dir2') return true;
      if (p.endsWith('.dll') && !p.includes('mcp-debugger-pdbs')) return true;
      if (p.includes('mcp-debugger-pdbs') && !p.endsWith('.pdb2')) return tempDirCreated;
      if (p.endsWith('.pdb2')) return true;
      return false;
    });

    mkdirSyncMock.mockImplementation(() => { tempDirCreated = true; });
    readdirSyncMock.mockImplementation((dir: string) => {
      if (dir === '/dir1') return ['A.pdb', 'A.dll'];
      if (dir === '/dir2') return ['B.pdb', 'B.dll'];
      return [];
    });
    copyFileSyncMock.mockReturnValue(undefined);
    renameSyncMock.mockReturnValue(undefined);

    openSyncMock.mockReturnValue(42);
    readSyncMock.mockImplementation((_fd: number, buf: Buffer) => {
      buf[0] = 0x4D; buf[1] = 0x69; buf[2] = 0x63; buf[3] = 0x72;
      return 4;
    });
    closeSyncMock.mockReturnValue(undefined);

    spawnSyncMock.mockReturnValue({ status: 0, stdout: '', stderr: '' });

    const result = convertPdbsToTemp(['/dir1', '/dir2'], '/path/to/Pdb2Pdb.exe');
    expect(result).not.toBeNull();
    expect(copyFileSyncMock).toHaveBeenCalledTimes(4); // 2 DLLs + 2 PDBs
    expect(renameSyncMock).toHaveBeenCalledTimes(2);
  });

  it('returns null when Pdb2Pdb fails and no .pdb2 output', () => {
    let tempDirCreated = false;

    existsSyncMock.mockImplementation((p: string) => {
      if (p === '/src/dir') return true;
      if (p.endsWith('App.dll') && !p.includes('mcp-debugger-pdbs')) return true;
      if (p.includes('mcp-debugger-pdbs') && !p.endsWith('.pdb2')) return tempDirCreated;
      if (p.endsWith('.pdb2')) return false;
      return false;
    });

    mkdirSyncMock.mockImplementation(() => { tempDirCreated = true; });
    readdirSyncMock.mockReturnValue(['App.pdb', 'App.dll']);
    copyFileSyncMock.mockReturnValue(undefined);

    openSyncMock.mockReturnValue(42);
    readSyncMock.mockImplementation((_fd: number, buf: Buffer) => {
      buf[0] = 0x4D; buf[1] = 0x69; buf[2] = 0x63; buf[3] = 0x72;
      return 4;
    });
    closeSyncMock.mockReturnValue(undefined);

    // Pdb2Pdb failed (non-zero exit) and no .pdb2 file
    spawnSyncMock.mockReturnValue({ status: 1, stdout: '', stderr: 'error' });

    const result = convertPdbsToTemp(['/src/dir'], '/path/to/Pdb2Pdb.exe');
    expect(result).toBeNull();
  });

  it('handles empty source dirs array', () => {
    const result = convertPdbsToTemp([], '/path/to/Pdb2Pdb.exe');
    expect(result).toBeNull();
  });
});

describe('getExeArchitecture', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns x86 for i386 PE Machine field (0x014c)', () => {
    openSyncMock.mockReturnValue(42);
    readSyncMock.mockImplementation((_fd: number, buf: Buffer, _offset: number, length: number, position: number) => {
      if (position === 0x3C) {
        // PE header offset = 0x80
        buf.writeUInt32LE(0x80, 0);
        return 4;
      }
      if (position === 0x80) {
        // PE signature "PE\0\0" + Machine field 0x014c (i386)
        buf[0] = 0x50; buf[1] = 0x45; buf[2] = 0; buf[3] = 0;
        buf.writeUInt16LE(0x014c, 4);
        return 6;
      }
      return 0;
    });
    closeSyncMock.mockReturnValue(undefined);

    expect(getExeArchitecture('/some/app.exe')).toBe('x86');
    expect(closeSyncMock).toHaveBeenCalledWith(42);
  });

  it('returns x64 for AMD64 PE Machine field (0x8664)', () => {
    openSyncMock.mockReturnValue(42);
    readSyncMock.mockImplementation((_fd: number, buf: Buffer, _offset: number, length: number, position: number) => {
      if (position === 0x3C) {
        buf.writeUInt32LE(0x80, 0);
        return 4;
      }
      if (position === 0x80) {
        buf[0] = 0x50; buf[1] = 0x45; buf[2] = 0; buf[3] = 0;
        buf.writeUInt16LE(0x8664, 4);
        return 6;
      }
      return 0;
    });
    closeSyncMock.mockReturnValue(undefined);

    expect(getExeArchitecture('/some/app64.exe')).toBe('x64');
  });

  it('returns null for invalid PE signature', () => {
    openSyncMock.mockReturnValue(42);
    readSyncMock.mockImplementation((_fd: number, buf: Buffer, _offset: number, length: number, position: number) => {
      if (position === 0x3C) {
        buf.writeUInt32LE(0x80, 0);
        return 4;
      }
      if (position === 0x80) {
        // Bad PE signature
        buf[0] = 0; buf[1] = 0; buf[2] = 0; buf[3] = 0;
        buf.writeUInt16LE(0x014c, 4);
        return 6;
      }
      return 0;
    });
    closeSyncMock.mockReturnValue(undefined);

    expect(getExeArchitecture('/some/bad.exe')).toBeNull();
  });

  it('returns null when file cannot be opened', () => {
    openSyncMock.mockImplementation(() => { throw new Error('ENOENT'); });

    expect(getExeArchitecture('/nonexistent.exe')).toBeNull();
  });

  it('returns null for unknown Machine field', () => {
    openSyncMock.mockReturnValue(42);
    readSyncMock.mockImplementation((_fd: number, buf: Buffer, _offset: number, length: number, position: number) => {
      if (position === 0x3C) {
        buf.writeUInt32LE(0x80, 0);
        return 4;
      }
      if (position === 0x80) {
        buf[0] = 0x50; buf[1] = 0x45; buf[2] = 0; buf[3] = 0;
        buf.writeUInt16LE(0xAA64, 4); // ARM64, not handled
        return 6;
      }
      return 0;
    });
    closeSyncMock.mockReturnValue(undefined);

    expect(getExeArchitecture('/some/arm64.exe')).toBeNull();
  });
});

describe('getProcessExecutablePath', () => {
  const originalPlatform = process.platform;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
  });

  it('returns null on non-Windows platforms', () => {
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
    expect(getProcessExecutablePath(1234)).toBeNull();
  });

  it('returns executable path via WMIC on Windows', () => {
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
    spawnSyncMock.mockReturnValue({
      status: 0,
      stdout: Buffer.from('\r\nExecutablePath=C:\\Program Files\\App\\app.exe\r\n\r\n'),
      stderr: Buffer.from('')
    });

    expect(getProcessExecutablePath(1234)).toBe('C:\\Program Files\\App\\app.exe');
  });

  it('returns null when WMIC fails', () => {
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
    spawnSyncMock.mockReturnValue({ status: 1, stdout: Buffer.from(''), stderr: Buffer.from('') });

    expect(getProcessExecutablePath(1234)).toBeNull();
  });

  it('returns null when WMIC output has no ExecutablePath', () => {
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
    spawnSyncMock.mockReturnValue({
      status: 0,
      stdout: Buffer.from('No Instance(s) Available.\r\n'),
      stderr: Buffer.from('')
    });

    expect(getProcessExecutablePath(1234)).toBeNull();
  });
});

describe('getProcessArchitecture', () => {
  const originalPlatform = process.platform;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
  });

  it('returns null on non-Windows platforms', () => {
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
    expect(getProcessArchitecture(1234)).toBeNull();
  });

  it('returns x86 for a 32-bit process', () => {
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });

    // WMIC returns exe path
    spawnSyncMock.mockReturnValue({
      status: 0,
      stdout: Buffer.from('\r\nExecutablePath=C:\\App\\app.exe\r\n'),
      stderr: Buffer.from('')
    });

    // PE header reads
    openSyncMock.mockReturnValue(42);
    readSyncMock.mockImplementation((_fd: number, buf: Buffer, _offset: number, length: number, position: number) => {
      if (position === 0x3C) {
        buf.writeUInt32LE(0x80, 0);
        return 4;
      }
      if (position === 0x80) {
        buf[0] = 0x50; buf[1] = 0x45; buf[2] = 0; buf[3] = 0;
        buf.writeUInt16LE(0x014c, 4);
        return 6;
      }
      return 0;
    });
    closeSyncMock.mockReturnValue(undefined);

    expect(getProcessArchitecture(1234)).toBe('x86');
  });

  it('returns null when exe path cannot be determined', () => {
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
    spawnSyncMock.mockReturnValue({ status: 1, stdout: Buffer.from(''), stderr: Buffer.from('') });

    expect(getProcessArchitecture(1234)).toBeNull();
  });
});

describe('findNetcoredbgExecutable (architecture-aware)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...savedEnv };
    delete process.env.NETCOREDBG_PATH;
    delete process.env.NETCOREDBG_X86_PATH;
  });

  afterEach(() => {
    process.env = savedEnv;
  });

  it('uses NETCOREDBG_X86_PATH when targeting x86', async () => {
    process.env.NETCOREDBG_X86_PATH = '/x86/netcoredbg';
    existsSyncMock.mockImplementation((p: string) => p === '/x86/netcoredbg');

    const result = await findNetcoredbgExecutable(undefined, undefined, 'x86');
    expect(result).toBe('/x86/netcoredbg');
  });

  it('skips NETCOREDBG_PATH when it has wrong architecture for x86 target', async () => {
    process.env.NETCOREDBG_PATH = '/x64/netcoredbg';
    existsSyncMock.mockImplementation((p: string) => p === '/x64/netcoredbg');

    // PE check returns x64 for the env path
    openSyncMock.mockReturnValue(42);
    readSyncMock.mockImplementation((_fd: number, buf: Buffer, _offset: number, _length: number, position: number) => {
      if (position === 0x3C) {
        buf.writeUInt32LE(0x80, 0);
        return 4;
      }
      if (position === 0x80) {
        buf[0] = 0x50; buf[1] = 0x45; buf[2] = 0; buf[3] = 0;
        buf.writeUInt16LE(0x8664, 4); // x64
        return 6;
      }
      return 0;
    });
    closeSyncMock.mockReturnValue(undefined);

    // Falls back to non-arch search which finds the env path
    const result = await findNetcoredbgExecutable(undefined, undefined, 'x86');
    expect(result).toBe('/x64/netcoredbg');
  });

  it('falls back to any architecture when no matching x86 binary found', async () => {
    process.env.NETCOREDBG_PATH = '/path/netcoredbg';
    existsSyncMock.mockImplementation((p: string) => p === '/path/netcoredbg');

    // PE check returns x64
    openSyncMock.mockReturnValue(42);
    readSyncMock.mockImplementation((_fd: number, buf: Buffer, _offset: number, _length: number, position: number) => {
      if (position === 0x3C) {
        buf.writeUInt32LE(0x80, 0);
        return 4;
      }
      if (position === 0x80) {
        buf[0] = 0x50; buf[1] = 0x45; buf[2] = 0; buf[3] = 0;
        buf.writeUInt16LE(0x8664, 4);
        return 6;
      }
      return 0;
    });
    closeSyncMock.mockReturnValue(undefined);

    // Should fall back and find it without arch constraint
    const result = await findNetcoredbgExecutable(undefined, undefined, 'x86');
    expect(result).toBe('/path/netcoredbg');
  });
});
