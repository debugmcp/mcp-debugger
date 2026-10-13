import { describe, expect, it, vi } from 'vitest';
import { runCommand } from '../../../tools/dev-proxy/command-runner.mjs';
import { ensurePortFree, forceKillPid, windowsListenerPid } from '../../../tools/dev-proxy/process-cleanup.mjs';

const output = (stdout = '') => ({ stdout, stderr: '' });
const wait = async () => {};
const listener = '  TCP    127.0.0.1:3016    0.0.0.0:0    LISTENING    1234\r\n';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

describe('bounded asynchronous lifecycle commands', () => {
  it('returns separate stdout/stderr and passes literal arguments without a shell', async () => {
    const literal = 'spaces & $(literal) "quotes"';
    const result = await runCommand(process.execPath, ['-e',
      'process.stdout.write(process.argv[1]); process.stderr.write("diagnostic");', literal]);
    expect(result).toEqual({ stdout: literal, stderr: 'diagnostic' });
  });

  it('rejects unavailable executables and bounds a stalled command', async () => {
    await expect(runCommand('mcp-debugger-nonexistent-command-799', [])).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(runCommand(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { timeout: 30 }))
      .rejects.toMatchObject({ killed: true });
  });
});

describe('Windows listener selection', () => {
  it.each([
    [listener, 3016, 1234],
    [' TCP [::]:3016 [::]:0 LISTENING 56\n', 3016, 56],
    [' TCP [::1]:3016 [::]:0 LISTENING 57\n', 3016, 57],
    [' TCP 0.0.0.0:30160 0.0.0.0:0 LISTENING 99\n' + listener, 3016, 1234],
    [' TCP 127.0.0.1:1234 127.0.0.1:3016 ESTABLISHED 99\n', 3016, null],
    [' UDP 0.0.0.0:3016 *:* 99\n', 3016, null],
    [' TCP 0.0.0.0:3016 0.0.0.0:0 LISTENING 0\n', 3016, null],
    [' TCP 0.0.0.0:3016 0.0.0.0:0 LISTENING invalid\n', 3016, null],
    [' TCP 0.0.0.0:3016 0.0.0.0:0 LISTENING 999999999999999999\n', 3016, null],
    ['Active Connections\r\n  Proto Local Address Foreign Address State PID\r\n', 3016, null],
  ])('selects only an exact local TCP listener (%#)', (text, port, pid) => {
    expect(windowsListenerPid(text, port)).toBe(pid);
  });
});

describe('owned process cleanup', () => {
  it('rechecks stdio ownership after the grace period, before dispatching a kill', async () => {
    const grace = deferred<void>();
    const runFile = vi.fn(async () => output());
    let owned = true;
    const pending = forceKillPid(1234, {
      platform: 'win32', runFile, stillOwned: () => owned, wait: () => grace.promise,
    });
    expect(runFile).not.toHaveBeenCalled();
    owned = false;
    grace.resolve();
    await pending;
    expect(runFile).not.toHaveBeenCalled();
  });

  it('awaits Windows taskkill while the event loop remains available', async () => {
    const command = deferred<ReturnType<typeof output>>();
    const runFile = vi.fn(() => command.promise);
    let completed = false;
    const pending = forceKillPid(1234, { platform: 'win32', runFile, wait })
      .then(() => { completed = true; });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(runFile).toHaveBeenCalledWith('taskkill', ['/pid', '1234', '/F']);
    expect(completed).toBe(false);
    command.resolve(output());
    await pending;
  });

  it('never dispatches for a missing PID and tolerates an already-gone process', async () => {
    const runFile = vi.fn(async () => { throw new Error('already gone'); });
    await forceKillPid(null, { runFile, wait });
    expect(runFile).not.toHaveBeenCalled();
    await expect(forceKillPid(1234, { platform: 'win32', runFile, wait })).resolves.toBeUndefined();
    const kill = vi.fn(() => { throw Object.assign(new Error('gone'), { code: 'ESRCH' }); });
    await forceKillPid(1234, { platform: 'linux', kill, wait });
    expect(kill).toHaveBeenCalledExactlyOnceWith(1234, 0);
  });

  it('uses the existing POSIX liveness check before SIGKILL', async () => {
    const kill = vi.fn();
    await forceKillPid(1234, { platform: 'linux', kill, wait });
    expect(kill.mock.calls).toEqual([[1234, 0], [1234, 'SIGKILL']]);
  });
});

describe('asynchronous legacy port cleanup', () => {
  it('waits for the probe and kill, keeping timers available throughout', async () => {
    const probe = deferred<ReturnType<typeof output>>();
    const killed = deferred<void>();
    const runFile = vi.fn(async (command: string) => command === 'netstat' ? probe.promise : output('"node.exe","1234"'));
    const forceKill = vi.fn(() => killed.promise);
    let completed = false;
    const pending = ensurePortFree({ port: 3016, platform: 'win32', runFile, forceKill, wait })
      .then(() => { completed = true; });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(completed).toBe(false);
    expect(forceKill).not.toHaveBeenCalled();
    probe.resolve(output(listener));
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(forceKill).toHaveBeenCalledExactlyOnceWith(1234);
    expect(completed).toBe(false);
    killed.resolve();
    await pending;
    expect(runFile.mock.calls).toEqual([
      ['netstat', ['-ano']], ['tasklist', ['/fi', 'PID eq 1234', '/fo', 'csv', '/nh']],
    ]);
  });

  it('keeps the non-node Windows process guard', async () => {
    const runFile = vi.fn(async (command: string) => output(command === 'netstat' ? listener : '"python.exe","1234"'));
    const forceKill = vi.fn(async () => {});
    const log = vi.fn();
    await ensurePortFree({ port: 3016, platform: 'win32', runFile, forceKill, wait, log });
    expect(forceKill).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(expect.stringContaining('non-node PID 1234'));
  });

  it('preserves the fallback when tasklist is unavailable', async () => {
    const runFile = vi.fn(async (command: string) => {
      if (command === 'tasklist') throw new Error('unavailable');
      return output(listener);
    });
    const forceKill = vi.fn(async () => {});
    await ensurePortFree({ port: 3016, platform: 'win32', runFile, forceKill, wait });
    expect(forceKill).toHaveBeenCalledExactlyOnceWith(1234);
  });

  it.each(['', 'garbage\n'])('ignores empty or invalid Unix probe results (%#)', async stdout => {
    const runFile = vi.fn(async () => output(stdout));
    const forceKill = vi.fn(async () => {});
    await ensurePortFree({ port: 3016, platform: 'linux', runFile, forceKill, wait });
    expect(forceKill).not.toHaveBeenCalled();
  });

  it('uses argument-array lsof and the first listener on Unix', async () => {
    const runFile = vi.fn(async () => output('1234\n5678\n'));
    const forceKill = vi.fn(async () => {});
    await ensurePortFree({ port: 3016, platform: 'linux', runFile, forceKill, wait });
    expect(runFile).toHaveBeenCalledExactlyOnceWith('lsof', ['-ti', 'tcp:3016', '-sTCP:LISTEN']);
    expect(forceKill).toHaveBeenCalledExactlyOnceWith(1234);
  });

  it('tolerates missing probe commands and does not kill without a listener', async () => {
    const forceKill = vi.fn(async () => {});
    await ensurePortFree({ port: 3016, platform: 'win32', runFile: async () => output(''), forceKill, wait });
    await ensurePortFree({ port: 3016, platform: 'linux', runFile: async () => { throw new Error('ENOENT'); }, forceKill, wait });
    expect(forceKill).not.toHaveBeenCalled();
  });
});
