import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChildProcess } from 'node:child_process';
import { PassThrough } from 'node:stream';
import { runBuild, terminateBuildTree, type BuildOptions } from '../../../tools/dev-proxy/build-runner.mjs';

afterEach(() => vi.useRealTimers());

function fixture(overrides: Partial<BuildOptions> = {}) {
  const child = Object.assign(new ChildProcess(), {
    pid: 4242,
    stdout: new PassThrough(),
    stderr: new PassThrough(),
  });
  const spawnProcess = vi.fn(() => child);
  const terminateTree = vi.fn(async () => { child.emit('close', null, 'SIGTERM'); });
  const options: BuildOptions = {
    command: 'test-build', cwd: process.cwd(), timeoutMs: 1000,
    spawnProcess, terminateTree, ...overrides,
  };
  return { child, spawnProcess, terminateTree, options };
}

describe('asynchronous dev-proxy build runner', () => {
  it('owns a POSIX shell group and sanitizes output across chunk boundaries', async () => {
    const { child, spawnProcess, options } = fixture({ platform: 'linux', env: { PROBE: 'yes' } });
    const result = runBuild(options);
    child.stdout.write('GITHUB_P');
    child.stdout.write(`AT=ghp_${'a'.repeat(30)}\nfinished\n`);
    child.emit('close', 0, null);
    expect(await result).toBe('[REDACTED — line contained sensitive data]\nfinished');
    expect(spawnProcess).toHaveBeenCalledWith('test-build', expect.objectContaining({
      shell: true, detached: true, env: { PROBE: 'yes' }, stdio: ['ignore', 'pipe', 'pipe'],
    }));
  });

  it('preserves stdout and stderr diagnostics for a nonzero exit', async () => {
    const { child, options } = fixture();
    const result = runBuild(options);
    const assertion = expect(result).rejects.toThrow('Build failed: compile failed\nmissing dependency');
    child.stdout.write('compile failed\n');
    child.stderr.write('missing dependency\n');
    child.emit('close', 1, null);
    await assertion;
  });

  it('keeps the Windows shell in the tree that taskkill will own', async () => {
    const { child, spawnProcess, options } = fixture({ platform: 'win32' });
    const result = runBuild(options);
    child.emit('close', 0, null);
    await result;
    expect(spawnProcess).toHaveBeenCalledWith('test-build', expect.objectContaining({
      shell: true, detached: false, windowsHide: true,
    }));
  });

  it('names the exit code when a failed command produced no output', async () => {
    const { child, options } = fixture();
    const result = runBuild(options);
    const assertion = expect(result).rejects.toThrow('Build failed: Command exited with code 7');
    child.emit('close', 7, null);
    await assertion;
  });

  it('reports both synchronous spawn failure and an asynchronous spawn error', async () => {
    await expect(runBuild(fixture({ spawnProcess: () => { throw new Error('spawn failed'); } }).options))
      .rejects.toThrow('Build failed: spawn failed');
    const { child, options } = fixture();
    const result = runBuild(options);
    const assertion = expect(result).rejects.toThrow('Build failed: spawn ENOENT');
    child.emit('error', new Error('spawn ENOENT'));
    await assertion;
  });

  it('bounds combined output and distinguishes overflow from a timeout', async () => {
    const { child, terminateTree, options } = fixture({ maxBufferBytes: 8 });
    const result = runBuild(options);
    const assertion = expect(result).rejects.toThrow('Build failed: Build output exceeded 8 bytes');
    child.stdout.write('12345');
    child.stderr.write('67890');
    await assertion;
    expect(terminateTree).toHaveBeenCalledTimes(1);
  });

  it('reports the configured timeout and sanitized output after terminating the tree', async () => {
    vi.useFakeTimers();
    const { child, terminateTree, options } = fixture();
    const result = runBuild(options);
    const assertion = expect(result).rejects.toThrow(/Build timed out after 1s.*\nstep three/s);
    child.stdout.write('step three\n');
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
    expect(terminateTree).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('caps a timeout beyond the timer range instead of expiring it at once', async () => {
    const { child, terminateTree, options } = fixture({ timeoutMs: 9_999_999_999 });
    const result = runBuild(options);
    // An unclamped delay overflows to 1 ms and would cancel the build here.
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(terminateTree).not.toHaveBeenCalled();
    child.emit('close', 0, null);
    await expect(result).resolves.toBe('');
  });

  it('tells tree termination whether the shell has already exited', async () => {
    const running = fixture({ platform: 'win32', maxBufferBytes: 1 });
    const first = expect(runBuild(running.options)).rejects.toThrow('Build output exceeded');
    running.child.stdout.write('xx');
    await first;
    expect(running.terminateTree).toHaveBeenCalledWith(4242, { platform: 'win32', exited: false });

    const exited = fixture({ platform: 'win32', maxBufferBytes: 1 });
    const second = expect(runBuild(exited.options)).rejects.toThrow('Build output exceeded');
    // The shell exited, but a descendant still holds the output pipe open.
    Object.assign(exited.child, { exitCode: 0 });
    exited.child.stdout.write('xx');
    await second;
    expect(exited.terminateTree).toHaveBeenCalledWith(4242, { platform: 'win32', exited: true });
  });

  it('does not spawn after shutdown and removes its abort listener on success', async () => {
    const controller = new AbortController();
    controller.abort();
    const f = fixture({ signal: controller.signal });
    await expect(runBuild(f.options)).rejects.toThrow('Build cancelled');
    expect(f.spawnProcess).not.toHaveBeenCalled();

    const active = new AbortController();
    const completed = fixture({ signal: active.signal });
    const result = runBuild(completed.options);
    completed.child.emit('close', 0, null);
    await result;
    active.abort();
    expect(completed.terminateTree).not.toHaveBeenCalled();
  });

  it('waits for tree cleanup even when the shell closes before its descendants', async () => {
    const controller = new AbortController();
    let release!: () => void;
    const terminateTree = vi.fn(() => new Promise<void>(resolve => { release = resolve; }));
    const { child, options } = fixture({ signal: controller.signal, terminateTree });
    let settled = false;
    const result = runBuild(options).catch(error => { settled = true; throw error; });
    const assertion = expect(result).rejects.toThrow('Build cancelled');
    controller.abort();
    await Promise.resolve();
    child.emit('close', null, 'SIGTERM');
    await Promise.resolve();
    expect(settled).toBe(false);
    release();
    await assertion;
  });

  it('bounds waiting for inherited pipes after tree termination', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const { child, options } = fixture({ signal: controller.signal, terminateTree: async () => {} });
    const assertion = expect(runBuild(options)).rejects.toThrow('Build cancelled');
    controller.abort();
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
    expect(child.stdout.destroyed).toBe(true);
    expect(child.stderr.destroyed).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('reports sanitized cleanup failures without replacing the original timeout', async () => {
    vi.useFakeTimers();
    const { options } = fixture({ terminateTree: async () => {
      throw new Error(`GITHUB_PAT=ghp_${'a'.repeat(30)}`);
    } });
    const result = runBuild(options).catch((error: Error) => error.message);
    await vi.advanceTimersByTimeAsync(2000);
    const message = await result;
    expect(message).toContain('Build timed out after 1s');
    expect(message).toContain('Build process cleanup failed: [REDACTED');
    expect(message).not.toContain('ghp_');
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('build process tree termination', () => {
  it('escalates against the POSIX group, even if its shell has already exited', async () => {
    const kill = vi.fn();
    await terminateBuildTree(4242, { platform: 'linux', kill, graceMs: 0 });
    expect(kill.mock.calls).toEqual([[-4242, 'SIGTERM'], [-4242, 'SIGKILL']]);
  });

  it('ignores an already-gone group, but reports an actual kill failure', async () => {
    const kill = vi.fn(() => { throw Object.assign(new Error('gone'), { code: 'ESRCH' }); });
    await terminateBuildTree(4242, { platform: 'linux', kill });
    expect(kill).toHaveBeenCalledTimes(1);
    await expect(terminateBuildTree(4242, {
      platform: 'linux', kill: () => { throw new Error('permission denied'); },
    })).rejects.toThrow('permission denied');
  });

  it('uses a bounded Windows tree kill before the parent can disappear', async () => {
    const runFile = vi.fn(async () => {});
    await terminateBuildTree(4242, { platform: 'win32', runFile });
    expect(runFile).toHaveBeenCalledWith('taskkill', ['/PID', '4242', '/T', '/F'], {
      windowsHide: true, timeout: 5000, killSignal: 'SIGKILL',
    });
    runFile.mockRejectedValueOnce(Object.assign(new Error('gone'), { code: 128 }));
    await expect(terminateBuildTree(4242, { platform: 'win32', runFile })).resolves.toBeUndefined();
    runFile.mockRejectedValueOnce(new Error('taskkill failed'));
    await expect(terminateBuildTree(4242, { platform: 'win32', runFile })).rejects.toThrow('taskkill failed');
  });

  it('never sweeps a Windows PID whose shell has already exited, since it may be reused', async () => {
    const runFile = vi.fn(async () => {});
    await terminateBuildTree(4242, { platform: 'win32', runFile, exited: true });
    expect(runFile).not.toHaveBeenCalled();
    // A POSIX group cannot be reused while any member lives, so it is still swept.
    const kill = vi.fn();
    await terminateBuildTree(4242, { platform: 'linux', kill, graceMs: 0, exited: true });
    expect(kill.mock.calls).toEqual([[-4242, 'SIGTERM'], [-4242, 'SIGKILL']]);
  });
});
