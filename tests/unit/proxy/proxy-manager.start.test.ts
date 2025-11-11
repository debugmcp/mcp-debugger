import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { ProxyManager } from '../../../src/proxy/proxy-manager.js';
import { createInitialState } from '../../../src/dap-core/index.js';
import type { ProxyConfig } from '../../../src/proxy/proxy-config.js';
import { DebugLanguage, type IProxyProcess, type IProxyProcessLauncher, type IFileSystem, type ILogger, type IDebugAdapter } from '@debugmcp/shared';

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

    // Default mock implementation for sendCommand to handle init-received
    fakeProcess.sendCommand.mockImplementation((cmd: any) => {
      if (cmd.cmd === 'init') {
        process.nextTick(() => {
          fakeProcess.emit('message', {
            type: 'status',
            status: 'init_received',
            sessionId: cmd.sessionId
          });
          // Also emit dry-run-complete for dry run mode
          if (cmd.dryRunSpawn) {
            setImmediate(() => {
              fakeProcess.emit('message', {
                type: 'status',
                status: 'dry_run_complete',
                sessionId: cmd.sessionId,
                command: 'node --inspect',
                script: './tests/fixtures/app.js'
              });
            });
          }
        });
      }
    });

    launchProxySpy = vi.fn().mockImplementation((_scriptPath: string, _sessionId: string) => {
      setImmediate(() => {
        fakeProcess.emit('spawn');
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

  const completeStart = async (config: ProxyConfig = baseConfig): Promise<void> => {
    // Default mock in beforeEach handles init-received
    await proxyManager.start(config);
    (proxyManager as unknown as { isInitialized: boolean }).isInitialized = true;
  };

  it('launches the proxy process and sends the init command', async () => {
    // Default mock in beforeEach handles init-received
    await proxyManager.start(baseConfig);

    expect(launchProxySpy).toHaveBeenCalled();
    expect(fakeProcess.sendCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        cmd: 'init',
        sessionId: baseConfig.sessionId,
        dryRunSpawn: true
      })
    );
  });

  it('throws immediately if start is invoked while a proxy is already running', async () => {
    (proxyManager as unknown as { proxyProcess: IProxyProcess | null }).proxyProcess = fakeProcess;

    await expect(proxyManager.start(baseConfig)).rejects.toThrow('Proxy already running');
  });

  it('records adapter command snapshot for dry-run completion', async () => {
    const config: ProxyConfig = {
      ...baseConfig,
      dryRunSpawn: false,
      adapterCommand: {
        command: 'node',
        args: ['--inspect', 'app.js']
      }
    };

    fakeProcess.sendCommand.mockImplementation((cmd: any) => {
      if (cmd.cmd === 'init') {
        setTimeout(() => {
          fakeProcess.emit('message', {
            type: 'status',
            status: 'init_received',
            sessionId: cmd.sessionId
          });
          setTimeout(() => {
            fakeProcess.emit('message', {
              type: 'status',
              status: 'adapter_configured_and_launched',
              sessionId: cmd.sessionId
            });
          }, 0);
        }, 0);
      }
    });

    await proxyManager.start(config);

    const snapshot = proxyManager.getDryRunSnapshot();
    expect(snapshot?.command).toBe('node --inspect app.js');
    expect(snapshot?.script).toBe(baseConfig.scriptPath);
  });

  it('falls back to executable snapshot when adapter command is empty', async () => {
    const config: ProxyConfig = {
      ...baseConfig,
      dryRunSpawn: false,
      adapterCommand: {
        command: '',
        args: []
      }
    };

    fakeProcess.sendCommand.mockImplementation((cmd: any) => {
      if (cmd.cmd === 'init') {
        setTimeout(() => {
          fakeProcess.emit('message', {
            type: 'status',
            status: 'init_received',
            sessionId: cmd.sessionId
          });
          setTimeout(() => {
            fakeProcess.emit('message', {
              type: 'status',
              status: 'adapter_configured_and_launched',
              sessionId: cmd.sessionId
            });
          }, 0);
        }, 0);
      }
    });

    await proxyManager.start(config);
    expect(proxyManager.getDryRunSnapshot()?.command).toBe(baseConfig.executablePath);
  });

  it('ignores adapter command when command value is not a string', async () => {
    const config: ProxyConfig = {
      ...baseConfig,
      dryRunSpawn: false,
      adapterCommand: {
        // Truthy but filtered from the parts array
        command: { command: 'invalid' },
        args: [undefined, '']
      }
    };

    fakeProcess.sendCommand.mockImplementation((cmd: any) => {
      if (cmd.cmd === 'init') {
        setTimeout(() => {
          fakeProcess.emit('message', {
            type: 'status',
            status: 'init_received',
            sessionId: cmd.sessionId
          });
          setTimeout(() => {
            fakeProcess.emit('message', {
              type: 'status',
              status: 'adapter_configured_and_launched',
              sessionId: cmd.sessionId
            });
          }, 0);
        }, 0);
      }
    });

    await proxyManager.start(config);
    expect(proxyManager.getDryRunSnapshot()?.command).toBeUndefined();
  });

  it('fails to start when adapter environment validation fails', async () => {
    const adapter = {
      language: DebugLanguage.PYTHON,
      validateEnvironment: vi.fn().mockResolvedValue({
        valid: false,
        errors: [{ message: 'Missing Python runtime' }],
        warnings: []
      }),
      resolveExecutablePath: vi.fn()
    } as unknown as IDebugAdapter;

    proxyManager = new ProxyManager(
      adapter,
      proxyProcessLauncher,
      fileSystem,
      logger
    );

    const config: ProxyConfig = {
      ...baseConfig,
      executablePath: undefined
    };

    await expect(proxyManager.start(config)).rejects.toThrow(/Invalid environment.*Missing Python runtime/);
    expect(adapter.validateEnvironment).toHaveBeenCalled();
    expect(adapter.resolveExecutablePath).not.toHaveBeenCalled();
    expect(launchProxySpy).not.toHaveBeenCalled();
  });

  it('fails to start when executable resolution throws', async () => {
    const adapter = {
      language: DebugLanguage.PYTHON,
      validateEnvironment: vi.fn().mockResolvedValue({
        valid: true,
        errors: [],
        warnings: []
      }),
      resolveExecutablePath: vi.fn().mockRejectedValue(new Error('resolution failed'))
    } as unknown as IDebugAdapter;

    proxyManager = new ProxyManager(
      adapter,
      proxyProcessLauncher,
      fileSystem,
      logger
    );

    const config: ProxyConfig = {
      ...baseConfig,
      executablePath: undefined
    };

    await expect(proxyManager.start(config)).rejects.toThrow('resolution failed');
    expect(adapter.validateEnvironment).toHaveBeenCalled();
    expect(adapter.resolveExecutablePath).toHaveBeenCalled();
    expect(launchProxySpy).not.toHaveBeenCalled();
  });

  describe('init retry handling', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('retries init command after transient send failure', async () => {
      fakeProcess.sendCommand.mockReset();
      fakeProcess.sendCommand
        .mockImplementationOnce(() => {
          throw new Error('ipc send failure');
        })
        .mockImplementation((cmd: any) => {
          if (cmd.cmd === 'init') {
            setTimeout(() => {
              fakeProcess.emit('message', {
                type: 'status',
                status: 'init_received',
                sessionId: cmd.sessionId
              });
              setTimeout(() => {
                fakeProcess.emit('message', {
                  type: 'status',
                  status: 'dry_run_complete',
                  sessionId: cmd.sessionId,
                  command: 'node --inspect',
                  script: './tests/fixtures/app.js'
                });
              }, 0);
            }, 0);
          }
        });

      const startPromise = proxyManager.start(baseConfig);

      await vi.runAllTimersAsync();
      await startPromise;

      expect(fakeProcess.sendCommand).toHaveBeenCalledTimes(2);
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Error sending init on attempt 1'));
    });

    it('surfaces detailed error after exhausting init retries', async () => {
      fakeProcess.sendCommand.mockReset();
      fakeProcess.sendCommand.mockImplementation(() => {
        throw new Error('ipc failure');
      });

      (proxyManager as unknown as {
        lastExitDetails: {
          code: number | null;
          signal: string | null;
          timestamp: number;
          capturedStderr: string[];
        };
      }).lastExitDetails = {
        code: 12,
        signal: 'SIGTERM',
        timestamp: Date.now(),
        capturedStderr: ['fatal: adapter crashed']
      };

      const startPromise = proxyManager.start(baseConfig);

      await vi.advanceTimersByTimeAsync(16500);

      await expect(startPromise).rejects.toThrow(/Failed to initialize proxy after 6 attempts\. Last error: ipc failure/);
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Error sending init on attempt 6'));
    });
  });

  it('times out when proxy never signals readiness', async () => {
    vi.useFakeTimers();
    fakeProcess.sendCommand.mockImplementation((cmd: any) => {
      if (cmd.cmd === 'init') {
        setTimeout(() => {
          fakeProcess.emit('message', {
            type: 'status',
            status: 'init_received',
            sessionId: cmd.sessionId
          });
        }, 0);
      }
    });

    const startPromise = proxyManager.start({
      ...baseConfig,
      dryRunSpawn: false
    });

    try {
      await vi.advanceTimersByTimeAsync(30000);
      await vi.runOnlyPendingTimersAsync();
      await Promise.resolve();
      await expect(startPromise).rejects.toThrow(/Debug proxy initialization did not complete within 30s/);
    } finally {
      vi.useRealTimers();
    }
  });

  it('resolves when dry-run proxy exits cleanly before reporting completion', async () => {
    fakeProcess.sendCommand.mockImplementation((cmd: any) => {
      if (cmd.cmd === 'init') {
        setTimeout(() => {
          fakeProcess.emit('message', {
            type: 'status',
            status: 'init_received',
            sessionId: cmd.sessionId
          });
          setTimeout(() => {
            fakeProcess.emit('exit', 0, null);
          }, 0);
        }, 0);
      }
    });

    await expect(proxyManager.start({ ...baseConfig, dryRunSpawn: true })).resolves.toBeUndefined();
  });

  it('rejects when proxy exits during initialization with captured stderr', async () => {
    const stderrEmitter = fakeProcess.stderr as unknown as EventEmitter;
    fakeProcess.sendCommand.mockImplementation((cmd: any) => {
      if (cmd.cmd === 'init') {
        setTimeout(() => {
          stderrEmitter.emit('data', Buffer.from('boot failure'));
          fakeProcess.emit('exit', 2, 'SIGTERM');
        }, 0);
      }
    });

    await expect(proxyManager.start({ ...baseConfig, dryRunSpawn: false })).rejects.toThrow(
      /Proxy exit details -> code=2 signal=SIGTERM stderr:\nboot failure/
    );
  });

  it('fails to start when bootstrap worker script is missing', async () => {
    (fileSystem.pathExists as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(false);

    await expect(proxyManager.start(baseConfig)).rejects.toThrow(/Bootstrap worker script not found/);
    expect(fileSystem.pathExists).toHaveBeenCalled();
    expect(launchProxySpy).not.toHaveBeenCalled();
  });

  it('throws when proxy launcher does not provide a pid', async () => {
    launchProxySpy.mockReturnValueOnce({
      sendCommand: vi.fn(),
      killed: false
    } as unknown as IProxyProcess);

    await expect(proxyManager.start(baseConfig)).rejects.toThrow('Proxy process is invalid or PID is missing');
  });

  describe('findProxyScript resolution', () => {
    const createManagerWithModuleUrl = (moduleUrl: string, pathExists = true) => {
      const fsMock = {
        pathExists: vi.fn().mockResolvedValue(pathExists)
      } as unknown as IFileSystem;

      return {
        manager: new ProxyManager(
          null,
          proxyProcessLauncher,
          fsMock,
          logger,
          {
            moduleUrl,
            cwd: () => '/runtime/cwd'
          }
        ),
        fsMock
      };
    };

    it('resolves proxy script when module lives under dist/', async () => {
      const moduleUrl = pathToFileURL(path.join(process.cwd(), 'fake', 'dist', 'proxy-manager.mjs')).href;
      const { manager, fsMock } = createManagerWithModuleUrl(moduleUrl);

      const scriptPath = await (manager as unknown as { findProxyScript: () => Promise<string> }).findProxyScript();

      const expectedPath = path.join(process.cwd(), 'fake', 'dist', 'proxy', 'proxy-bootstrap.js');
      expect(fsMock.pathExists).toHaveBeenCalledWith(expectedPath);
      expect(scriptPath).toBe(expectedPath);
    });

    it('resolves proxy script when module lives under dist/proxy/', async () => {
      const moduleUrl = pathToFileURL(path.join(process.cwd(), 'fake', 'dist', 'proxy', 'proxy-manager.mjs')).href;
      const { manager, fsMock } = createManagerWithModuleUrl(moduleUrl);

      const scriptPath = await (manager as unknown as { findProxyScript: () => Promise<string> }).findProxyScript();

      const expectedPath = path.join(process.cwd(), 'fake', 'dist', 'proxy', 'proxy-bootstrap.js');
      expect(fsMock.pathExists).toHaveBeenCalledWith(expectedPath);
      expect(scriptPath).toBe(expectedPath);
    });

    it('falls back to development layout when outside dist', async () => {
      const moduleUrl = pathToFileURL(path.join(process.cwd(), 'fake', 'src', 'proxy', 'proxy-manager.ts')).href;
      const { manager, fsMock } = createManagerWithModuleUrl(moduleUrl);

      const scriptPath = await (manager as unknown as { findProxyScript: () => Promise<string> }).findProxyScript();

      const expectedPath = path.join(process.cwd(), 'fake', 'dist', 'proxy', 'proxy-bootstrap.js');
      expect(fsMock.pathExists).toHaveBeenCalledWith(expectedPath);
      expect(scriptPath).toBe(expectedPath);
    });

    it('throws meaningful error when proxy script is missing', async () => {
      const moduleUrl = pathToFileURL(path.join(process.cwd(), 'fake', 'src', 'proxy', 'proxy-manager.ts')).href;
      const { manager } = createManagerWithModuleUrl(moduleUrl, false);

      await expect(
        (manager as unknown as { findProxyScript: () => Promise<string> }).findProxyScript()
      ).rejects.toThrow(/Bootstrap worker script not found/);
    });
  });

  describe('stop and cleanup behavior', () => {
    it('sends terminate and force kills when proxy does not exit in time', async () => {
      vi.useFakeTimers();

      (proxyManager as unknown as { proxyProcess: IProxyProcess | null }).proxyProcess = fakeProcess;
      (proxyManager as unknown as { sessionId: string | null }).sessionId = baseConfig.sessionId;

      fakeProcess.killed = false;
      fakeProcess.exitCode = null;
      fakeProcess.send.mockClear();
      fakeProcess.kill.mockClear();

      const stopPromise = proxyManager.stop();

      await vi.advanceTimersByTimeAsync(5000);
      await vi.runOnlyPendingTimersAsync();
      await stopPromise;

      expect(fakeProcess.send).toHaveBeenCalledWith({ cmd: 'terminate', sessionId: baseConfig.sessionId });
      expect(fakeProcess.kill).toHaveBeenCalledWith('SIGKILL');
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Timeout waiting for proxy exit'));

      vi.useRealTimers();
    });

    it('resolves immediately when proxy already exited', async () => {
      (proxyManager as unknown as { proxyProcess: IProxyProcess | null }).proxyProcess = fakeProcess;
      (proxyManager as unknown as { sessionId: string | null }).sessionId = baseConfig.sessionId;
      fakeProcess.killed = true;

      const stopPromise = proxyManager.stop();
      await stopPromise;

      expect(fakeProcess.send).not.toHaveBeenCalled();
      expect(fakeProcess.kill).not.toHaveBeenCalled();
    });

    it('cleanup rejects all pending requests and clears launch barrier', () => {
      const pendingReject = vi.fn();
      (proxyManager as unknown as { pendingDapRequests: Map<string, any> }).pendingDapRequests.set('req-1', {
        reject: pendingReject,
        resolve: vi.fn(),
        command: 'threads'
      });

      const barrier = {
        dispose: vi.fn()
      } as unknown as AdapterLaunchBarrier;
      (proxyManager as unknown as { setActiveLaunchBarrier: (b: AdapterLaunchBarrier, id: string) => void }).setActiveLaunchBarrier.call(
        proxyManager,
        barrier,
        'req-1'
      );

      (proxyManager as unknown as { cleanup: () => void }).cleanup();

      expect(pendingReject).toHaveBeenCalledWith(expect.any(Error));
      expect(barrier.dispose).toHaveBeenCalled();
      expect((proxyManager as unknown as { pendingDapRequests: Map<string, unknown> }).pendingDapRequests.size).toBe(0);
    });
  });

  describe('sendCommand diagnostics', () => {
    it('throws when proxy process is unavailable', () => {
      (proxyManager as unknown as { proxyProcess: IProxyProcess | null }).proxyProcess = null;
      expect(() => (proxyManager as unknown as { sendCommand: (cmd: object) => void }).sendCommand({ cmd: 'init' })).toThrow(
        'Proxy process not available'
      );
    });

    it('logs pre/post IPC details and handles transport errors', async () => {
      await completeStart();

      const childProcess = { connected: false, pid: 2222, killed: false };
      (fakeProcess as unknown as { childProcess: typeof childProcess }).childProcess = childProcess;

      fakeProcess.sendCommand.mockImplementationOnce(() => {
        childProcess.connected = true;
      });

      (proxyManager as unknown as { sendCommand: (cmd: object) => void }).sendCommand({ cmd: 'ping' });
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Command dispatched via proxy process'));

      fakeProcess.sendCommand.mockImplementation(() => {
        throw new Error('ipc failure');
      });

      expect(() => (proxyManager as unknown as { sendCommand: (cmd: object) => void }).sendCommand({ cmd: 'ping' })).toThrow(
        'ipc failure'
      );
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to send command (pid=2222'), expect.any(Error));
    });

    it('logs exit details when sending commands after proxy has exited', () => {
      (proxyManager as unknown as { proxyProcess: IProxyProcess | null }).proxyProcess = {
        killed: true,
        sendCommand: vi.fn()
      } as unknown as IProxyProcess;
      (proxyManager as unknown as { lastExitDetails: any }).lastExitDetails = {
        code: 5,
        signal: 'SIGTERM',
        timestamp: Date.now(),
        capturedStderr: ['fatal error']
      };

      expect(() => (proxyManager as unknown as { sendCommand: (cmd: object) => void }).sendCommand({ cmd: 'dap' })).toThrow(
        'Proxy process not available'
      );
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Attempted to send command after proxy unavailable. Last exit'),
        ['fatal error']
      );
    });

    it('logs generic availability error when exit details are missing', () => {
      (proxyManager as unknown as { proxyProcess: IProxyProcess | null }).proxyProcess = {
        killed: true,
        sendCommand: vi.fn()
      } as unknown as IProxyProcess;
      (proxyManager as unknown as { lastExitDetails: any }).lastExitDetails = undefined;

      expect(() => (proxyManager as unknown as { sendCommand: (cmd: object) => void }).sendCommand({ cmd: 'dap' })).toThrow(
        'Proxy process not available'
      );
      expect(logger.error).toHaveBeenCalledWith(
        '[ProxyManager] Attempted to send command but proxy process is not available (no exit details recorded).'
      );
    });
  });

  it('logs IPC telemetry and heartbeat events from setupEventHandlers', () => {
    const proxy = new EventEmitter() as unknown as IProxyProcess;
    (proxy as unknown as { sendCommand: (cmd: unknown) => void }).sendCommand = vi.fn();
    (proxy as unknown as { killed: boolean }).killed = false;
    (proxyManager as unknown as { proxyProcess: IProxyProcess | null }).proxyProcess = proxy;

    (proxyManager as unknown as { setupEventHandlers: () => void }).setupEventHandlers();

    proxy.emit('ipc-send-start', { pid: 1, connectedBefore: false, summary: 'init' });
    proxy.emit('ipc-send-complete', { pid: 1, connectedAfter: true, summary: 'init', queueSizeBefore: 0, queueSizeAfter: 0 });
    proxy.emit('ipc-send-failed', { pid: 1, killed: false, childProcessKilled: false, summary: 'init' });
    proxy.emit('ipc-send-error', { pid: 1, error: 'boom', summary: 'init' });
    (proxyManager as unknown as { handleProxyMessage: (msg: unknown) => void }).handleProxyMessage({
      type: 'ipc-heartbeat',
      counter: 1,
      timestamp: 123
    });
    (proxyManager as unknown as { handleProxyMessage: (msg: unknown) => void }).handleProxyMessage({
      type: 'ipc-heartbeat-tick',
      timestamp: 456
    });

    const debugMessages = logger.debug.mock.calls.map((call) => call[0]);
    expect(debugMessages).toContain(`[ProxyManager] IPC send start pid=1 connected=false summary=init`);
    expect(debugMessages).toContain(
      `[ProxyManager] IPC send complete pid=1 connected=true summary=init queueBefore=0 queueAfter=0`
    );
    expect(logger.warn).toHaveBeenCalledWith(
      `[ProxyManager] IPC send returned false pid=1 killed=false childKilled=false summary=init`
    );
    expect(logger.error).toHaveBeenCalledWith(
      `[ProxyManager] IPC send error pid=1 error=boom summary=init`
    );
    expect(debugMessages).toContain(`[ProxyManager] Received worker heartbeat counter=1 timestamp=123`);
    expect(debugMessages).toContain(`[ProxyManager] Received worker heartbeat tick timestamp=456`);
  });

  describe('handleProxyExit', () => {
    it('emits synthesized dry-run completion when exit occurs without prior notification', () => {
      const dryRunListener = vi.fn();
      proxyManager.on('dry-run-complete', dryRunListener);

      (proxyManager as unknown as { isDryRun: boolean }).isDryRun = true;
      (proxyManager as unknown as { dryRunCommandSnapshot?: string }).dryRunCommandSnapshot = 'cmd';
      (proxyManager as unknown as { dryRunScriptPath?: string }).dryRunScriptPath = 'script';
      (proxyManager as unknown as { dryRunCompleteReceived: boolean }).dryRunCompleteReceived = false;

      (proxyManager as unknown as { handleProxyExit: (code: number | null, signal: string | null) => void }).handleProxyExit(0, null);

      expect(proxyManager.hasDryRunCompleted()).toBe(true);
      expect(dryRunListener).toHaveBeenCalledWith('cmd', 'script');
    });

    it('rejects pending requests and emits exit event for non-dry-run exits', () => {
      const exitListener = vi.fn();
      proxyManager.on('exit', exitListener);

      (proxyManager as unknown as { isDryRun: boolean }).isDryRun = false;
      (proxyManager as unknown as { pendingDapRequests: Map<string, any> }).pendingDapRequests.set('req', {
        reject: vi.fn(),
        resolve: vi.fn(),
        command: 'evaluate'
      });
      (proxyManager as unknown as { activeLaunchBarrier: AdapterLaunchBarrier | null }).activeLaunchBarrier = {
        awaitResponse: true,
        onRequestSent: vi.fn(),
        onProxyStatus: vi.fn(),
        onDapEvent: vi.fn(),
        onProxyExit: vi.fn(),
        waitUntilReady: vi.fn(),
        dispose: vi.fn()
      };
      (proxyManager as unknown as { activeLaunchBarrierRequestId: string | null }).activeLaunchBarrierRequestId = 'req';

      (proxyManager as unknown as { handleProxyExit: (code: number | null, signal: string | null) => void }).handleProxyExit(9, 'SIGTERM');

      expect(exitListener).toHaveBeenCalledWith(9, 'SIGTERM');
      expect((proxyManager as unknown as { pendingDapRequests: Map<string, any> }).pendingDapRequests.size).toBe(0);
      expect(
        (proxyManager as unknown as { activeLaunchBarrier: AdapterLaunchBarrier | null }).activeLaunchBarrier
      ).toBeNull();
    });
  });

  describe('launch barrier integration', () => {
    it('handles fire-and-forget barriers in sendDapRequest', async () => {
      const barrier = {
        awaitResponse: false,
        onRequestSent: vi.fn(),
        onProxyStatus: vi.fn(),
        onDapEvent: vi.fn(),
        onProxyExit: vi.fn(),
        waitUntilReady: vi.fn().mockResolvedValue(undefined),
        dispose: vi.fn()
      };
      const adapter = {
        language: DebugLanguage.JAVASCRIPT,
        validateEnvironment: vi.fn(),
        resolveExecutablePath: vi.fn(),
        createLaunchBarrier: vi.fn().mockReturnValue(barrier)
      } as unknown as IDebugAdapter;

      const manager = new ProxyManager(adapter, proxyProcessLauncher, fileSystem, logger);
      (manager as unknown as { proxyProcess: IProxyProcess | null }).proxyProcess = fakeProcess;
      (manager as unknown as { isInitialized: boolean }).isInitialized = true;
      (manager as unknown as { sessionId: string | null }).sessionId = 'barrier-session';

      fakeProcess.sendCommand.mockImplementation(() => undefined);

      const response = await manager.sendDapRequest('launch');

      expect(response).toEqual({});
      expect(barrier.onRequestSent).toHaveBeenCalled();
      expect(barrier.waitUntilReady).toHaveBeenCalled();
      expect(barrier.dispose).toHaveBeenCalled();
    });
  });

  it('attaches listeners for proxy messages and forwards status events', async () => {
    const listener = vi.fn();
    proxyManager.on('dry-run-complete', listener);

    const statusPayload = {
      type: 'status' as const,
      sessionId: baseConfig.sessionId,
      status: 'dry_run_complete' as const,
      command: 'node --inspect app.js',
      script: baseConfig.scriptPath
    };

    // Default mock in beforeEach handles init-received
    await proxyManager.start(baseConfig);

    listener.mockClear();

    fakeProcess.emit('message', statusPayload);

    expect(listener).toHaveBeenCalledWith(statusPayload.command, statusPayload.script);
  });

  it('emits lifecycle events when adapter-driven statuses arrive', async () => {
    const adapter = {
      language: DebugLanguage.PYTHON,
      validateEnvironment: vi.fn().mockResolvedValue({ valid: true, errors: [], warnings: [] }),
      resolveExecutablePath: vi.fn().mockResolvedValue('python-auto')
    } as unknown as IDebugAdapter;

    proxyManager = new ProxyManager(
      adapter,
      proxyProcessLauncher,
      fileSystem,
      logger
    );

    const config: ProxyConfig = {
      ...baseConfig,
      executablePath: undefined
    };

    const context = await (proxyManager as unknown as {
      prepareSpawnContext(cfg: ProxyConfig): Promise<{ executablePath: string }>;
    }).prepareSpawnContext(config);

    expect(adapter.validateEnvironment).toHaveBeenCalled();
    expect(adapter.resolveExecutablePath).toHaveBeenCalled();
    expect(context.executablePath).toBe('python-auto');

    const dryRun = vi.fn();
    const initialized = vi.fn();
    const adapterConfigured = vi.fn();
    const exit = vi.fn();
    proxyManager.on('dry-run-complete', dryRun);
    proxyManager.on('initialized', initialized);
    proxyManager.on('adapter-configured', adapterConfigured);
    proxyManager.on('exit', exit);

    (proxyManager as unknown as { sessionId: string | null }).sessionId = config.sessionId;

    (proxyManager as unknown as {
      handleStatusMessage: (msg: object) => void;
    }).handleStatusMessage({
      type: 'status',
      sessionId: config.sessionId,
      status: 'dry_run_complete',
      command: 'python-auto',
      script: config.scriptPath
    });

    expect(dryRun).toHaveBeenCalledWith('python-auto', config.scriptPath);

    (proxyManager as unknown as {
      handleStatusMessage: (msg: object) => void;
    }).handleStatusMessage({
      type: 'status',
      sessionId: config.sessionId,
      status: 'adapter_configured_and_launched'
    });

    expect(initialized).toHaveBeenCalled();
    expect(adapterConfigured).toHaveBeenCalled();

    (proxyManager as unknown as {
      handleStatusMessage: (msg: object) => void;
    }).handleStatusMessage({
      type: 'status',
      sessionId: config.sessionId,
      status: 'adapter_exited',
      code: 9,
      signal: 'SIGTERM'
    });

    expect(exit).toHaveBeenCalledWith(9, 'SIGTERM');
  });

  it('resolves DAP responses and captures thread ids', async () => {
    (proxyManager as unknown as { proxyProcess: IProxyProcess | null }).proxyProcess = fakeProcess;
    (proxyManager as unknown as { isInitialized: boolean }).isInitialized = true;
    (proxyManager as unknown as { sessionId: string | null }).sessionId = baseConfig.sessionId;
    (proxyManager as unknown as { dapState: ReturnType<typeof createInitialState> | null }).dapState =
      createInitialState(baseConfig.sessionId);

    fakeProcess.sendCommand.mockImplementation((payload) => {
      if (payload.cmd === 'dap') {
        (proxyManager as unknown as {
          handleProxyMessage: (message: object) => void;
        }).handleProxyMessage({
          type: 'dapResponse',
          sessionId: baseConfig.sessionId,
          requestId: payload.requestId,
          success: true,
          response: {
            type: 'response',
            seq: 10,
            request_seq: 5,
            command: payload.dapCommand,
            success: true,
            body: {
              threads: [{ id: 77, name: 'main' }]
            }
          }
        });
      }
    });

    const response = await proxyManager.sendDapRequest<any>('threads');

    expect(response.command).toBe('threads');
    expect(proxyManager.getCurrentThreadId()).toBe(77);
    expect(fakeProcess.sendCommand).toHaveBeenCalledWith(expect.objectContaining({ dapCommand: 'threads' }));
    const pending = (proxyManager as unknown as { pendingDapRequests: Map<string, unknown> }).pendingDapRequests;
    expect(pending.size).toBe(0);
  });

  it('rejects DAP requests on proxy error', async () => {
    (proxyManager as unknown as { proxyProcess: IProxyProcess | null }).proxyProcess = fakeProcess;
    (proxyManager as unknown as { isInitialized: boolean }).isInitialized = true;
    (proxyManager as unknown as { sessionId: string | null }).sessionId = baseConfig.sessionId;
    (proxyManager as unknown as { dapState: ReturnType<typeof createInitialState> | null }).dapState =
      createInitialState(baseConfig.sessionId);

    fakeProcess.sendCommand.mockImplementation((payload) => {
      if (payload.cmd === 'dap') {
        (proxyManager as unknown as {
          handleProxyMessage: (message: object) => void;
        }).handleProxyMessage({
          type: 'dapResponse',
          sessionId: baseConfig.sessionId,
          requestId: payload.requestId,
          success: false,
          error: 'Request failed'
        });
      }
    });

    await expect(proxyManager.sendDapRequest('launch')).rejects.toThrow(/Request failed/);
    const pending = (proxyManager as unknown as { pendingDapRequests: Map<string, unknown> }).pendingDapRequests;
    expect(pending.size).toBe(0);
  });

  it('rejects DAP requests when timeout elapses', async () => {
    (proxyManager as unknown as { proxyProcess: IProxyProcess | null }).proxyProcess = fakeProcess;
    (proxyManager as unknown as { isInitialized: boolean }).isInitialized = true;
    (proxyManager as unknown as { sessionId: string | null }).sessionId = baseConfig.sessionId;

    vi.useFakeTimers();
    try {
      fakeProcess.sendCommand.mockImplementation(() => {
        // Do not emit any response to force timeout
      });

      const request = proxyManager.sendDapRequest('continue');

      await vi.advanceTimersByTimeAsync(35000);

      await expect(request).rejects.toThrow(/Debug adapter did not respond to 'continue'/);
      const pending = (proxyManager as unknown as { pendingDapRequests: Map<string, unknown> }).pendingDapRequests;
      expect(pending.size).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('propagates sendCommand transport errors and clears pending requests', async () => {
    await completeStart();

    fakeProcess.sendCommand.mockClear();
    fakeProcess.sendCommand.mockImplementation(() => {
      throw new Error('transport failure');
    });

    await expect(proxyManager.sendDapRequest('threads')).rejects.toThrow('transport failure');
    expect((proxyManager as unknown as { pendingDapRequests: Map<string, unknown> }).pendingDapRequests.size).toBe(0);
  });

  it('rejects pending DAP requests when proxy exits', async () => {
    await completeStart();

    fakeProcess.sendCommand.mockClear();
    let requestId: string | null = null;
    fakeProcess.sendCommand.mockImplementation((payload) => {
      requestId = payload.requestId;
    });

    const pendingPromise = proxyManager.sendDapRequest('evaluate');

    expect(requestId).not.toBeNull();
    setImmediate(() => {
      fakeProcess.emit('exit', 1, null);
    });

    await expect(pendingPromise).rejects.toThrow('Proxy exited');
    expect((proxyManager as unknown as { pendingDapRequests: Map<string, unknown> }).pendingDapRequests.size).toBe(0);
  });

  it('rejects initialization when proxy exits with non-zero status before readiness', async () => {
    const config: ProxyConfig = {
      ...baseConfig,
      dryRunSpawn: false
    };

    fakeProcess.sendCommand.mockImplementation(() => {
      // Simulate proxy exit on first attempt
      setImmediate(() => {
        fakeProcess.emit('exit', 7, null);
      });
    });

    const startPromise = proxyManager.start(config);

    // With retry logic, error message is different
    await expect(startPromise).rejects.toThrow(/Failed to initialize proxy after \d+ attempts/);
  });

  it('rejects initialization when proxy exits via signal before readiness', async () => {
    const config: ProxyConfig = {
      ...baseConfig,
      dryRunSpawn: false
    };

    fakeProcess.sendCommand.mockImplementation(() => {
      // Simulate proxy exit on first attempt
      setImmediate(() => {
        fakeProcess.emit('exit', null, 'SIGTERM');
      });
    });

    const startPromise = proxyManager.start(config);

    // With retry logic, error message is different
    await expect(startPromise).rejects.toThrow(/Failed to initialize proxy after \d+ attempts/);
  });

  it('allows multiple concurrent stop calls without errors', async () => {
    await completeStart();

    const stopOne = proxyManager.stop();
    const stopTwo = proxyManager.stop();
    setImmediate(() => {
      fakeProcess.emit('exit', 0, null);
    });

    const results = await Promise.all([stopOne, stopTwo]);
    expect(results).toEqual([undefined, undefined]);
    expect(fakeProcess.kill).not.toHaveBeenCalled();
  });

  it('prevents new DAP requests after stop is initiated', async () => {
    await completeStart();

    const stopPromise = proxyManager.stop();
    setImmediate(() => {
      fakeProcess.emit('exit', 0, null);
    });
    await stopPromise;

    await expect(proxyManager.sendDapRequest('threads')).rejects.toThrow('Proxy not initialized');
  });

  it('handles stop invoked while start is still pending', async () => {
    const config: ProxyConfig = {
      ...baseConfig,
      dryRunSpawn: false
    };

    const startPromise = proxyManager.start(config);
    const stopPromise = proxyManager.stop();

    setImmediate(() => {
      fakeProcess.emit('exit', 0, null);
    });

    await expect(stopPromise).resolves.toBeUndefined();
    await expect(startPromise).rejects.toThrow(/Proxy/);
  });

  it('resolves stop immediately if proxy already exited', async () => {
    await completeStart();

    setImmediate(() => {
      fakeProcess.emit('exit', 0, null);
    });

    await expect(proxyManager.stop()).resolves.toBeUndefined();
  });
});

describe('ProxyManager helpers', () => {
  let fileSystem: IFileSystem;
  let logger: ILogger;
  let proxyProcessLauncher: IProxyProcessLauncher;

  beforeEach(() => {
    fileSystem = {
      pathExists: vi.fn().mockResolvedValue(true)
    } as unknown as IFileSystem;

    logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    } as unknown as ILogger;

    proxyProcessLauncher = {
      launchProxy: vi.fn()
    } as unknown as IProxyProcessLauncher;
  });

  it('resolves proxy script relative to module path in development mode', async () => {
    const moduleFsPath = path.join(process.cwd(), 'fake', 'src', 'proxy', 'proxy-manager.ts');
    const moduleUrl = pathToFileURL(moduleFsPath).href;
    const runtimeEnv = {
      moduleUrl,
      cwd: () => path.join(process.cwd(), 'fake')
    };

    const proxyManager = new ProxyManager(
      null,
      proxyProcessLauncher,
      fileSystem,
      logger,
      runtimeEnv
    );

    const scriptPath = await (proxyManager as unknown as { findProxyScript(): Promise<string> }).findProxyScript();

    const expectedPath = path.resolve(path.dirname(moduleFsPath), '../../dist/proxy/proxy-bootstrap.js');

    expect(fileSystem.pathExists).toHaveBeenCalledWith(expectedPath);
    expect(scriptPath).toBe(expectedPath);
  });

  it('resolves proxy script relative to cwd when running bundled', async () => {
    const cwdDir = path.join(process.cwd(), 'fake-bundle');
    const bundledModulePath = path.join(cwdDir, 'dist', 'bundle.cjs');
    const bundledRuntimeEnv = {
      moduleUrl: pathToFileURL(bundledModulePath).href,
      cwd: () => cwdDir
    };

    const proxyManager = new ProxyManager(
      null,
      proxyProcessLauncher,
      fileSystem,
      logger,
      bundledRuntimeEnv
    );

    const scriptPath = await (proxyManager as unknown as { findProxyScript(): Promise<string> }).findProxyScript();
    const expectedPath = path.resolve(cwdDir, 'dist/proxy/proxy-bootstrap.js');

    expect(fileSystem.pathExists).toHaveBeenCalledWith(expectedPath);
    expect(scriptPath).toBe(expectedPath);
  });

  it('prepares spawn context using adapter resolution and cloned environment', async () => {
    const adapter = {
      language: DebugLanguage.JAVASCRIPT,
      validateEnvironment: vi.fn().mockResolvedValue({ valid: true, errors: [], warnings: [] }),
      resolveExecutablePath: vi.fn().mockResolvedValue('/usr/bin/node')
    } as unknown as IDebugAdapter;

    const runtimeEnv = {
      moduleUrl: pathToFileURL(path.join(process.cwd(), 'fake', 'src', 'proxy', 'proxy-manager.ts')).href,
      cwd: () => path.join(process.cwd(), 'fake')
    };

    const proxyManager = new ProxyManager(
      adapter,
      proxyProcessLauncher,
      fileSystem,
      logger,
      runtimeEnv
    );

    const config: ProxyConfig = {
      sessionId: 'ctx-test',
      language: DebugLanguage.JAVASCRIPT,
      adapterHost: '127.0.0.1',
      adapterPort: 9229,
      logDir: '/tmp/logs',
      scriptPath: '/tmp/app.js',
      dryRunSpawn: false
    };

    const context = await (proxyManager as unknown as { prepareSpawnContext(cfg: ProxyConfig): Promise<{ executablePath: string; proxyScriptPath: string; env: Record<string, string> }> }).prepareSpawnContext(config);

    expect(adapter.validateEnvironment).toHaveBeenCalled();
    expect(adapter.resolveExecutablePath).toHaveBeenCalled();
    expect(context.executablePath).toBe('/usr/bin/node');
    expect(context.env).not.toBe(process.env);
    expect(context.env.PATH).toBe(process.env.PATH);
  });

  it('throws when adapter validation fails during spawn context preparation', async () => {
    const adapter = {
      language: DebugLanguage.PYTHON,
      validateEnvironment: vi.fn().mockResolvedValue({
        valid: false,
        errors: [{ message: 'Python missing' }],
        warnings: []
      }),
      resolveExecutablePath: vi.fn()
    } as unknown as IDebugAdapter;

    const runtimeEnv = {
      moduleUrl: pathToFileURL(path.join(process.cwd(), 'fake', 'src', 'proxy', 'proxy-manager.ts')).href,
      cwd: () => path.join(process.cwd(), 'fake')
    };

    const proxyManager = new ProxyManager(
      adapter,
      proxyProcessLauncher,
      fileSystem,
      logger,
      runtimeEnv
    );

    const config: ProxyConfig = {
      sessionId: 'ctx-error',
      language: DebugLanguage.PYTHON,
      adapterHost: '127.0.0.1',
      adapterPort: 5678,
      logDir: '/tmp/logs',
      scriptPath: '/tmp/app.py',
      dryRunSpawn: false
    };

    await expect(
      (proxyManager as unknown as { prepareSpawnContext(cfg: ProxyConfig): Promise<unknown> }).prepareSpawnContext(config)
    ).rejects.toThrow(/Invalid environment/);
  });
});
