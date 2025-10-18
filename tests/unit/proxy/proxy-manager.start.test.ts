import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import { ProxyManager } from '../../../src/proxy/proxy-manager.js';
import type { ProxyConfig } from '../../../src/proxy/proxy-config.js';
import { DebugLanguage, type IProxyProcess, type IProxyProcessLauncher, type IFileSystem, type ILogger } from '@debugmcp/shared';

class FakeProxyProcess extends EventEmitter implements IProxyProcess {
  pid = 4242;
  killed = false;
  exitCode: number | null = null;
  signalCode: string | null = null;
  stdin: NodeJS.WritableStream | null = null;
  stdout: NodeJS.ReadableStream | null = null;
  stderr: NodeJS.ReadableStream | null = new EventEmitter() as unknown as NodeJS.ReadableStream;

  send = vi.fn().mockReturnValue(true);
  sendCommand = vi.fn();
  kill = vi.fn().mockReturnValue(true);
  waitForInitialization = vi.fn().mockResolvedValue(undefined);
}

describe('ProxyManager.start', () => {
  let fakeProcess: FakeProxyProcess;
  let launchProxySpy: ReturnType<typeof vi.fn>;
  let proxyProcessLauncher: IProxyProcessLauncher;
  let fileSystem: IFileSystem;
  let logger: ILogger;
  let proxyManager: ProxyManager;

  beforeEach(() => {
    fakeProcess = new FakeProxyProcess();

    launchProxySpy = vi.fn().mockImplementation((_scriptPath: string, _sessionId: string) => {
      setImmediate(() => {
        fakeProcess.emit('spawn');
        fakeProcess.emit('message', { type: 'proxy-ready' });
      });
      return fakeProcess;
    });

    proxyProcessLauncher = {
      launchProxy: launchProxySpy
    } as unknown as IProxyProcessLauncher;

    fileSystem = {
      pathExists: vi.fn().mockResolvedValue(true)
    } as unknown as IFileSystem;

    logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    } as unknown as ILogger;

    proxyManager = new ProxyManager(
      null,
      proxyProcessLauncher,
      fileSystem,
      logger
    );
  });

  const baseConfig: ProxyConfig = {
    sessionId: 'session-123',
    language: DebugLanguage.JAVASCRIPT,
    executablePath: 'node',
    adapterHost: '127.0.0.1',
    adapterPort: 9229,
    logDir: './.tmp/logs',
    scriptPath: './tests/fixtures/app.js',
    dryRunSpawn: true
  };

  it('launches the proxy process and sends the init command', async () => {
    const startPromise = proxyManager.start(baseConfig);
    setTimeout(() => {
      proxyManager.emit('dry-run-complete', 'node --inspect', baseConfig.scriptPath);
    }, 150);

    await startPromise;

    expect(launchProxySpy).toHaveBeenCalled();
    expect(fakeProcess.sendCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        cmd: 'init',
        sessionId: baseConfig.sessionId,
        dryRunSpawn: true
      })
    );
  });

  it('attaches listeners for proxy messages and forwards status events', async () => {
    const listener = vi.fn();
    proxyManager.on('dry-run-complete', listener);
    const startPromise = proxyManager.start(baseConfig);

    const statusPayload = {
      type: 'status' as const,
      sessionId: baseConfig.sessionId,
      status: 'dry_run_complete' as const,
      command: 'node --inspect app.js',
      script: baseConfig.scriptPath
    };

    setTimeout(() => {
      proxyManager.emit('dry-run-complete', statusPayload.command, statusPayload.script);
    }, 150);

    await startPromise;

    listener.mockClear();

    fakeProcess.emit('message', statusPayload);

    expect(listener).toHaveBeenCalledWith(statusPayload.command, statusPayload.script);
  });
});
