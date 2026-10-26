import { describe, it, expect, afterEach, vi, type Mock } from 'vitest';
import { EventEmitter } from 'events';
import { PythonDebugAdapter } from '../../../packages/adapter-python/src/python-debug-adapter.js';
import { AdapterState, AdapterError, DebugFeature } from '@debugmcp/shared';
import type { AdapterDependencies, GenericLaunchConfig, LanguageSpecificLaunchConfig } from '@debugmcp/shared';
import { createMockAdapterDependencies, createMockFileSystem } from '../../test-utils/helpers/adapter-dependencies.js';

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

const createDependencies = (): AdapterDependencies => createMockAdapterDependencies();

describe('PythonDebugAdapter', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('caches resolveExecutablePath results', async () => {
    vi.mocked(findPythonExecutable).mockResolvedValue('/usr/bin/python');
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
      .spyOn(adapter, 'validateEnvironment')
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
    vi.spyOn(adapter, 'validateEnvironment').mockResolvedValue({
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
    // `type`/`request`/`name` are keys `GenericLaunchConfig` does not declare; the
    // session layer forwards unlisted keys through a cast and python's transform reads
    // and overwrites all three, so they are typed here as the language-specific shape.
    const launchConfig: LanguageSpecificLaunchConfig = {
      type: 'python',
      request: 'launch',
      name: 'Test',
      stopOnEntry: true,
      justMyCode: false
    };
    const config = await adapter.transformLaunchConfig(launchConfig);

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

  // Issue #985 (M0): debugpy refuses "program" beside "module" or "code"
  // ('"program", "module", and "code" are mutually exclusive'), and the
  // session layer fills `program` from scriptPath before this transform runs.
  describe('module and code launch targets (issue #985)', () => {
    it('drops program when the launch config names a module', async () => {
      const adapter = new PythonDebugAdapter(createDependencies());
      const config = await adapter.transformLaunchConfig({
        program: '/proj/tests/test_a.py',
        module: 'pytest',
        args: ['/proj/tests/test_a.py::test_x', '-x'],
        cwd: '/proj'
      } as any);

      expect(config).not.toHaveProperty('program');
      expect(config.module).toBe('pytest');
      expect(config.args).toEqual(['/proj/tests/test_a.py::test_x', '-x']);
      expect(config.cwd).toBe('/proj');
    });

    it('drops program when the launch config names code', async () => {
      const adapter = new PythonDebugAdapter(createDependencies());
      const config = await adapter.transformLaunchConfig({ program: '/proj/a.py', code: 'print(1)' } as any);

      expect(config).not.toHaveProperty('program');
      expect(config.code).toBe('print(1)');
    });

    it('keeps program when neither module nor code is set, and records nothing', async () => {
      const adapter = new PythonDebugAdapter(createDependencies());
      const config = await adapter.transformLaunchConfig({ program: '/proj/a.py' } as any);

      expect(config.program).toBe('/proj/a.py');
      expect(adapter.consumeLaunchConfigDiagnostics?.() ?? []).toEqual([]);
    });

    it('records a diagnostic on the target key and one on program, drained once', async () => {
      const adapter = new PythonDebugAdapter(createDependencies());
      await adapter.transformLaunchConfig({ program: '/proj/a.py', module: 'pytest', cwd: '/proj' } as any);

      const diagnostics = adapter.consumeLaunchConfigDiagnostics?.() ?? [];
      const byKey = Object.fromEntries(diagnostics.map(d => [d.key, d]));
      expect(byKey.module?.message).toMatch(/python -m/);
      expect(byKey.module?.message).toMatch(/program/);
      // A caller's own `program` beside the module is not sent either; the
      // collector shows this one only when the caller passed the key.
      expect(byKey.program?.message).toMatch(/not sent/);
      expect(byKey.program?.scope).toBeUndefined();
      expect(adapter.consumeLaunchConfigDiagnostics?.() ?? []).toEqual([]);
    });

    it('words the code target with python -c', async () => {
      const adapter = new PythonDebugAdapter(createDependencies());
      await adapter.transformLaunchConfig({ program: '/proj/a.py', code: 'print(1)', cwd: '/proj' } as any);

      const diagnostics = adapter.consumeLaunchConfigDiagnostics?.() ?? [];
      expect(diagnostics.find(d => d.key === 'code')?.message).toMatch(/python -c/);
    });

    // The pytest preset (issue #985 M1): `testRunner: "pytest"` on the test
    // file becomes a module launch of pytest from the project's rootdir.
    describe('testRunner: pytest', () => {
      const project = (...files: string[]) =>
        createMockAdapterDependencies({
          fileSystem: createMockFileSystem({
            existsSync: vi.fn((p: string) => files.includes(p.replace(/\\/g, '/')))
          })
        });

      it('expands into python -m pytest <node id> -x … from the rootdir, consuming its keys and the stand-in program', async () => {
        const adapter = new PythonDebugAdapter(project('/proj/pytest.ini'));
        const config = await adapter.transformLaunchConfig({
          program: '/proj/tests/test_billing.py',
          testRunner: 'pytest',
          testTarget: 'test_rounding'
        } as any);

        expect(config.module).toBe('pytest');
        expect(config.args).toEqual(['/proj/tests/test_billing.py::test_rounding', '-x', '-p', 'no:xdist', '-p', 'no:cov']);
        expect(config.cwd).toBe('/proj');
        expect(config).not.toHaveProperty('program');
        expect(config).not.toHaveProperty('testRunner');
        expect(config).not.toHaveProperty('testTarget');
        expect(adapter.consumedLaunchKeys).toEqual(expect.arrayContaining(['testRunner', 'testTarget']));

        const notes = adapter.consumeLaunchConfigDiagnostics?.() ?? [];
        // A launch-scoped label of its own, so the note renders once, as-is.
        const preset = notes.find(d => d.key === 'preset');
        expect(preset?.scope).toBe('launch');
        expect(preset?.message).toMatch(/python -m pytest/);
        expect(preset?.message).toContain('/proj');
        expect(preset?.message).toContain('pytest.ini');
        // The module-launch cwd note is not added on top: the preset chose cwd itself.
        expect(notes.filter(d => d.key === 'cwd')).toHaveLength(0);
      });

      it('keeps caller args and cwd', async () => {
        const adapter = new PythonDebugAdapter(project('/proj/pytest.ini'));
        const config = await adapter.transformLaunchConfig({
          program: '/proj/tests/test_billing.py',
          testRunner: 'pytest',
          args: ['-vv'],
          cwd: '/proj/src'
        } as any);

        expect(config.args).toEqual(['/proj/tests/test_billing.py', '-x', '-p', 'no:xdist', '-p', 'no:cov', '-vv']);
        expect(config.cwd).toBe('/proj/src');
      });

      it('refuses a runner the adapter does not have, naming the ones it does', async () => {
        const adapter = new PythonDebugAdapter(project());
        await expect(
          adapter.transformLaunchConfig({ program: '/proj/tests/test_a.py', testRunner: 'nose' } as any)
        ).rejects.toThrow(/nose.*pytest/);
      });

      it('refuses a node id that names another file', async () => {
        const adapter = new PythonDebugAdapter(project());
        await expect(
          adapter.transformLaunchConfig({ program: '/proj/tests/test_a.py', testRunner: 'pytest', testTarget: 'tests/test_b.py::test_x' } as any)
        ).rejects.toThrow(/test_b\.py/);
      });
    });

    // The launcher no longer derives cwd from the stand-in file for a module
    // launch (issue #985): `python -m` resolves the module from cwd, so the
    // right default is the directory above the top-most package the file is in.
    describe('cwd for a module launch', () => {
      const existsAt = (...files: string[]) =>
        createMockAdapterDependencies({
          fileSystem: createMockFileSystem({
            existsSync: vi.fn((p: string) => files.includes(p.replace(/\\/g, '/')))
          })
        });

      it('defaults cwd to the directory above the top-most package containing the file, and says so', async () => {
        const adapter = new PythonDebugAdapter(existsAt('/proj/modpkg/__init__.py'));
        const config = await adapter.transformLaunchConfig({ program: '/proj/modpkg/__main__.py', module: 'modpkg' } as any);

        expect(config.cwd).toBe('/proj');
        const note = (adapter.consumeLaunchConfigDiagnostics?.() ?? []).find(d => d.scope === 'launch');
        expect(note?.message).toMatch(/cwd/);
        expect(note?.message).toContain('/proj');
      });

      it('walks through nested packages', async () => {
        const adapter = new PythonDebugAdapter(existsAt('/proj/pkg/__init__.py', '/proj/pkg/sub/__init__.py'));
        const config = await adapter.transformLaunchConfig({ program: '/proj/pkg/sub/__main__.py', module: 'pkg.sub' } as any);

        expect(config.cwd).toBe('/proj');
      });

      it("falls back to the file's directory when it is not inside a package", async () => {
        const adapter = new PythonDebugAdapter(existsAt());
        const config = await adapter.transformLaunchConfig({ program: '/proj/tests/test_a.py', module: 'pytest' } as any);

        expect(config.cwd).toBe('/proj/tests');
      });

      it('keeps a cwd the caller set, without a note', async () => {
        const adapter = new PythonDebugAdapter(existsAt('/proj/modpkg/__init__.py'));
        const config = await adapter.transformLaunchConfig({ program: '/proj/modpkg/__main__.py', module: 'modpkg', cwd: '/elsewhere' } as any);

        expect(config.cwd).toBe('/elsewhere');
        expect((adapter.consumeLaunchConfigDiagnostics?.() ?? []).some(d => d.scope === 'launch')).toBe(false);
      });
    });
  });

  // debugpy's sub-process debugging hooks every Python child the program
  // starts and parks it until a debug client attaches, which this server does
  // not do yet (issue #1005): the transforms turn it off unless asked.
  describe('sub-process debugging default (issue #1005)', () => {
    it('turns subProcess off for a launch that does not name it', async () => {
      const adapter = new PythonDebugAdapter(createDependencies());
      const config = await adapter.transformLaunchConfig({ program: '/proj/a.py' } as GenericLaunchConfig);
      expect(config.subProcess).toBe(false);
      expect(adapter.consumeLaunchConfigDiagnostics?.() ?? []).toEqual([]);
    });

    it('forwards an explicit subProcess: true and says what it costs', async () => {
      const adapter = new PythonDebugAdapter(createDependencies());
      const config = await adapter.transformLaunchConfig({ program: '/proj/a.py', subProcess: true } as GenericLaunchConfig);
      expect(config.subProcess).toBe(true);
      const diagnostics = adapter.consumeLaunchConfigDiagnostics?.() ?? [];
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].key).toBe('subProcess');
      expect(diagnostics[0].scope).toBeUndefined();
      expect(diagnostics[0].message).toMatch(/#1005/);
    });

    it('keeps an explicit subProcess: false silent', async () => {
      const adapter = new PythonDebugAdapter(createDependencies());
      const config = await adapter.transformLaunchConfig({ program: '/proj/a.py', subProcess: false } as GenericLaunchConfig);
      expect(config.subProcess).toBe(false);
      expect(adapter.consumeLaunchConfigDiagnostics?.() ?? []).toEqual([]);
    });

    it('turns subProcess off for an attach too, unless asked', () => {
      const adapter = new PythonDebugAdapter(createDependencies());
      expect(adapter.transformAttachConfig!({ request: 'attach', port: 5678 }).subProcess).toBe(false);
      expect(adapter.transformAttachConfig!({ request: 'attach', port: 5678, subProcess: true }).subProcess).toBe(true);
    });
  });

  describe('adapter interpreter (#215, #993)', () => {
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

    // debugpy's launch `python` defaults to the adapter's interpreter, so a
    // pythonw.exe adapter made the debuggee windowless too and broke its
    // children's inherited standard handles (issue #993). The hidden console
    // the proxy's windowsHide spawn provides is what keeps windows off screen.
    it('runs the adapter under python.exe on win32 even when a sibling pythonw.exe exists', () => {
      (existsSync as Mock).mockReturnValue(true);
      const adapter = new PythonDebugAdapter(createDependencies());

      withPlatform('win32', () => {
        const cmd = buildCommand(adapter, 'C:\Python313\python.exe');
        expect(cmd.command).toBe('C:\Python313\python.exe');
      });
    });

    it('passes an explicit pythonw.exe through unchanged', () => {
      const adapter = new PythonDebugAdapter(createDependencies());

      withPlatform('win32', () => {
        const cmd = buildCommand(adapter, 'C:\Python313\pythonw.exe');
        expect(cmd.command).toBe('C:\Python313\pythonw.exe');
      });
    });

    it('leaves the interpreter untouched off win32', () => {
      const adapter = new PythonDebugAdapter(createDependencies());

      withPlatform('linux', () => {
        const cmd = buildCommand(adapter, '/usr/bin/python');
        expect(cmd.command).toBe('/usr/bin/python');
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
      expect(metadata.modes).toMatchObject({ launch: true, attach: 'direct-connect' })  // attachBy/attachHints are pinned by adapter-attach-contract.test.ts (issue #903);
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

    it('propagates stopOnEntry into the attach config when provided', () => {
      const adapter = new PythonDebugAdapter(createDependencies());
      const attach = adapter.transformAttachConfig({ request: 'attach', port: 5678, stopOnEntry: true });
      expect(attach.stopOnEntry).toBe(true);
    });

    it('passes pathMappings through to the debugpy attach request (issue #450)', () => {
      const adapter = new PythonDebugAdapter(createDependencies());

      const mappings = [{ localRoot: 'C:\\work\\app', remoteRoot: '/app' }];
      const config = adapter.transformAttachConfig!({
        request: 'attach',
        port: 5678,
        pathMappings: mappings
      });

      expect(config.pathMappings).toEqual(mappings);
    });

    it('passes unrecognized debugpy attach knobs through (issue #450)', () => {
      const adapter = new PythonDebugAdapter(createDependencies());

      const config = adapter.transformAttachConfig!({
        request: 'attach',
        port: 5678,
        subProcess: false,
        django: true
      });

      expect(config.subProcess).toBe(false);
      expect(config.django).toBe(true);
    });

    it('still strips bare localRoot/remoteRoot — pathMappings is the one lever (issue #450)', () => {
      const adapter = new PythonDebugAdapter(createDependencies());

      const config = adapter.transformAttachConfig!({
        request: 'attach',
        port: 5678,
        localRoot: 'C:\\work\\app',
        remoteRoot: '/app'
      });

      // The ptvsd-era sugar keys are not forwarded (debugpy's native shape is
      // pathMappings); the session layer surfaces them as dropped keys instead.
      expect(config.localRoot).toBeUndefined();
      expect(config.remoteRoot).toBeUndefined();
      expect(config.pathMappings).toBeUndefined();
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
      vi.mocked(findPythonExecutable).mockResolvedValue('/usr/bin/python');
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
      vi.mocked(findPythonExecutable).mockResolvedValue('/usr/bin/python');
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
      vi.mocked(findPythonExecutable).mockResolvedValue('/usr/bin/python');
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
        vi.mocked(findPythonExecutable).mockResolvedValue('/usr/bin/python');
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
