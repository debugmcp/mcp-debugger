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
});
