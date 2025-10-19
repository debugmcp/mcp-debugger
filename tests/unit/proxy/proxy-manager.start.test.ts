import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { ProxyManager } from '../../../src/proxy/proxy-manager.js';
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
