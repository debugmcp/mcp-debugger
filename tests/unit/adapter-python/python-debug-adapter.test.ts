import { describe, it, expect, afterEach, vi, type Mock } from 'vitest';
import { EventEmitter } from 'events';
import { PythonDebugAdapter } from '../../../packages/adapter-python/src/python-debug-adapter.js';
import { AdapterState, AdapterError, DebugFeature } from '@debugmcp/shared';

vi.mock('child_process', () => ({
  spawn: vi.fn(),
  exec: vi.fn()
}));

vi.mock('fs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('fs')>()),
  existsSync: vi.fn(() => false)
}));

vi.mock('../../../packages/adapter-python/src/utils/python-utils.js', () => ({
  findPythonExecutable: vi.fn(),
  getPythonVersion: vi.fn()
}));

const { findPythonExecutable, getPythonVersion } = await import('../../../packages/adapter-python/src/utils/python-utils.js');
const { spawn } = await import('child_process');
const { existsSync } = await import('fs');

const createDependencies = () => ({
  fileSystem: {} as unknown,
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  },
  environment: {} as unknown,
  networkManager: undefined
});

describe('PythonDebugAdapter', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('caches resolveExecutablePath results', async () => {
    findPythonExecutable.mockResolvedValue('/usr/bin/python');
    const adapter = new PythonDebugAdapter(createDependencies());

    const first = await adapter.resolveExecutablePath();
    const second = await adapter.resolveExecutablePath();

    expect(first).toBe('/usr/bin/python');
    expect(second).toBe('/usr/bin/python');
    expect(findPythonExecutable).toHaveBeenCalledTimes(1);
  });

  it('marks environment invalid when Python version is too old', async () => {
    const adapter = new PythonDebugAdapter(createDependencies());
    (adapter as any).resolveExecutablePath = vi.fn().mockResolvedValue('/usr/bin/python');
    (adapter as any).checkPythonVersion = vi.fn().mockResolvedValue('3.6.9');
    (adapter as any).checkDebugpyInstalled = vi.fn().mockResolvedValue(true);
    (adapter as any).detectVirtualEnv = vi.fn().mockResolvedValue(false);

    const result = await adapter.validateEnvironment();

    expect(result.valid).toBe(false);
    expect(result.errors[0]?.code).toBe('PYTHON_VERSION_TOO_OLD');
  });

  it('reports missing debugpy as a warning when no interpreter was configured (issue #106)', async () => {
    // With no explicit executablePath, debugpy may still be in the user's virtualenv, so a missing
    // system debugpy is a warning (re-checked at launch), not a blocking error.
    const deps = createDependencies();
    const adapter = new PythonDebugAdapter(deps);
    (adapter as any).resolveExecutablePath = vi.fn().mockResolvedValue('/usr/bin/python');
    (adapter as any).checkPythonVersion = vi.fn().mockResolvedValue('3.11.1');
    (adapter as any).checkDebugpyInstalled = vi.fn().mockResolvedValue(false);
    (adapter as any).detectVirtualEnv = vi.fn().mockResolvedValue(true);

    const result = await adapter.validateEnvironment();

    expect(result.valid).toBe(true);
    expect(result.errors.map((entry: { code: string }) => entry.code)).not.toContain('DEBUGPY_NOT_INSTALLED');
    expect(result.warnings.map((entry: { code: string }) => entry.code)).toContain('DEBUGPY_NOT_INSTALLED');
    expect(deps.logger.info).toHaveBeenCalledWith('[PythonDebugAdapter] Virtual environment detected');
  });

  it('returns validation error when Python executable cannot be resolved', async () => {
    const adapter = new PythonDebugAdapter(createDependencies());
    (adapter as any).resolveExecutablePath = vi.fn().mockRejectedValue(new Error('not found'));

    const result = await adapter.validateEnvironment();

    expect(result.valid).toBe(false);
    expect(result.errors[0]?.code).toBe('PYTHON_NOT_FOUND');
  });

  it('uses cached version information when available', async () => {
    const adapter = new PythonDebugAdapter(createDependencies());
    const cache = (adapter as any).pythonPathCache as Map<string, { path: string; timestamp: number; version?: string }>;
    cache.set('/python', { path: '/python', timestamp: Date.now(), version: '3.11.2' });

    const version = await (adapter as any).checkPythonVersion('/python');

    expect(version).toBe('3.11.2');
    expect(getPythonVersion).not.toHaveBeenCalled();
  });

  it('returns adapter command with debugpy arguments', () => {
    const adapter = new PythonDebugAdapter(createDependencies());
    const cmd = adapter.buildAdapterCommand({
      sessionId: 's1',
      executablePath: '/usr/bin/python',
      adapterHost: '127.0.0.1',
      adapterPort: 9000,
      logDir: '/tmp/logs',
      scriptPath: '/app/main.py',
      launchConfig: {}
    });

    expect(cmd.command).toBe('/usr/bin/python');
    expect(cmd.args).toEqual(['-m', 'debugpy.adapter', '--host', '127.0.0.1', '--port', '9000']);
    expect(cmd.env?.DEBUGPY_LOG_DIR).toBe('/tmp/logs');
  });

  it('throws on invalid exception filters', async () => {
    const adapter = new PythonDebugAdapter(createDependencies());

    await expect(
      adapter.sendDapRequest('setExceptionBreakpoints', { filters: ['invalid-filter'] })
    ).rejects.toBeInstanceOf(AdapterError);
  });

  it('passes through allowed DAP requests without modification', async () => {
    const adapter = new PythonDebugAdapter(createDependencies());

    await expect(
      adapter.sendDapRequest('setExceptionBreakpoints', { filters: ['raised', 'uncaught'] })
    ).resolves.toEqual({});
  });

  it('updates thread id on stopped events', () => {
    const adapter = new PythonDebugAdapter(createDependencies());
    adapter.handleDapEvent({
      type: 'event',
      seq: 1,
      event: 'stopped',
      body: { threadId: 42 }
    });

    expect(adapter.getCurrentThreadId()).toBe(42);
  });

  it('supports documented features and requirements', () => {
    const adapter = new PythonDebugAdapter(createDependencies());

    expect(adapter.supportsFeature(DebugFeature.LOG_POINTS)).toBe(true);
    expect(adapter.supportsFeature(DebugFeature.DISASSEMBLE_REQUEST)).toBe(false);

    const requirements = adapter.getFeatureRequirements(DebugFeature.EXCEPTION_INFO_REQUEST);
    expect(requirements.some(r => r.description.includes('Python 3.7+'))).toBe(true);
  });

  it('translateErrorMessage handles debugpy missing', () => {
    const adapter = new PythonDebugAdapter(createDependencies());
    const message = adapter.translateErrorMessage(new Error('ModuleNotFoundError: No module named debugpy'));
    expect(message).toContain('debugpy');
  });

  it('translateErrorMessage normalizes other common errors', () => {
    const adapter = new PythonDebugAdapter(createDependencies());

    expect(adapter.translateErrorMessage(new Error('python: command not found'))).toContain('Python not found');
    expect(adapter.translateErrorMessage(new Error('Permission denied to execute python'))).toContain('Permission denied');
    expect(adapter.translateErrorMessage(new Error('Windows Store Python cannot be used'))).toContain('Windows Store');
    expect(adapter.translateErrorMessage(new Error('unexpected failure'))).toBe('unexpected failure');
  });

  it('returns feature requirements for select features and empty for unsupported ones', () => {
    const adapter = new PythonDebugAdapter(createDependencies());

    const logPoints = adapter.getFeatureRequirements(DebugFeature.LOG_POINTS);
    expect(logPoints).toEqual([
      expect.objectContaining({ description: 'debugpy 1.5+', required: true })
    ]);

    const none = adapter.getFeatureRequirements(DebugFeature.VARIABLE_PAGING);
    expect(none).toEqual([]);
  });

  it('initializes successfully when environment validates', async () => {
    const adapter = new PythonDebugAdapter(createDependencies());
    const validateSpy = vi
      .spyOn(adapter, 'validateEnvironment' as never)
      .mockResolvedValue({ valid: true, errors: [], warnings: [] });

    const initialized = vi.fn();
    adapter.on('initialized', initialized);

    await adapter.initialize();

    expect(validateSpy).toHaveBeenCalled();
    expect(adapter.getState()).toBe(AdapterState.READY);
    expect(initialized).toHaveBeenCalled();
  });

  it('throws AdapterError when environment validation fails during initialize', async () => {
    const adapter = new PythonDebugAdapter(createDependencies());
    vi.spyOn(adapter, 'validateEnvironment' as never).mockResolvedValue({
      valid: false,
      errors: [{ code: 'ENV_BAD', message: 'bad env', recoverable: false }],
      warnings: []
    });

    await expect(adapter.initialize()).rejects.toBeInstanceOf(AdapterError);
    expect(adapter.getState()).toBe(AdapterState.ERROR);
  });

  it('updates state when connecting and disconnecting', async () => {
    const adapter = new PythonDebugAdapter(createDependencies());
    const connected = vi.fn();
    const disconnected = vi.fn();
    adapter.on('connected', connected);
    adapter.on('disconnected', disconnected);

    await adapter.connect('localhost', 5678);
    expect(adapter.getState()).toBe(AdapterState.CONNECTED);
    expect(adapter.isConnected()).toBe(true);

    await adapter.disconnect();
    expect(adapter.getState()).toBe(AdapterState.DISCONNECTED);
    expect(adapter.isConnected()).toBe(false);
    expect(connected).toHaveBeenCalled();
    expect(disconnected).toHaveBeenCalled();
  });

  it('detects debugpy installation via spawn output', async () => {
    const adapter = new PythonDebugAdapter(createDependencies());
    const child = new EventEmitter() as any;
    child.stdout = new EventEmitter();
    child.on = child.on.bind(child);
    child.stdout.on = child.stdout.on.bind(child.stdout);
    const spawnMock = spawn as unknown as Mock;
    spawnMock.mockReturnValue(child);

    const checkPromise = (adapter as any).checkDebugpyInstalled('/usr/bin/python');
    child.stdout.emit('data', '1.8.0');
    child.emit('exit', 0);

    expect(await checkPromise).toBe(true);
    expect(spawnMock).toHaveBeenCalledWith(
      '/usr/bin/python',
      ['-c', 'import debugpy; print(debugpy.__version__)'],
      { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }
    );
  });

  it('returns false when debugpy detection spawn fails', async () => {
    const adapter = new PythonDebugAdapter(createDependencies());
    const child = new EventEmitter() as any;
    child.stdout = new EventEmitter();
    child.on = child.on.bind(child);
    child.stdout.on = child.stdout.on.bind(child.stdout);
    const spawnMock = spawn as unknown as Mock;
    spawnMock.mockReturnValue(child);

    const checkPromise = (adapter as any).checkDebugpyInstalled('/usr/bin/python');
    child.emit('error', new Error('spawn failure'));

    expect(await checkPromise).toBe(false);
  });

  it('transforms launch configuration with python defaults', async () => {
    const adapter = new PythonDebugAdapter(createDependencies());
    const config = await adapter.transformLaunchConfig({
      type: 'python',
      request: 'launch',
      name: 'Test',
      stopOnEntry: true,
      justMyCode: false
    });

    expect(config.name).toBe('Python: Current File');
    expect(config.console).toBe('internalConsole');
    expect(config.redirectOutput).toBe(true);
    expect(config.showReturnValue).toBe(true);
    expect(config.stopOnEntry).toBe(true);
    expect(config.justMyCode).toBe(false);
  });

  it('honors a user-supplied console mode instead of forcing internalConsole (#215)', async () => {
    const adapter = new PythonDebugAdapter(createDependencies());
    const config = await adapter.transformLaunchConfig({
      console: 'integratedTerminal'
    } as any);

    expect(config.console).toBe('integratedTerminal');
  });

  describe('pythonw.exe adapter interpreter preference (#215)', () => {
    const buildCommand = (adapter: PythonDebugAdapter, executablePath: string) =>
      adapter.buildAdapterCommand({
        sessionId: 's1',
        executablePath,
        adapterHost: '127.0.0.1',
        adapterPort: 9000,
        logDir: '/tmp/logs',
        scriptPath: '/app/main.py',
        launchConfig: {}
      });

    const withPlatform = (platform: string, fn: () => void) => {
      const original = process.platform;
      Object.defineProperty(process, 'platform', { value: platform });
      try {
        fn();
      } finally {
        Object.defineProperty(process, 'platform', { value: original });
      }
    };

    it('swaps python.exe for a sibling pythonw.exe on win32', () => {
      (existsSync as Mock).mockReturnValue(true);
      const adapter = new PythonDebugAdapter(createDependencies());

      withPlatform('win32', () => {
        const cmd = buildCommand(adapter, 'C:\\Python313\\python.exe');
        expect(cmd.command.toLowerCase()).toContain('pythonw.exe');
      });
    });

    it('keeps python.exe when no sibling pythonw.exe exists', () => {
      (existsSync as Mock).mockReturnValue(false);
      const adapter = new PythonDebugAdapter(createDependencies());

      withPlatform('win32', () => {
        const cmd = buildCommand(adapter, 'C:\\Python313\\python.exe');
        expect(cmd.command).toBe('C:\\Python313\\python.exe');
      });
    });

    it('leaves the interpreter untouched off win32', () => {
      (existsSync as Mock).mockReturnValue(true);
      const adapter = new PythonDebugAdapter(createDependencies());

      withPlatform('linux', () => {
        const cmd = buildCommand(adapter, '/usr/bin/python');
        expect(cmd.command).toBe('/usr/bin/python');
      });
    });

    it('leaves an explicit pythonw.exe untouched', () => {
      (existsSync as Mock).mockReturnValue(true);
      const adapter = new PythonDebugAdapter(createDependencies());

      withPlatform('win32', () => {
        const cmd = buildCommand(adapter, 'C:\\Python313\\pythonw.exe');
        expect(cmd.command).toBe('C:\\Python313\\pythonw.exe');
      });
    });
  });

  it('disposes by clearing state and emitting event', async () => {
    const adapter = new PythonDebugAdapter(createDependencies());
    const disposed = vi.fn();
    adapter.on('disposed', disposed);

    await adapter.connect('localhost', 5678);
    await adapter.disconnect();
    await adapter.dispose();

    expect(disposed).toHaveBeenCalled();
    expect(adapter.getState()).toBe(AdapterState.UNINITIALIZED);
    expect(adapter.isConnected()).toBe(false);
  });

  it('exposes python capabilities and requirements', () => {
    const adapter = new PythonDebugAdapter(createDependencies());
    const capabilities = adapter.getCapabilities();

    expect(capabilities.supportsConfigurationDoneRequest).toBe(true);
    expect(capabilities.exceptionBreakpointFilters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ filter: 'raised' }),
        expect.objectContaining({ filter: 'uncaught' })
      ])
    );
  });

  it('provides installation guidance strings', () => {
    const adapter = new PythonDebugAdapter(createDependencies());

    expect(adapter.getInstallationInstructions()).toContain('pip install debugpy');
    expect(adapter.getMissingExecutableError()).toContain('Python not found');
  });

  it('returns default launch configuration snapshot', () => {
    const adapter = new PythonDebugAdapter(createDependencies());
    const defaults = adapter.getDefaultLaunchConfig();

    expect(defaults.stopOnEntry).toBe(false);
    expect(defaults.justMyCode).toBe(true);
    expect(defaults.env).toEqual({});
    expect(defaults.cwd).toBe(process.cwd());
  });

  describe('attach support (issue #145)', () => {
    it('reports attach capabilities', () => {
      const adapter = new PythonDebugAdapter(createDependencies());

      expect(adapter.supportsAttach?.()).toBe(true);
      expect(adapter.supportsDetach?.()).toBe(true);
      expect(adapter.usesDirectConnectForAttach?.()).toBe(true);
    });

    it('declares direct-connect attach in the factory metadata (issue #331)', async () => {
      const { PythonAdapterFactory } = await import('../../../packages/adapter-python/src/python-adapter-factory.js');
      const metadata = new PythonAdapterFactory().getMetadata();
      expect(metadata.modes).toEqual({ launch: true, attach: 'direct-connect' });
    });

    it('keeps request=attach and emits the debugpy connect shape', () => {
      const adapter = new PythonDebugAdapter(createDependencies());

      const config = adapter.transformAttachConfig!({
        request: 'attach',
        host: '127.0.0.1',
        port: 5679,
        justMyCode: false,
        cwd: '/work',
        env: { FOO: '1' },
        __attachMode: true
      });

      expect(config).toMatchObject({
        type: 'python',
        request: 'attach',
        name: 'Python: Attach',
        connect: { host: '127.0.0.1', port: 5679 },
        justMyCode: false,
        cwd: '/work',
        env: { FOO: '1' }
      });
      // debugpy rejects configs carrying both `connect` and top-level
      // host/port ("mutually exclusive"), so those must not leak through.
      expect(config.host).toBeUndefined();
      expect(config.port).toBeUndefined();
      // No launch-template pollution (second bug in issue #145)
      expect(config.console).toBeUndefined();
      expect(config.__attachMode).toBeUndefined();
    });

    it('defaults attach host to 127.0.0.1 and justMyCode to true', () => {
      const adapter = new PythonDebugAdapter(createDependencies());

      const config = adapter.transformAttachConfig!({ request: 'attach', port: 5679 });

      expect(config).toMatchObject({
        connect: { host: '127.0.0.1', port: 5679 },
        justMyCode: true
      });
    });

    it('rejects attach without a port', () => {
      const adapter = new PythonDebugAdapter(createDependencies());

      expect(() => adapter.transformAttachConfig!({ request: 'attach' }))
        .toThrow(/port/i);
    });

    it('rejects PID-based attach with guidance toward debugpy --listen', () => {
      const adapter = new PythonDebugAdapter(createDependencies());

      expect(() => adapter.transformAttachConfig!({ request: 'attach', processId: 1234 }))
        .toThrow(/process id/i);
    });

    it('provides a default attach config', () => {
      const adapter = new PythonDebugAdapter(createDependencies());

      expect(adapter.getDefaultAttachConfig?.()).toEqual({
        request: 'attach',
        host: '127.0.0.1',
        justMyCode: true
      });
    });

    it('propagates stopOnEntry into the attach config when provided', () => {
      const adapter = new PythonDebugAdapter(createDependencies());
      const attach = adapter.transformAttachConfig({ port: 5678, stopOnEntry: true });
      expect(attach.stopOnEntry).toBe(true);
    });
  });

  describe('validateEnvironment through the real helpers (coverage sprint)', () => {
    // Scripted spawn: the debugpy probe runs `-c "import debugpy; ..."`,
    // the venv probe runs `-c "... real_prefix ..."`.
    function scriptSpawn(opts: { debugpyOutput?: string; debugpyExit?: number; venvOutput?: string; venvError?: boolean }): void {
      (spawn as Mock).mockImplementation(((_cmd: string, args: string[]) => {
        const proc = new EventEmitter() as any;
        proc.stdout = new EventEmitter();
        proc.stderr = new EventEmitter();
        const script = args?.[1] ?? '';
        process.nextTick(() => {
          if (script.includes('import debugpy')) {
            if (opts.debugpyOutput) proc.stdout.emit('data', Buffer.from(opts.debugpyOutput));
            proc.emit('exit', opts.debugpyExit ?? 0);
          } else if (script.includes('real_prefix')) {
            if (opts.venvError) {
              proc.emit('error', new Error('spawn failed'));
              return;
            }
            if (opts.venvOutput) proc.stdout.emit('data', Buffer.from(opts.venvOutput));
            proc.emit('exit', 0);
          } else {
            proc.emit('exit', 0);
          }
        });
        return proc;
      }) as never);
    }

    it('warns when the Python version cannot be determined and detects a virtualenv', async () => {
      findPythonExecutable.mockResolvedValue('/usr/bin/python');
      (getPythonVersion as Mock).mockResolvedValue(null);
      scriptSpawn({ debugpyOutput: '1.8.0\n', venvOutput: 'True\n' });
      const deps = createDependencies();
      const adapter = new PythonDebugAdapter(deps as never);

      const result = await adapter.validateEnvironment();

      expect(result.warnings).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'PYTHON_VERSION_CHECK_FAILED' })
      ]));
      expect(deps.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Virtual environment detected')
      );
    });

    it('resolves the version via getPythonVersion on cache miss and reuses the cached debugpy answer', async () => {
      findPythonExecutable.mockResolvedValue('/usr/bin/python');
      (getPythonVersion as Mock).mockResolvedValue('3.12.1');
      scriptSpawn({ debugpyOutput: '1.8.0\n', venvOutput: 'False\n' });
      const adapter = new PythonDebugAdapter(createDependencies() as never);

      const first = await adapter.validateEnvironment();
      expect(first.valid).toBe(true);
      expect(getPythonVersion).toHaveBeenCalledTimes(1);

      const debugpySpawns = () => (spawn as Mock).mock.calls
        .filter((c) => String(c[1]?.[1] ?? '').includes('import debugpy')).length;
      const before = debugpySpawns();
      await adapter.validateEnvironment();
      // Second validation: version and debugpy answers come from the cache
      expect(getPythonVersion).toHaveBeenCalledTimes(1);
      expect(debugpySpawns()).toBe(before);
    });

    it('treats a failing virtualenv probe as not-a-venv', async () => {
      findPythonExecutable.mockResolvedValue('/usr/bin/python');
      (getPythonVersion as Mock).mockResolvedValue('3.12.1');
      scriptSpawn({ debugpyOutput: '1.8.0\n', venvError: true });
      const deps = createDependencies();
      const adapter = new PythonDebugAdapter(deps as never);

      const result = await adapter.validateEnvironment();

      expect(result.valid).toBe(true);
      expect(deps.logger.info).not.toHaveBeenCalledWith(
        expect.stringContaining('Virtual environment detected')
      );
    });

    it('emits CI diagnostics during initialize when CI=true', async () => {
      vi.stubEnv('CI', 'true');
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        findPythonExecutable.mockResolvedValue('/usr/bin/python');
        (getPythonVersion as Mock).mockResolvedValue('3.12.1');
        scriptSpawn({ debugpyOutput: '1.8.0\n', venvOutput: 'False\n' });
        const adapter = new PythonDebugAdapter(createDependencies() as never);

        await adapter.initialize();

        expect(consoleSpy).toHaveBeenCalledWith('[PythonDebugAdapter] Starting initialize()');
        expect(consoleSpy).toHaveBeenCalledWith('[PythonDebugAdapter] Resolved Python path:', '/usr/bin/python');
      } finally {
        consoleSpy.mockRestore();
        vi.unstubAllEnvs();
      }
    });
  });

  describe('platform-dependent configuration surface (coverage sprint)', () => {
    function withPlatform(platform: NodeJS.Platform, fn: () => void): void {
      const original = Object.getOwnPropertyDescriptor(process, 'platform')!;
      Object.defineProperty(process, 'platform', { value: platform, configurable: true });
      try {
        fn();
      } finally {
        Object.defineProperty(process, 'platform', original);
      }
    }

    it('names the default executable per platform', () => {
      const adapter = new PythonDebugAdapter(createDependencies() as never);
      withPlatform('win32', () => expect(adapter.getDefaultExecutableName()).toBe('py'));
      withPlatform('linux', () => expect(adapter.getDefaultExecutableName()).toBe('python3'));
      withPlatform('darwin', () => expect(adapter.getDefaultExecutableName()).toBe('python3'));
    });

    it('returns platform-appropriate search paths', () => {
      const adapter = new PythonDebugAdapter(createDependencies() as never);
      withPlatform('win32', () => {
        expect(adapter.getExecutableSearchPaths()).toEqual(expect.arrayContaining(['C:\\Python312']));
      });
      withPlatform('darwin', () => {
        expect(adapter.getExecutableSearchPaths()).toEqual(expect.arrayContaining(['/opt/homebrew/bin']));
      });
      withPlatform('linux', () => {
        expect(adapter.getExecutableSearchPaths()).toEqual(expect.arrayContaining(['/opt/python/bin']));
      });
    });

    it('exposes the documented dependencies and install metadata', () => {
      const adapter = new PythonDebugAdapter(createDependencies() as never);
      expect(adapter.getRequiredDependencies().map((d: { name: string }) => d.name)).toEqual(['Python', 'debugpy']);
      expect(adapter.getAdapterModuleName()).toBe('debugpy.adapter');
      expect(adapter.getAdapterInstallCommand()).toBe('pip install debugpy');
    });

    it('reports feature requirements for conditional breakpoints', () => {
      const adapter = new PythonDebugAdapter(createDependencies() as never);
      expect(adapter.getFeatureRequirements(DebugFeature.CONDITIONAL_BREAKPOINTS)).toEqual([
        { type: 'dependency', description: 'debugpy 1.0+', required: true }
      ]);
    });
  });
});
