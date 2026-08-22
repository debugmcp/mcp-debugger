/**
 * Unit tests for the shared process scanner (issue #399).
 *
 * One scan produces (pid, args) pairs that both orphan reapers match over,
 * halving the platform I/O the two independent walks used to do.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('node:fs/promises', async (importOriginal: () => Promise<unknown>) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    readdir: vi.fn(),
    readFile: vi.fn(),
  };
});

vi.mock('node:child_process', async (importOriginal: () => Promise<unknown>) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    execFile: vi.fn(),
  };
});

import { execFile } from 'node:child_process';
import * as fsp from 'node:fs/promises';
import { scanLinux, scanDarwin, scanWindows } from '../../../src/utils/process-scan.js';

const mockExecFile = execFile as unknown as ReturnType<typeof vi.fn>;
const mockReaddir = fsp.readdir as unknown as ReturnType<typeof vi.fn>;
const mockReadFile = fsp.readFile as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('scanLinux', () => {
  it('returns (pid, args) for numeric /proc entries, splitting cmdline on NUL', async () => {
    mockReaddir.mockResolvedValue(['1', 'self', '42', 'not-a-pid']);
    mockReadFile.mockImplementation(async (p: string) => {
      if (p === '/proc/1/cmdline') return 'init\0';
      if (p === '/proc/42/cmdline') return 'java\0-Dmcp.debugger.jvm=true\0Main\0';
      throw new Error(`unexpected read: ${p}`);
    });

    const result = await scanLinux();

    expect(result).toEqual(
      expect.arrayContaining([
        { pid: 1, args: ['init'] },
        { pid: 42, args: ['java', '-Dmcp.debugger.jvm=true', 'Main'] },
      ])
    );
    expect(result).toHaveLength(2);
    // Non-numeric entries never get a cmdline read
    expect(mockReadFile).toHaveBeenCalledTimes(2);
  });

  it('skips pids whose cmdline read fails and survives readdir failure', async () => {
    mockReaddir.mockResolvedValue(['7']);
    mockReadFile.mockRejectedValue(new Error('EACCES'));
    expect(await scanLinux()).toEqual([]);

    mockReaddir.mockRejectedValue(new Error('no /proc'));
    expect(await scanLinux()).toEqual([]);
  });
});

describe('scanDarwin', () => {
  it('parses ps pid/command lines into (pid, args)', async () => {
    mockExecFile.mockImplementation(
      (_cmd: string, _args: string[], _opts: unknown, cb: (e: Error | null, r?: { stdout: string }) => void) => {
        cb(null, { stdout: '   12 /usr/bin/thing --flag\n  345 node worker.js --mcp-owner-pid=9\n\n' });
      }
    );

    const result = await scanDarwin();

    expect(result).toEqual([
      { pid: 12, args: ['/usr/bin/thing', '--flag'] },
      { pid: 345, args: ['node', 'worker.js', '--mcp-owner-pid=9'] },
    ]);
  });
});

describe('scanWindows', () => {
  it('runs one CIM query per process name and concatenates results', async () => {
    const byName: Record<string, string> = {
      'java.exe': JSON.stringify([{ ProcessId: 100, CommandLine: 'java -Dmcp.debugger.jvm=true Main' }]),
      'node.exe': JSON.stringify({ ProcessId: 200, CommandLine: 'node proxy-bootstrap.js --mcp-owner-pid=9' }),
    };
    mockExecFile.mockImplementation(
      (_cmd: string, args: string[], _opts: unknown, cb: (e: Error | null, r?: { stdout: string }) => void) => {
        const psCommand = args[args.length - 1];
        const name = Object.keys(byName).find((n) => psCommand.includes(`Name='${n}'`));
        cb(null, { stdout: name ? byName[name] : '' });
      }
    );

    const result = await scanWindows(['java.exe', 'node.exe']);

    expect(mockExecFile).toHaveBeenCalledTimes(2);
    expect(result).toEqual([
      { pid: 100, args: ['java', '-Dmcp.debugger.jvm=true', 'Main'] },
      { pid: 200, args: ['node', 'proxy-bootstrap.js', '--mcp-owner-pid=9'] },
    ]);
  });

  it('tolerates a failing or empty query without failing the others', async () => {
    mockExecFile.mockImplementation(
      (_cmd: string, args: string[], _opts: unknown, cb: (e: Error | null, r?: { stdout: string }) => void) => {
        const psCommand = args[args.length - 1];
        if (psCommand.includes("Name='java.exe'")) {
          cb(new Error('powershell exploded'));
        } else {
          cb(null, { stdout: JSON.stringify({ ProcessId: 5, CommandLine: 'node x.js' }) });
        }
      }
    );

    const result = await scanWindows(['java.exe', 'node.exe']);

    expect(result).toEqual([{ pid: 5, args: ['node', 'x.js'] }]);
  });
});
