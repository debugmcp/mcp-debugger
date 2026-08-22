import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import { PassThrough } from 'stream';
import { ProxyProcessLauncherImpl } from '../../../src/implementations/process-launcher-impl.js';
import type { IChildProcess, IProcessManager } from '@debugmcp/shared';

class FakeChildProcess extends EventEmitter implements IChildProcess {
  pid?: number;
  killed = false;
  stdin: NodeJS.WritableStream | null = null;
  stdout: NodeJS.ReadableStream | null = null;
  stderr: NodeJS.ReadableStream | null = null;

  constructor(pid?: number) {
    super();
    this.pid = pid;
    this.stderr = new PassThrough();
  }

  kill = vi.fn().mockReturnValue(true);
  send = vi.fn().mockReturnValue(true);
}

describe('ProxyProcessLauncherImpl', () => {
  let processManager: IProcessManager;
  let child: FakeChildProcess;

  beforeEach(() => {
    child = new FakeChildProcess(2222);
    processManager = {
      spawn: vi.fn().mockReturnValue(child),
      exec: vi.fn()
    } as unknown as IProcessManager;
  });

  it('creates a proxy process adapter that resolves initialization messages', async () => {
    const launcher = new ProxyProcessLauncherImpl(processManager);
    const proxyProcess = launcher.launchProxy('./dist/proxy.js', 'session-1');

    const promise = proxyProcess.waitForInitialization(1000);

    child.emit('message', { type: 'status', status: 'adapter_configured_and_launched' });

    await expect(promise).resolves.toBeUndefined();
  });

  it('rejects initialization promise on early exit', async () => {
    const launcher = new ProxyProcessLauncherImpl(processManager);
    const proxyProcess = launcher.launchProxy('./dist/proxy.js', 'session-2');

    const promise = proxyProcess.waitForInitialization(100);

    child.emit('exit', 1, null);

    await expect(promise).rejects.toThrow(/exited/);
  });

  it('throws when child send fails', () => {
    child.send = vi.fn().mockReturnValue(false);

    const launcher = new ProxyProcessLauncherImpl(processManager);
    const proxyProcess = launcher.launchProxy('./dist/proxy.js', 'session-3');

    expect(() => proxyProcess.sendCommand({ foo: 'bar' })).toThrow(/Failed to send/);
  });

  it('scrubs testing environment variables before launching proxy', () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('VITEST', 'true');
    vi.stubEnv('JEST_WORKER_ID', '2');

    const spawnSpy = vi.spyOn(processManager, 'spawn');
    const launcher = new ProxyProcessLauncherImpl(processManager);
    launcher.launchProxy('./dist/proxy.js', 'session-env');

    const options = spawnSpy.mock.calls[0]?.[2] as any;
    expect(options.env.NODE_ENV).toBeUndefined();
    expect(options.env.VITEST).toBeUndefined();
    expect(options.env.JEST_WORKER_ID).toBeUndefined();
  });

  it('disables process detaching when running inside a container', () => {
    vi.stubEnv('MCP_CONTAINER', 'true');

    const spawnSpy = vi.spyOn(processManager, 'spawn');

    const launcher = new ProxyProcessLauncherImpl(processManager);
    launcher.launchProxy('./dist/proxy.js', 'session-container');

    const options = spawnSpy.mock.calls[0]?.[2] as any;
    expect(options.detached).toBe(false);
  });

  it('tags the worker argv with owner-pid and session-id markers after the script path (issue #343)', () => {
    vi.stubEnv('MCP_DEBUGGER_MAIN_PID', '4242');

    const spawnSpy = vi.spyOn(processManager, 'spawn');
    const launcher = new ProxyProcessLauncherImpl(processManager);
    launcher.launchProxy('./dist/proxy.js', 'session-tagged');

    const args = spawnSpy.mock.calls[0]?.[1] as string[];
    expect(args).toEqual([
      '--trace-uncaught',
      '--trace-exit',
      './dist/proxy.js',
      '--mcp-owner-pid=4242',
      '--mcp-session-id=session-tagged'
    ]);
  });

  it('falls back to process.pid for the owner marker when the env var is unset or garbage', () => {
    vi.stubEnv('MCP_DEBUGGER_MAIN_PID', 'not-a-pid');

    const spawnSpy = vi.spyOn(processManager, 'spawn');
    const launcher = new ProxyProcessLauncherImpl(processManager);
    launcher.launchProxy('./dist/proxy.js', 'session-fallback');

    const args = spawnSpy.mock.calls[0]?.[1] as string[];
    expect(args).toContain(`--mcp-owner-pid=${process.pid}`);
  });

  it('reuses initialization promise for concurrent callers', async () => {
    const launcher = new ProxyProcessLauncherImpl(processManager);
    const proxyProcess = launcher.launchProxy('./dist/proxy.js', 'session-concurrent');

    const promiseSpy = vi.spyOn(proxyProcess as any, 'createInitializationPromise');
    const first = proxyProcess.waitForInitialization(1000);
    const second = proxyProcess.waitForInitialization(500);
    expect(promiseSpy).toHaveBeenCalledTimes(1);
    expect(first).toBeInstanceOf(Promise);
    expect(second).toBeInstanceOf(Promise);

    child.emit('message', { type: 'status', status: 'adapter_configured_and_launched' });

    await expect(first).resolves.toBeUndefined();

    // Subsequent calls resolve immediately
    await expect(proxyProcess.waitForInitialization(100)).resolves.toBeUndefined();
  });

  it('marks initialization as failed when killed during wait', async () => {
    const launcher = new ProxyProcessLauncherImpl(processManager);
    const proxyProcess = launcher.launchProxy('./dist/proxy.js', 'session-kill');

    const pending = proxyProcess.waitForInitialization(1000);

    child.kill = vi.fn().mockReturnValue(true);
    const killResult = proxyProcess.kill('SIGTERM');
    expect(killResult).toBe(true);

    await expect(pending).rejects.toThrow(/Process killed during initialization/);
    await expect(proxyProcess.waitForInitialization()).rejects.toThrow(/already completed or failed/);
  });

  it('fails initialization when process exits before wait is requested', async () => {
    const launcher = new ProxyProcessLauncherImpl(processManager);
    const proxyProcess = launcher.launchProxy('./dist/proxy.js', 'session-early-exit');

    child.emit('exit', 1, null);

    await expect(proxyProcess.waitForInitialization()).rejects.toThrow(/already completed or failed/);
  });

  it('returns false when child kill throws', () => {
    const launcher = new ProxyProcessLauncherImpl(processManager);
    const proxyProcess = launcher.launchProxy('./dist/proxy.js', 'session-kill-error');

    child.kill = vi.fn(() => {
      throw new Error('kill explosion');
    });

    const result = proxyProcess.kill('SIGTERM');
    expect(result).toBe(false);
  });

  // On win32 any cross-process signal is TerminateProcess on the single PID,
  // which strands the detached js-debug adapter subtree (issue #431). kill()
  // must sweep the worker's tree first, while the worker is still alive.
  describe('win32 tree-kill on kill()', () => {
    it('tree-kills via the injected treeKill before terminating the worker on win32', () => {
      const treeKill = vi.fn();
      const launcher = new ProxyProcessLauncherImpl(processManager, 'win32', treeKill);
      const proxyProcess = launcher.launchProxy('./dist/proxy.js', 'session-tree');

      const result = proxyProcess.kill('SIGKILL');

      expect(result).toBe(true);
      expect(treeKill).toHaveBeenCalledWith(2222);
      expect(child.kill).toHaveBeenCalledWith('SIGKILL');
      // Tree-kill must strike first: taskkill /T can only discover children
      // while the parent is alive.
      expect(treeKill.mock.invocationCallOrder[0]).toBeLessThan(
        (child.kill as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0]
      );
    });

    it('does not tree-kill when the worker already exited (PID may be recycled)', () => {
      const treeKill = vi.fn();
      const launcher = new ProxyProcessLauncherImpl(processManager, 'win32', treeKill);
      const proxyProcess = launcher.launchProxy('./dist/proxy.js', 'session-tree-exited');

      child.emit('exit', 0, null);
      proxyProcess.kill('SIGKILL');

      expect(treeKill).not.toHaveBeenCalled();
    });

    it('does not tree-kill on POSIX platforms', () => {
      const treeKill = vi.fn();
      const launcher = new ProxyProcessLauncherImpl(processManager, 'linux', treeKill);
      const proxyProcess = launcher.launchProxy('./dist/proxy.js', 'session-tree-posix');

      proxyProcess.kill('SIGKILL');

      expect(treeKill).not.toHaveBeenCalled();
      expect(child.kill).toHaveBeenCalledWith('SIGKILL');
    });

    it('still terminates the worker when treeKill throws', () => {
      const treeKill = vi.fn(() => {
        throw new Error('taskkill missing');
      });
      const launcher = new ProxyProcessLauncherImpl(processManager, 'win32', treeKill);
      const proxyProcess = launcher.launchProxy('./dist/proxy.js', 'session-tree-throw');

      const result = proxyProcess.kill('SIGKILL');

      expect(result).toBe(true);
      expect(child.kill).toHaveBeenCalledWith('SIGKILL');
    });

    it('spawns taskkill /PID <pid> /T /F via the process manager by default on win32', () => {
      const spawnSpy = vi.spyOn(processManager, 'spawn');
      const launcher = new ProxyProcessLauncherImpl(processManager, 'win32');
      const proxyProcess = launcher.launchProxy('./dist/proxy.js', 'session-tree-default');
      spawnSpy.mockClear();

      proxyProcess.kill('SIGKILL');

      expect(spawnSpy).toHaveBeenCalledWith(
        'taskkill',
        ['/PID', '2222', '/T', '/F'],
        expect.objectContaining({ windowsHide: true })
      );
    });
  });
});
