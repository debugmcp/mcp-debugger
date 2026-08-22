import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Module mocks are hoisted above all imports. Each mock preserves the rest of
// the module via importOriginal so unrelated code paths aren't disturbed.
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
import {
  parseProxyArgs,
  parseJsDebugAdapterArgs,
  killPosixWithEscalation,
  killWindows,
  listLinuxProxies,
  listDarwinProxies,
  listWindowsProxies,
} from '../../../src/utils/proxy-orphan-reaper.js';
import { PROC_SCAN_CONCURRENCY } from '../../../src/utils/proc-scan-concurrency.js';

const mockExecFile = execFile as unknown as ReturnType<typeof vi.fn>;
const mockReaddir = fsp.readdir as unknown as ReturnType<typeof vi.fn>;
const mockReadFile = fsp.readFile as unknown as ReturnType<typeof vi.fn>;

/** A worker cmdline exactly as spawned by ProxyProcessLauncherImpl. */
const workerArgs = (ownerPid: number | string, sessionId = 'sess-1') => [
  'node',
  '--trace-uncaught',
  '--trace-exit',
  '/app/dist/proxy/proxy-bootstrap.js',
  `--mcp-owner-pid=${ownerPid}`,
  `--mcp-session-id=${sessionId}`,
];

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('parseProxyArgs', () => {
  it('returns null without a proxy-bootstrap token even when owner marker is present', () => {
    // e.g. the mcp-debugger server itself, or an unrelated node process that
    // happens to carry the marker string in some other arg
    expect(
      parseProxyArgs(123, ['node', '/app/dist/index.js', '--mcp-owner-pid=42']),
    ).toBeNull();
  });

  it('returns null for pre-upgrade workers (bootstrap present, no owner marker)', () => {
    expect(
      parseProxyArgs(123, [
        'node',
        '--trace-uncaught',
        '--trace-exit',
        '/app/dist/proxy/proxy-bootstrap.js',
      ]),
    ).toBeNull();
  });

  it('returns null when owner pid is non-numeric, zero, or negative', () => {
    expect(parseProxyArgs(123, workerArgs('not-a-pid'))).toBeNull();
    expect(parseProxyArgs(123, workerArgs(0))).toBeNull();
    expect(parseProxyArgs(123, workerArgs(-5))).toBeNull();
  });

  it('parses the full spawn shape including session id', () => {
    expect(parseProxyArgs(9001, workerArgs(42, 'abc-123'))).toEqual({
      pid: 9001,
      ownerPid: 42,
      sessionId: 'abc-123',
    });
  });

  it('tolerates a missing session id by leaving it empty', () => {
    expect(
      parseProxyArgs(9001, [
        'node',
        '/app/dist/proxy/proxy-bootstrap.js',
        '--mcp-owner-pid=42',
      ]),
    ).toEqual({ pid: 9001, ownerPid: 42, sessionId: '' });
  });

  it('recognizes the marker inside a Windows-style absolute path token', () => {
    expect(
      parseProxyArgs(9001, [
        'C:\\Program', // node.exe path fragmented by whitespace split
        'Files\\nodejs\\node.exe',
        '--trace-uncaught',
        '--trace-exit',
        'C:\\app\\dist\\proxy\\proxy-bootstrap.js',
        '--mcp-owner-pid=42',
        '--mcp-session-id=s',
      ]),
    ).toEqual({ pid: 9001, ownerPid: 42, sessionId: 's' });
  });
});

describe('parseJsDebugAdapterArgs', () => {
  /** A js-debug adapter cmdline exactly as spawned via buildAdapterCommand (issue #431). */
  const adapterArgs = (ownerPid: number | string, sessionId = 'sess-1') => [
    'C:\\nodejs\\node.exe',
    'C:\\repo\\packages\\adapter-javascript\\vendor\\js-debug\\vsDebugServer.cjs',
    '5679',
    '127.0.0.1',
    `--mcp-owner-pid=${ownerPid}`,
    `--mcp-session-id=${sessionId}`,
  ];

  it('parses the full spawn shape including session id', () => {
    expect(parseJsDebugAdapterArgs(9001, adapterArgs(42, 'abc-123'))).toEqual({
      pid: 9001,
      ownerPid: 42,
      sessionId: 'abc-123',
    });
  });

  it("returns null for VS Code's own js-debug instances (no owner marker)", () => {
    expect(
      parseJsDebugAdapterArgs(9001, [
        'C:\\nodejs\\node.exe',
        'c:\\Users\\x\\.vscode\\extensions\\ms-vscode.js-debug\\src\\vsDebugServer.cjs',
        '5680',
      ]),
    ).toBeNull();
  });

  it('returns null when the owner marker is present but the vsDebugServer token is absent', () => {
    // e.g. a tagged proxy worker row — must stay matched by parseProxyArgs only
    expect(
      parseJsDebugAdapterArgs(9001, [
        'node',
        '/app/dist/proxy/proxy-bootstrap.js',
        '--mcp-owner-pid=42',
        '--mcp-session-id=s',
      ]),
    ).toBeNull();
  });

  it('returns null when owner pid is non-numeric, zero, or negative', () => {
    expect(parseJsDebugAdapterArgs(9001, adapterArgs('not-a-pid'))).toBeNull();
    expect(parseJsDebugAdapterArgs(9001, adapterArgs(0))).toBeNull();
    expect(parseJsDebugAdapterArgs(9001, adapterArgs(-5))).toBeNull();
  });

  it('tolerates a missing session id by leaving it empty', () => {
    expect(
      parseJsDebugAdapterArgs(9001, [
        'node',
        '/repo/vendor/js-debug/vsDebugServer.cjs',
        '5679',
        '127.0.0.1',
        '--mcp-owner-pid=42',
      ]),
    ).toEqual({ pid: 9001, ownerPid: 42, sessionId: '' });
  });
});

/** Injected signal fn that throws an ErrnoException with the given code (issue #183). */
function throwWith(code: string): () => never {
  return () => {
    const err = new Error(code) as NodeJS.ErrnoException;
    err.code = code;
    throw err;
  };
}

/** Instant sleep so escalation tests don't really wait. */
const instantSleep = async (): Promise<void> => {};

describe('killPosixWithEscalation', () => {
  it('sends one SIGTERM and no SIGKILL when the worker dies during the poll window', async () => {
    const signal = vi.fn();
    let polls = 0;
    const isAlive = () => ++polls < 3; // dies on the third poll
    const ok = await killPosixWithEscalation(9001, signal, isAlive, instantSleep);
    expect(ok).toBe(true);
    expect(signal).toHaveBeenCalledTimes(1);
    expect(signal).toHaveBeenCalledWith(9001, 'SIGTERM');
  });

  it('escalates to SIGKILL when the worker is wedged past the cap', async () => {
    const signal = vi.fn();
    const ok = await killPosixWithEscalation(
      9001,
      signal,
      () => true, // never dies
      instantSleep,
      100,
      300,
    );
    expect(ok).toBe(true);
    expect(signal).toHaveBeenCalledWith(9001, 'SIGTERM');
    expect(signal).toHaveBeenLastCalledWith(9001, 'SIGKILL');
    expect(signal).toHaveBeenCalledTimes(2);
  });

  it('returns false on ESRCH from SIGTERM (already gone) without escalating', async () => {
    const isAlive = vi.fn();
    const ok = await killPosixWithEscalation(9001, throwWith('ESRCH'), isAlive, instantSleep);
    expect(ok).toBe(false);
    expect(isAlive).not.toHaveBeenCalled();
  });

  it('returns false on EPERM from SIGTERM (foreign-owned process)', async () => {
    expect(await killPosixWithEscalation(9001, throwWith('EPERM'), () => true, instantSleep)).toBe(
      false,
    );
  });

  it('rethrows unexpected SIGTERM errors', async () => {
    await expect(
      killPosixWithEscalation(9001, throwWith('EINVAL'), () => true, instantSleep),
    ).rejects.toThrow('EINVAL');
  });

  it('swallows ESRCH on the escalation SIGKILL (died between poll and kill)', async () => {
    const signal = vi.fn().mockImplementationOnce(() => {}).mockImplementationOnce(throwWith('ESRCH'));
    const ok = await killPosixWithEscalation(9001, signal, () => true, instantSleep, 100, 100);
    expect(ok).toBe(true);
    expect(signal).toHaveBeenCalledTimes(2);
  });

  it('rethrows unexpected errors on the escalation SIGKILL', async () => {
    const signal = vi.fn().mockImplementationOnce(() => {}).mockImplementationOnce(throwWith('EPERM'));
    await expect(
      killPosixWithEscalation(9001, signal, () => true, instantSleep, 100, 100),
    ).rejects.toThrow('EPERM');
  });
});

describe('killWindows', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const respondWith = (result: { stdout?: string; err?: Error & { code?: number | string } }) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockExecFile.mockImplementation((..._args: any[]) => {
      const cb = _args[_args.length - 1] as (
        err: Error | null,
        result?: { stdout: string; stderr: string },
      ) => void;
      if (result.err) {
        cb(result.err);
      } else {
        cb(null, { stdout: result.stdout ?? '', stderr: '' });
      }
    });

  const failWith = (code: number | string): Error & { code?: number | string } =>
    Object.assign(new Error(`taskkill exited ${code}`), { code });

  it('invokes taskkill with the exact tree-kill args and returns true on success', async () => {
    respondWith({ stdout: 'SUCCESS' });
    expect(await killWindows(9001)).toBe(true);
    const [cmd, args] = mockExecFile.mock.calls[0] as [string, string[]];
    expect(cmd).toBe('taskkill');
    expect(args).toEqual(['/PID', '9001', '/T', '/F']);
  });

  it('returns false on exit code 128 (process not found)', async () => {
    respondWith({ err: failWith(128) });
    expect(await killWindows(9001)).toBe(false);
  });

  it('returns false on exit code 1 (access denied)', async () => {
    respondWith({ err: failWith(1) });
    expect(await killWindows(9001)).toBe(false);
  });

  it('rethrows spawn failures (e.g. taskkill missing)', async () => {
    respondWith({ err: failWith('ENOENT') });
    await expect(killWindows(9001)).rejects.toThrow();
  });
});

describe('listLinuxProxies', () => {
  it('returns empty array when /proc readdir fails', async () => {
    mockReaddir.mockRejectedValueOnce(new Error('EACCES'));
    expect(await listLinuxProxies()).toEqual([]);
  });

  it('skips non-numeric entries and unreadable cmdlines', async () => {
    mockReaddir.mockResolvedValueOnce(['self', 'cpuinfo', '100', '200'] as never);
    mockReadFile.mockImplementation(async (path: unknown) => {
      if (String(path).includes('/100/')) {
        throw Object.assign(new Error('disappeared'), { code: 'ENOENT' });
      }
      return 'sh\0-c\0echo hi\0';
    });
    expect(await listLinuxProxies()).toEqual([]);
  });

  it('parses NUL-delimited cmdlines and returns tagged workers only', async () => {
    mockReaddir.mockResolvedValueOnce(['100', '200', '300'] as never);
    mockReadFile.mockImplementation(async (path: unknown) => {
      const p = String(path);
      if (p.includes('/100/')) {
        return workerArgs(42, 'tag-a').join('\0') + '\0';
      }
      if (p.includes('/200/')) {
        // untagged bootstrap (pre-upgrade worker) — must be ignored
        return 'node\0/app/dist/proxy/proxy-bootstrap.js\0';
      }
      return 'bash\0-l\0';
    });
    expect(await listLinuxProxies()).toEqual([
      { pid: 100, ownerPid: 42, sessionId: 'tag-a' },
    ]);
  });

  it('bounds concurrent cmdline reads on hosts with many processes', async () => {
    const pids = Array.from({ length: 500 }, (_, i) => String(1000 + i));
    mockReaddir.mockResolvedValueOnce(pids as never);

    let inFlight = 0;
    let peak = 0;
    mockReadFile.mockImplementation(async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setImmediate(resolve));
      inFlight--;
      return 'bash\0-l\0';
    });

    await listLinuxProxies();

    expect(mockReadFile).toHaveBeenCalledTimes(pids.length);
    expect(peak).toBeLessThanOrEqual(PROC_SCAN_CONCURRENCY);
  });
});

describe('listDarwinProxies', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const respondWith = (result: { stdout: string }) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockExecFile.mockImplementation((..._args: any[]) => {
      const cb = _args[_args.length - 1] as (
        err: Error | null,
        result: { stdout: string; stderr: string },
      ) => void;
      cb(null, { stdout: result.stdout, stderr: '' });
    });

  it('parses tagged workers from ps output, skipping garbage lines', async () => {
    respondWith({
      stdout: [
        `  100 ${workerArgs(42, 'tag-a').join(' ')}`,
        '  200 bash -l',
        'garbage-line',
        '  ',
        `  300 ${workerArgs(99, 'tag-b').join(' ')}`,
        '',
      ].join('\n'),
    });
    expect(await listDarwinProxies()).toEqual([
      { pid: 100, ownerPid: 42, sessionId: 'tag-a' },
      { pid: 300, ownerPid: 99, sessionId: 'tag-b' },
    ]);
  });

  it('returns empty array when ps stdout is empty', async () => {
    respondWith({ stdout: '' });
    expect(await listDarwinProxies()).toEqual([]);
  });
});

describe('listWindowsProxies', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const respondWith = (result: { stdout?: string; err?: Error }) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockExecFile.mockImplementation((..._args: any[]) => {
      const cb = _args[_args.length - 1] as (
        err: Error | null,
        result?: { stdout: string; stderr: string },
      ) => void;
      if (result.err) {
        cb(result.err);
      } else {
        cb(null, { stdout: result.stdout ?? '', stderr: '' });
      }
    });

  it('parses a JSON array, keeping only tagged workers', async () => {
    respondWith({
      stdout: JSON.stringify([
        {
          ProcessId: 100,
          CommandLine: `C:\\nodejs\\node.exe --trace-uncaught --trace-exit C:\\app\\dist\\proxy\\proxy-bootstrap.js --mcp-owner-pid=42 --mcp-session-id=tag-a`,
        },
        { ProcessId: 200, CommandLine: 'C:\\nodejs\\node.exe C:\\app\\dist\\index.js http' },
        { ProcessId: 300, CommandLine: null },
      ]),
    });
    expect(await listWindowsProxies()).toEqual([
      { pid: 100, ownerPid: 42, sessionId: 'tag-a' },
    ]);
  });

  it('handles PowerShell single-object output (no array wrapper)', async () => {
    respondWith({
      stdout: JSON.stringify({
        ProcessId: 100,
        CommandLine: workerArgs(42, 'only').join(' '),
      }),
    });
    expect(await listWindowsProxies()).toEqual([
      { pid: 100, ownerPid: 42, sessionId: 'only' },
    ]);
  });

  it('returns empty array when PowerShell errors out', async () => {
    respondWith({ err: new Error('powershell.exe not found') });
    expect(await listWindowsProxies()).toEqual([]);
  });

  it('returns empty array on empty or malformed stdout', async () => {
    respondWith({ stdout: '   \n  ' });
    expect(await listWindowsProxies()).toEqual([]);
    respondWith({ stdout: 'not json {{{' });
    expect(await listWindowsProxies()).toEqual([]);
  });
});
