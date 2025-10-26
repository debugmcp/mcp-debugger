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

  const completeStart = async (config: ProxyConfig = baseConfig): Promise<void> => {
    const startPromise = proxyManager.start(config);
    fakeProcess.sendCommand.mockImplementationOnce(() => {
      setImmediate(() => {
        proxyManager.emit('dry-run-complete', 'node --inspect', config.scriptPath);
      });
    });
    fakeProcess.emit('message', { type: 'proxy-ready' });
    await startPromise;
    (proxyManager as unknown as { isInitialized: boolean }).isInitialized = true;
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

  it('fails to start when bootstrap worker script is missing', async () => {
    (fileSystem.pathExists as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(false);

    await expect(proxyManager.start(baseConfig)).rejects.toThrow(/Bootstrap worker script not found/);
    expect(fileSystem.pathExists).toHaveBeenCalled();
    expect(launchProxySpy).not.toHaveBeenCalled();
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

    fakeProcess.sendCommand.mockImplementationOnce(() => {
      setImmediate(() => {
        fakeProcess.emit('exit', 7, null);
      });
    });

    const startPromise = proxyManager.start(config);

    await expect(startPromise).rejects.toThrow(/Proxy exited during initialization.*Code: 7/);
  });

  it('rejects initialization when proxy exits via signal before readiness', async () => {
    const config: ProxyConfig = {
      ...baseConfig,
      dryRunSpawn: false
    };

    fakeProcess.sendCommand.mockImplementationOnce(() => {
      setImmediate(() => {
        fakeProcess.emit('exit', null, 'SIGTERM');
      });
    });

    const startPromise = proxyManager.start(config);

    await expect(startPromise).rejects.toThrow(/Proxy exited during initialization.*Signal: SIGTERM/);
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
