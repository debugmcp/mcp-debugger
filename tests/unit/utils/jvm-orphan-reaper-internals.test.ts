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
  parseArgs,
  isPidAlive,
  defaultKill,
  listLinux,
  listDarwin,
  listWindows,
} from '../../../src/utils/jvm-orphan-reaper.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockExecFile = execFile as unknown as ReturnType<typeof vi.fn>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockReaddir = fsp.readdir as unknown as ReturnType<typeof vi.fn>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockReadFile = fsp.readFile as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('parseArgs', () => {
  it('returns null when JVM marker is missing', () => {
    expect(
      parseArgs(123, [
        'java',
        '-Dmcp.debugger.owner_pid=42',
        '-Dmcp.debugger.session_tag=t',
      ]),
    ).toBeNull();
  });

  it('returns null when owner_pid is missing', () => {
    expect(
      parseArgs(123, ['java', '-Dmcp.debugger.jvm=true']),
    ).toBeNull();
  });

  it('returns null when owner_pid is non-numeric', () => {
    expect(
      parseArgs(123, [
        'java',
        '-Dmcp.debugger.jvm=true',
        '-Dmcp.debugger.owner_pid=not-a-pid',
      ]),
    ).toBeNull();
  });

  it('returns null when owner_pid is zero or negative', () => {
    expect(
      parseArgs(123, [
        'java',
        '-Dmcp.debugger.jvm=true',
        '-Dmcp.debugger.owner_pid=0',
      ]),
    ).toBeNull();
    expect(
      parseArgs(123, [
        'java',
        '-Dmcp.debugger.jvm=true',
        '-Dmcp.debugger.owner_pid=-5',
      ]),
    ).toBeNull();
  });

  it('returns a full TaggedJvm when marker + owner_pid + session_tag are all present', () => {
    const result = parseArgs(9001, [
      'java',
      '-Dmcp.debugger.jvm=true',
      '-Dmcp.debugger.owner_pid=42',
      '-Dmcp.debugger.session_tag=abc-123',
      'MyMain',
    ]);
    expect(result).toEqual({ pid: 9001, ownerPid: 42, sessionTag: 'abc-123' });
  });

  it('tolerates missing session_tag by leaving it empty', () => {
    const result = parseArgs(9001, [
      'java',
      '-Dmcp.debugger.jvm=true',
      '-Dmcp.debugger.owner_pid=42',
    ]);
    expect(result).toEqual({ pid: 9001, ownerPid: 42, sessionTag: '' });
  });

  it('ignores unrelated -D args', () => {
    const result = parseArgs(9001, [
      'java',
      '-Dfoo=bar',
      '-Dmcp.debugger.jvm=true',
      '-Djava.awt.headless=true',
      '-Dmcp.debugger.owner_pid=42',
      '-Dmcp.debugger.session_tag=tag',
    ]);
    expect(result).toEqual({ pid: 9001, ownerPid: 42, sessionTag: 'tag' });
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

describe('isPidAlive', () => {
  it('returns false for pid <= 0 without signalling', () => {
    const signal = vi.fn();
    expect(isPidAlive(0, signal)).toBe(false);
    expect(isPidAlive(-1, signal)).toBe(false);
    expect(signal).not.toHaveBeenCalled();
  });

  it('returns true when signalling pid 0 succeeds', () => {
    const signal = vi.fn();
    expect(isPidAlive(12345, signal)).toBe(true);
    expect(signal).toHaveBeenCalledWith(12345, 0);
  });

  it('returns true when the signal throws EPERM (process exists, no permission)', () => {
    expect(isPidAlive(12345, throwWith('EPERM'))).toBe(true);
  });

  it('returns false when the signal throws ESRCH (no such process)', () => {
    expect(isPidAlive(12345, throwWith('ESRCH'))).toBe(false);
  });

  it('returns false on unexpected error codes', () => {
    expect(isPidAlive(12345, throwWith('EINVAL'))).toBe(false);
  });
});

describe('defaultKill', () => {
  it('returns true when SIGKILL succeeds', () => {
    const signal = vi.fn();
    expect(defaultKill(9001, signal)).toBe(true);
    expect(signal).toHaveBeenCalledWith(9001, 'SIGKILL');
  });

  it('returns false on ESRCH (process already gone)', () => {
    expect(defaultKill(9001, throwWith('ESRCH'))).toBe(false);
  });

  it('returns false on EPERM (foreign-owned process)', () => {
    expect(defaultKill(9001, throwWith('EPERM'))).toBe(false);
  });

  it('rethrows on unexpected error codes', () => {
    expect(() => defaultKill(9001, throwWith('EINVAL'))).toThrow('EINVAL');
  });
});

describe('listLinux', () => {
  it('returns empty array when /proc readdir fails', async () => {
    mockReaddir.mockRejectedValueOnce(new Error('EACCES'));
    expect(await listLinux()).toEqual([]);
  });

  it('skips non-numeric entries in /proc', async () => {
    mockReaddir.mockResolvedValueOnce(['cpuinfo', 'self', 'cmdline', 'meminfo'] as never);
    expect(await listLinux()).toEqual([]);
    // None of the entries were numeric so no readFile calls should have happened
    expect(mockReadFile).not.toHaveBeenCalled();
  });

  it('skips PIDs whose cmdline read fails (process disappeared)', async () => {
    mockReaddir.mockResolvedValueOnce(['100', '200'] as never);
    mockReadFile.mockImplementation(async (path: unknown) => {
      if (String(path).includes('/100/')) {
        throw Object.assign(new Error('disappeared'), { code: 'ENOENT' });
      }
      // 200 is a non-matching cmdline
      return 'sh\0-c\0echo hi\0';
    });
    expect(await listLinux()).toEqual([]);
  });

  it('parses NUL-delimited cmdline and returns tagged JVMs', async () => {
    mockReaddir.mockResolvedValueOnce(['100', '200', 'self'] as never);
    mockReadFile.mockImplementation(async (path: unknown) => {
      const p = String(path);
      if (p.includes('/100/')) {
        return [
          'java',
          '-Dmcp.debugger.jvm=true',
          '-Dmcp.debugger.owner_pid=42',
          '-Dmcp.debugger.session_tag=tag-a',
          'MyMain',
        ].join('\0') + '\0';
      }
      if (p.includes('/200/')) {
        // Not a tagged JVM
        return 'bash\0-l\0';
      }
      return '';
    });
    const result = await listLinux();
    expect(result).toEqual([
      { pid: 100, ownerPid: 42, sessionTag: 'tag-a' },
    ]);
  });

  it('returns empty array when no /proc entries match the marker', async () => {
    mockReaddir.mockResolvedValueOnce(['100', '200'] as never);
    mockReadFile.mockResolvedValue('java\0-jar\0app.jar\0' as never);
    expect(await listLinux()).toEqual([]);
  });
});

describe('listDarwin', () => {
  // The reaper calls promisify(execFile) at module load. Tests drive the mock
  // by invoking the supplied callback. Promisify's default wrapper resolves
  // with the value passed as the second callback arg, so we pass an object
  // shaped like {stdout, stderr} for the destructuring on the receiving side.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const respondWith = (result: { stdout: string; stderr?: string }) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockExecFile.mockImplementation((..._args: any[]) => {
      // Last argument is the node-style callback
      const cb = _args[_args.length - 1] as (
        err: Error | null,
        result: { stdout: string; stderr: string },
      ) => void;
      cb(null, { stdout: result.stdout, stderr: result.stderr ?? '' });
    });

  it('parses tagged JVMs from ps output', async () => {
    respondWith({
      stdout: [
        '  100 java -Dmcp.debugger.jvm=true -Dmcp.debugger.owner_pid=42 -Dmcp.debugger.session_tag=tag-a MyMain',
        '  200 bash -l',
        '  300 java -Dmcp.debugger.jvm=true -Dmcp.debugger.owner_pid=99 -Dmcp.debugger.session_tag=tag-b OtherMain',
        '',
      ].join('\n'),
    });
    const result = await listDarwin();
    expect(result).toEqual([
      { pid: 100, ownerPid: 42, sessionTag: 'tag-a' },
      { pid: 300, ownerPid: 99, sessionTag: 'tag-b' },
    ]);
  });

  it('returns empty array when ps stdout is empty', async () => {
    respondWith({ stdout: '' });
    expect(await listDarwin()).toEqual([]);
  });

  it('skips lines that do not match the pid+command pattern', async () => {
    respondWith({
      stdout: ['garbage-line', '  ', '  not-a-pid bash', '\t\t'].join('\n'),
    });
    expect(await listDarwin()).toEqual([]);
  });

  it('tolerates trailing whitespace on each line', async () => {
    respondWith({
      stdout: '  100 java -Dmcp.debugger.jvm=true -Dmcp.debugger.owner_pid=42   \n',
    });
    expect(await listDarwin()).toEqual([
      { pid: 100, ownerPid: 42, sessionTag: '' },
    ]);
  });
});

describe('listWindows', () => {
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

  it('parses a JSON array of multiple tagged JVMs', async () => {
    respondWith({
      stdout: JSON.stringify([
        {
          ProcessId: 100,
          CommandLine:
            'java -Dmcp.debugger.jvm=true -Dmcp.debugger.owner_pid=42 -Dmcp.debugger.session_tag=tag-a MyMain',
        },
        {
          ProcessId: 200,
          CommandLine: 'java -Xmx2g MyOtherMain',
        },
        {
          ProcessId: 300,
          CommandLine:
            'java -Dmcp.debugger.jvm=true -Dmcp.debugger.owner_pid=99 -Dmcp.debugger.session_tag=tag-b',
        },
      ]),
    });
    const result = await listWindows();
    expect(result).toEqual([
      { pid: 100, ownerPid: 42, sessionTag: 'tag-a' },
      { pid: 300, ownerPid: 99, sessionTag: 'tag-b' },
    ]);
  });

  it('handles PowerShell single-object output (no array wrapper)', async () => {
    respondWith({
      stdout: JSON.stringify({
        ProcessId: 100,
        CommandLine:
          'java -Dmcp.debugger.jvm=true -Dmcp.debugger.owner_pid=42 -Dmcp.debugger.session_tag=only',
      }),
    });
    expect(await listWindows()).toEqual([
      { pid: 100, ownerPid: 42, sessionTag: 'only' },
    ]);
  });

  it('returns empty array when PowerShell errors out', async () => {
    respondWith({ err: new Error('powershell.exe not found') });
    expect(await listWindows()).toEqual([]);
  });

  it('returns empty array when stdout is empty/whitespace', async () => {
    respondWith({ stdout: '   \n  ' });
    expect(await listWindows()).toEqual([]);
  });

  it('returns empty array when stdout is not valid JSON', async () => {
    respondWith({ stdout: 'not json {{{' });
    expect(await listWindows()).toEqual([]);
  });

  it('skips entries with missing or wrong-typed ProcessId / CommandLine', async () => {
    respondWith({
      stdout: JSON.stringify([
        { ProcessId: 'not-a-number', CommandLine: 'java -Dmcp.debugger.jvm=true' },
        { ProcessId: 100 }, // CommandLine missing
        { CommandLine: 'java -Dmcp.debugger.jvm=true' }, // ProcessId missing
        null,
        'not-an-object',
        {
          ProcessId: 999,
          CommandLine:
            'java -Dmcp.debugger.jvm=true -Dmcp.debugger.owner_pid=7 -Dmcp.debugger.session_tag=only',
        },
      ]),
    });
    expect(await listWindows()).toEqual([
      { pid: 999, ownerPid: 7, sessionTag: 'only' },
    ]);
  });
});
