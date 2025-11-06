import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import { PassThrough } from 'stream';
import { ProcessLauncherImpl, ProxyProcessLauncherImpl } from '../../../src/implementations/process-launcher-impl.js';
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

describe('ProcessLauncherImpl', () => {
  let processManager: IProcessManager;
  let child: FakeChildProcess;

  beforeEach(() => {
    delete (process.env as Record<string, string | undefined>).MCP_CONTAINER;
    child = new FakeChildProcess(1234);
    processManager = {
      spawn: vi.fn().mockReturnValue(child),
      exec: vi.fn()
    } as unknown as IProcessManager;
  });

  it('wraps child process events and updates exit state', () => {
    const launcher = new ProcessLauncherImpl(processManager);
    const adapterProcess = launcher.launch('node', ['app.js']);

    const exitHandler = vi.fn();
    adapterProcess.on('exit', exitHandler);

    child.emit('exit', 0, null);

    expect(exitHandler).toHaveBeenCalledWith(0, null);
    expect(adapterProcess.exitCode).toBe(0);
  });

  it('falls back to killing the child when group kill fails', () => {
    const launcher = new ProcessLauncherImpl(processManager);
    const adapterProcess = launcher.launch('node', ['script.js']);

    const platformSpy = vi.spyOn(global.process, 'platform', 'get').mockReturnValue('linux');
    const killSpy = vi.spyOn(global.process, 'kill').mockImplementation(() => {
      throw new Error('group kill not supported');
    });

    const result = adapterProcess.kill('SIGTERM');

    expect(killSpy).toHaveBeenCalledWith(-child.pid!, 'SIGTERM');
    expect(child.kill).toHaveBeenCalledWith('SIGTERM');
    expect(result).toBe(true);

    platformSpy.mockRestore();
    killSpy.mockRestore();
  });

  it('kills child directly when running inside a container', () => {
    const originalContainer = process.env.MCP_CONTAINER;
    process.env.MCP_CONTAINER = 'true';

    const launcher = new ProcessLauncherImpl(processManager);
    const adapterProcess = launcher.launch('node', ['script.js']);

    const processKillSpy = vi.spyOn(global.process, 'kill');
    adapterProcess.kill('SIGTERM');

    expect(processKillSpy).not.toHaveBeenCalled();
    expect(child.kill).toHaveBeenCalledWith('SIGTERM');

    if (originalContainer === undefined) {
      delete (process.env as Record<string, string | undefined>).MCP_CONTAINER;
    } else {
      process.env.MCP_CONTAINER = originalContainer;
    }
  });

  it('returns false when child kill throws', () => {
    const launcher = new ProcessLauncherImpl(processManager);
    const adapterProcess = launcher.launch('node', ['script.js']);

    child.kill = vi.fn(() => {
      throw new Error('kill failed');
    });

    const result = adapterProcess.kill('SIGTERM');
    expect(result).toBe(false);
  });
});

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
    const launcher = new ProxyProcessLauncherImpl({} as any, processManager);
    const proxyProcess = launcher.launchProxy('./dist/proxy.js', 'session-1');

    const promise = proxyProcess.waitForInitialization(1000);

    child.emit('message', { type: 'status', status: 'adapter_configured_and_launched' });

    await expect(promise).resolves.toBeUndefined();
  });

  it('rejects initialization promise on early exit', async () => {
    const launcher = new ProxyProcessLauncherImpl({} as any, processManager);
    const proxyProcess = launcher.launchProxy('./dist/proxy.js', 'session-2');

    const promise = proxyProcess.waitForInitialization(100);

    child.emit('exit', 1, null);

    await expect(promise).rejects.toThrow(/exited/);
  });

  it('throws when child send fails', () => {
    child.send = vi.fn().mockReturnValue(false);

    const launcher = new ProxyProcessLauncherImpl({} as any, processManager);
    const proxyProcess = launcher.launchProxy('./dist/proxy.js', 'session-3');

    expect(() => proxyProcess.sendCommand({ foo: 'bar' })).toThrow(/Failed to send/);
  });

  it('scrubs testing environment variables before launching proxy', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalVitest = process.env.VITEST;
    const originalJestWorker = process.env.JEST_WORKER_ID;

    process.env.NODE_ENV = 'test';
    process.env.VITEST = 'true';
    process.env.JEST_WORKER_ID = '2';

    const spawnSpy = vi.spyOn(processManager, 'spawn');
    const launcher = new ProxyProcessLauncherImpl({} as any, processManager);
    launcher.launchProxy('./dist/proxy.js', 'session-env');

    const options = spawnSpy.mock.calls[0]?.[2] as any;
    expect(options.env.NODE_ENV).toBeUndefined();
    expect(options.env.VITEST).toBeUndefined();
    expect(options.env.JEST_WORKER_ID).toBeUndefined();

    if (originalNodeEnv === undefined) {
      delete (process.env as Record<string, string | undefined>).NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
    if (originalVitest === undefined) {
      delete (process.env as Record<string, string | undefined>).VITEST;
    } else {
      process.env.VITEST = originalVitest;
    }
    if (originalJestWorker === undefined) {
      delete (process.env as Record<string, string | undefined>).JEST_WORKER_ID;
    } else {
      process.env.JEST_WORKER_ID = originalJestWorker;
    }
  });

  it('disables process detaching when running inside a container', () => {
    const originalContainer = process.env.MCP_CONTAINER;
    process.env.MCP_CONTAINER = 'true';

    const spawnSpy = vi.spyOn(processManager, 'spawn');
    const platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');

    const launcher = new ProxyProcessLauncherImpl({} as any, processManager);
    launcher.launchProxy('./dist/proxy.js', 'session-container');

    const options = spawnSpy.mock.calls[0]?.[2] as any;
    expect(options.detached).toBe(false);

    platformSpy.mockRestore();
    if (originalContainer === undefined) {
      delete (process.env as Record<string, string | undefined>).MCP_CONTAINER;
    } else {
      process.env.MCP_CONTAINER = originalContainer;
    }
  });

  it('reuses initialization promise for concurrent callers', async () => {
    const launcher = new ProxyProcessLauncherImpl({} as any, processManager);
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
    const launcher = new ProxyProcessLauncherImpl({} as any, processManager);
    const proxyProcess = launcher.launchProxy('./dist/proxy.js', 'session-kill');

    const pending = proxyProcess.waitForInitialization(1000);

    child.kill = vi.fn().mockReturnValue(true);
    const killResult = proxyProcess.kill('SIGTERM');
    expect(killResult).toBe(true);

    await expect(pending).rejects.toThrow(/Process killed during initialization/);
    await expect(proxyProcess.waitForInitialization()).rejects.toThrow(/already completed or failed/);
  });

  it('fails initialization when process exits before wait is requested', async () => {
    const launcher = new ProxyProcessLauncherImpl({} as any, processManager);
    const proxyProcess = launcher.launchProxy('./dist/proxy.js', 'session-early-exit');

    child.emit('exit', 1, null);

    await expect(proxyProcess.waitForInitialization()).rejects.toThrow(/already completed or failed/);
  });

  it('returns false when child kill throws', () => {
    const launcher = new ProxyProcessLauncherImpl({} as any, processManager);
    const proxyProcess = launcher.launchProxy('./dist/proxy.js', 'session-kill-error');

    child.kill = vi.fn(() => {
      throw new Error('kill explosion');
    });

    const result = proxyProcess.kill('SIGTERM');
    expect(result).toBe(false);
  });
});
