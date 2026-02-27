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
// vi.mock with __esModule: true ensures the default export is replaced
const { existsSyncMock, readdirSyncMock } = vi.hoisted(() => ({
  existsSyncMock: vi.fn(),
  readdirSyncMock: vi.fn()
}));
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    __esModule: true,
    ...actual,
    default: {
      ...actual.default,
      existsSync: existsSyncMock,
      readdirSync: readdirSyncMock
    },
    existsSync: existsSyncMock,
    readdirSync: readdirSyncMock
  };
});

import { spawn } from 'child_process';
import which from 'which';
import {
  findVsdbgExecutable,
  findNetcoredbgExecutable,
  findDotnetBackend,
  listDotnetProcesses,
  findVsdaNode,
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
    const error = new CommandNotFoundError('vsdbg');
    expect(error.name).toBe('CommandNotFoundError');
    expect(error.command).toBe('vsdbg');
    expect(error.message).toBe('vsdbg');
  });

  it('is instance of Error', () => {
    const error = new CommandNotFoundError('netcoredbg');
    expect(error).toBeInstanceOf(Error);
  });
});

describe('findVsdbgExecutable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...savedEnv };
    delete process.env.VSDBG_PATH;
  });

  afterEach(() => {
    process.env = savedEnv;
  });

  it('uses VSDBG_PATH environment variable when set and file exists', async () => {
    process.env.VSDBG_PATH = '/custom/vsdbg.exe';
    existsSyncMock.mockImplementation((p: string) => p === '/custom/vsdbg.exe');

    const result = await findVsdbgExecutable();
    expect(result).toBe('/custom/vsdbg.exe');
  });

  it('falls through when VSDBG_PATH is set but file does not exist', async () => {
    process.env.VSDBG_PATH = '/nonexistent/vsdbg.exe';
    existsSyncMock.mockReturnValue(false);

    await expect(findVsdbgExecutable()).rejects.toThrow();
  });

  it('uses preferred path when file exists', async () => {
    existsSyncMock.mockImplementation((p: string) => p === '/preferred/vsdbg.exe');

    const result = await findVsdbgExecutable('/preferred/vsdbg.exe');
    expect(result).toBe('/preferred/vsdbg.exe');
  });

  it('throws CommandNotFoundError when nothing is found', async () => {
    existsSyncMock.mockReturnValue(false);

    await expect(findVsdbgExecutable()).rejects.toThrow('vsdbg not found');
  });

  it('finds vsdbg in VS Code extensions directory', async () => {
    const home = process.env.HOME || process.env.USERPROFILE || '';
    const extDir = path.join(home, '.vscode', 'extensions');
    const vsdbgPath = path.join(extDir, 'ms-dotnettools.csharp-2.120.3-win32-x64', '.debugger', 'x86_64', 'vsdbg.exe');

    existsSyncMock.mockImplementation((p: string) => {
      if (p === extDir) return true;
      if (p === vsdbgPath) return true;
      return false;
    });

    readdirSyncMock.mockReturnValue(['ms-dotnettools.csharp-2.120.3-win32-x64']);

    const result = await findVsdbgExecutable();
    expect(result).toBe(vsdbgPath);
  });

  it('picks latest version when multiple C# extensions found', async () => {
    const home = process.env.HOME || process.env.USERPROFILE || '';
    const extDir = path.join(home, '.vscode', 'extensions');
    const olderPath = path.join(extDir, 'ms-dotnettools.csharp-2.100.0-win32-x64', '.debugger', 'x86_64', 'vsdbg.exe');
    const newerPath = path.join(extDir, 'ms-dotnettools.csharp-2.120.3-win32-x64', '.debugger', 'x86_64', 'vsdbg.exe');

    existsSyncMock.mockImplementation((p: string) => {
      if (p === extDir) return true;
      if (p === olderPath) return true;
      if (p === newerPath) return true;
      return false;
    });

    readdirSyncMock.mockReturnValue([
      'ms-dotnettools.csharp-2.100.0-win32-x64',
      'ms-dotnettools.csharp-2.120.3-win32-x64'
    ]);

    const result = await findVsdbgExecutable();
    // Sorted reverse, so 2.120.3 comes first
    expect(result).toBe(newerPath);
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
    delete process.env.DOTNET_DBG_BACKEND;
    delete process.env.VSDBG_PATH;
    delete process.env.NETCOREDBG_PATH;
  });

  afterEach(() => {
    process.env = savedEnv;
  });

  it('respects DOTNET_DBG_BACKEND=vsdbg', async () => {
    process.env.DOTNET_DBG_BACKEND = 'vsdbg';
    process.env.VSDBG_PATH = '/path/vsdbg.exe';
    existsSyncMock.mockImplementation((p: string) => p === '/path/vsdbg.exe');

    const result = await findDotnetBackend();
    expect(result.backend).toBe('vsdbg');
    expect(result.path).toBe('/path/vsdbg.exe');
  });

  it('respects DOTNET_DBG_BACKEND=netcoredbg', async () => {
    process.env.DOTNET_DBG_BACKEND = 'netcoredbg';
    process.env.NETCOREDBG_PATH = '/path/netcoredbg';
    existsSyncMock.mockImplementation((p: string) => p === '/path/netcoredbg');

    const result = await findDotnetBackend();
    expect(result.backend).toBe('netcoredbg');
    expect(result.path).toBe('/path/netcoredbg');
  });

  it('auto mode prefers vsdbg over netcoredbg', async () => {
    process.env.VSDBG_PATH = '/path/vsdbg.exe';
    existsSyncMock.mockImplementation((p: string) => p === '/path/vsdbg.exe');

    const result = await findDotnetBackend();
    expect(result.backend).toBe('vsdbg');
  });

  it('auto mode falls back to netcoredbg when vsdbg not found', async () => {
    existsSyncMock.mockReturnValue(false);
    whichMock.mockResolvedValue('/usr/bin/netcoredbg');

    const result = await findDotnetBackend();
    expect(result.backend).toBe('netcoredbg');
    expect(result.path).toBe('/usr/bin/netcoredbg');
  });

  it('throws when neither backend is found', async () => {
    existsSyncMock.mockReturnValue(false);
    whichMock.mockRejectedValue(new Error('not found'));

    await expect(findDotnetBackend()).rejects.toThrow('.NET debugger not found');
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
    // notepad.exe should NOT be in the list (not a known .NET process)

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

describe('findVsdaNode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...savedEnv };
    delete process.env.VSDA_PATH;
  });

  afterEach(() => {
    process.env = savedEnv;
  });

  it('uses VSDA_PATH environment variable when set and file exists', () => {
    process.env.VSDA_PATH = '/custom/vsda.node';
    existsSyncMock.mockImplementation((p: string) => p === '/custom/vsda.node');

    const result = findVsdaNode();
    expect(result).toBe('/custom/vsda.node');
  });

  it('falls through when VSDA_PATH is set but file does not exist', () => {
    process.env.VSDA_PATH = '/nonexistent/vsda.node';
    existsSyncMock.mockReturnValue(false);

    const result = findVsdaNode();
    expect(result).toBeNull();
  });

  it('returns null when vsda.node is not found anywhere', () => {
    existsSyncMock.mockReturnValue(false);

    const result = findVsdaNode();
    expect(result).toBeNull();
  });

  // path.join uses platform-native separators, so the mock paths only match on Windows
  it.skipIf(process.platform !== 'win32')('discovers vsda.node in VS Code installation on Windows', () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
    process.env.LOCALAPPDATA = 'C:\\Users\\Test\\AppData\\Local';

    const vscodeDir = 'C:\\Users\\Test\\AppData\\Local\\Programs\\Microsoft VS Code';
    const vsdaPath = path.join(vscodeDir, '1.85.0', 'resources', 'app',
      'node_modules.asar.unpacked', 'vsda', 'build', 'Release', 'vsda.node');

    existsSyncMock.mockImplementation((p: string) => {
      if (p === vscodeDir) return true;
      if (p === vsdaPath) return true;
      return false;
    });
    readdirSyncMock.mockReturnValue(['1.85.0']);

    const result = findVsdaNode();
    expect(result).toBe(vsdaPath);

    Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
  });
});

