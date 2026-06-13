import { describe, it, expect, afterEach, vi } from 'vitest';
import { RubyDebugAdapter } from '../../src/ruby-debug-adapter.js';
import { AdapterError, AdapterState, DebugFeature } from '@debugmcp/shared';

vi.mock('../../src/utils/ruby-utils.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/utils/ruby-utils.js')>();
  return {
    ...actual,
    findRubyExecutable: vi.fn(),
    getRubyVersion: vi.fn(),
    findRdbgExecutable: vi.fn(),
    getRdbgVersion: vi.fn(),
    getRubySearchPaths: vi.fn().mockReturnValue(['/usr/bin'])
  };
});

const { findRubyExecutable, getRubyVersion, findRdbgExecutable, getRdbgVersion, getRubySearchPaths } = await import('../../src/utils/ruby-utils.js');

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

describe('RubyDebugAdapter', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('caches resolveExecutablePath results', async () => {
    vi.mocked(findRubyExecutable).mockResolvedValue('/usr/bin/ruby');
    const adapter = new RubyDebugAdapter(createDependencies());

    const first = await adapter.resolveExecutablePath();
    const second = await adapter.resolveExecutablePath();

    expect(first).toBe('/usr/bin/ruby');
    expect(second).toBe('/usr/bin/ruby');
    expect(findRubyExecutable).toHaveBeenCalledTimes(1);
  });

  it('marks environment invalid when Ruby version is too old', async () => {
    vi.mocked(findRubyExecutable).mockResolvedValue('/usr/bin/ruby');
    vi.mocked(getRubyVersion).mockResolvedValue('2.6.10');
    vi.mocked(findRdbgExecutable).mockResolvedValue('/usr/bin/rdbg');
    vi.mocked(getRdbgVersion).mockResolvedValue('1.9.1');

    const adapter = new RubyDebugAdapter(createDependencies());
    const result = await adapter.validateEnvironment();

    expect(result.valid).toBe(false);
    expect(result.errors[0]?.code).toBe('RUBY_VERSION_TOO_OLD');
  });

  it('reports missing rdbg', async () => {
    vi.mocked(findRubyExecutable).mockResolvedValue('/usr/bin/ruby');
    vi.mocked(getRubyVersion).mockResolvedValue('3.3.0');
    vi.mocked(findRdbgExecutable).mockRejectedValue(new Error('rdbg not found'));

    const adapter = new RubyDebugAdapter(createDependencies());
    const result = await adapter.validateEnvironment();

    expect(result.valid).toBe(false);
    expect(result.errors.map((entry) => entry.code)).toContain('RDBG_NOT_FOUND');
  });

  it('builds an rdbg adapter command', () => {
    const adapter = new RubyDebugAdapter(createDependencies());
    (adapter as unknown as { rdbgPathCache: Map<string, { path: string; timestamp: number }> })
      .rdbgPathCache.set('default', { path: '/usr/bin/rdbg', timestamp: Date.now() });

    const command = adapter.buildAdapterCommand({
      sessionId: 'ruby-session',
      executablePath: '/usr/bin/ruby',
      adapterHost: '127.0.0.1',
      adapterPort: 8123,
      logDir: '/tmp/logs',
      scriptPath: '/workspace/app.rb',
      scriptArgs: ['one', 'two'],
      launchConfig: {}
    });

    expect(command.command).toBe('/usr/bin/rdbg');
    expect(command.args).toEqual([
      '--open',
      '--host', '127.0.0.1',
      '--port', '8123',
      '-c',
      '--',
      '/usr/bin/ruby',
      '/workspace/app.rb',
      'one',
      'two'
    ]);
  });

  it('builds a launch config with rdbg fields', async () => {
    const adapter = new RubyDebugAdapter(createDependencies());
    const config = await adapter.transformLaunchConfig({
      program: '/workspace/app.rb',
      stopOnEntry: true,
      justMyCode: false
    });

    expect(config.type).toBe('rdbg');
    expect(config.request).toBe('launch');
    expect(config.script).toBe('/workspace/app.rb');
    expect(config.localfs).toBe(true);
    expect(config.stopOnEntry).toBe(true);
  });

  it('transforms attach config for an existing rdbg port', () => {
    const adapter = new RubyDebugAdapter(createDependencies());
    const config = adapter.transformAttachConfig({
      request: 'attach',
      host: '127.0.0.1',
      port: 12345,
      stopOnEntry: true
    });

    expect(adapter.supportsAttach?.()).toBe(true);
    expect(adapter.supportsDetach?.()).toBe(true);
    expect(adapter.usesDirectConnectForAttach?.()).toBe(true);
    expect(config).toEqual(
      expect.objectContaining({
        type: 'rdbg',
        request: 'attach',
        host: '127.0.0.1',
        port: 12345,
        localfs: true,
        stopOnEntry: true
      })
    );
  });

  it('exposes ruby capabilities and lifecycle transitions', async () => {
    const adapter = new RubyDebugAdapter(createDependencies());

    expect(adapter.supportsFeature(DebugFeature.CONDITIONAL_BREAKPOINTS)).toBe(true);
    expect(adapter.supportsFeature(DebugFeature.DATA_BREAKPOINTS)).toBe(false);
    expect(adapter.getCapabilities().supportsFunctionBreakpoints).toBe(true);

    vi.spyOn(adapter, 'validateEnvironment').mockResolvedValue({ valid: true, errors: [], warnings: [] });
    await adapter.initialize();
    expect(adapter.getState()).toBe(AdapterState.READY);

    await adapter.connect('127.0.0.1', 8123);
    expect(adapter.getState()).toBe(AdapterState.CONNECTED);
    await adapter.disconnect();
    expect(adapter.getState()).toBe(AdapterState.DISCONNECTED);
  });

  it('throws AdapterError when environment validation fails during initialize', async () => {
    const adapter = new RubyDebugAdapter(createDependencies());
    vi.spyOn(adapter, 'validateEnvironment').mockResolvedValue({
      valid: false,
      errors: [{ code: 'BAD_ENV', message: 'bad env', recoverable: false }],
      warnings: []
    });

    await expect(adapter.initialize()).rejects.toBeInstanceOf(AdapterError);
    expect(adapter.getState()).toBe(AdapterState.ERROR);
  });

  it('validates the environment via the resolved toolchain', async () => {
    vi.mocked(findRubyExecutable).mockResolvedValue('/usr/bin/ruby');
    vi.mocked(getRubyVersion).mockResolvedValue('3.3.0');
    vi.mocked(findRdbgExecutable).mockResolvedValue('/usr/bin/rdbg');
    vi.mocked(getRdbgVersion).mockResolvedValue('1.11.0');

    const adapter = new RubyDebugAdapter(createDependencies());
    const result = await adapter.validateEnvironment();
    expect(result.valid).toBe(true);

    // Version results are cached: a second validation must not re-probe
    await adapter.validateEnvironment();
    expect(getRubyVersion).toHaveBeenCalledTimes(1);
  });

  it('warns but stays valid when versions cannot be determined', async () => {
    vi.mocked(findRubyExecutable).mockResolvedValue('/usr/bin/ruby');
    vi.mocked(getRubyVersion).mockResolvedValue(null);
    vi.mocked(findRdbgExecutable).mockResolvedValue('/usr/bin/rdbg');
    vi.mocked(getRdbgVersion).mockResolvedValue(null);

    const result = await new RubyDebugAdapter(createDependencies()).validateEnvironment();
    expect(result.valid).toBe(true);
    expect(result.warnings.map(w => w.code)).toEqual(
      expect.arrayContaining(['RUBY_VERSION_CHECK_FAILED', 'RDBG_VERSION_CHECK_FAILED'])
    );
  });

  it('builds a bundler target command when useBundler is set', () => {
    const adapter = new RubyDebugAdapter(createDependencies());
    (adapter as unknown as { rdbgPathCache: Map<string, { path: string; timestamp: number }> })
      .rdbgPathCache.set('default', { path: '/usr/bin/rdbg', timestamp: Date.now() });

    const command = adapter.buildAdapterCommand({
      sessionId: 's',
      executablePath: '/usr/bin/ruby',
      adapterHost: '127.0.0.1',
      adapterPort: 9000,
      logDir: '/tmp',
      scriptPath: '/workspace/bin/rspec',
      scriptArgs: ['spec/a_spec.rb'],
      launchConfig: { useBundler: true, bundlePath: '/usr/bin/bundle' }
    } as never);

    const dashDash = command.args.indexOf('--');
    expect(command.args.slice(dashDash + 1)).toEqual([
      '/usr/bin/bundle', 'exec', '/usr/bin/ruby', '/workspace/bin/rspec', 'spec/a_spec.rb'
    ]);
  });

  it('transforms launch config extras (command, localfsMap, bundler flags)', async () => {
    const adapter = new RubyDebugAdapter(createDependencies());
    const config = await adapter.transformLaunchConfig({
      script: '/w/app.rb',
      command: 'rails server',
      localfsMap: '/remote:/local',
      bundlePath: '/usr/bin/bundle',
      useBundler: true,
      localfs: false
    } as never);

    expect(config).toMatchObject({
      script: '/w/app.rb',
      command: 'rails server',
      localfsMap: '/remote:/local',
      bundlePath: '/usr/bin/bundle',
      useBundler: true,
      localfs: false
    });
  });

  it('passes localfsMap, cwd, and env through the attach config', () => {
    const adapter = new RubyDebugAdapter(createDependencies());
    const config = adapter.transformAttachConfig({
      request: 'attach',
      host: '10.0.0.1',
      port: 4000,
      localfsMap: '/app:/local/app',
      cwd: '/local/app',
      env: { RAILS_ENV: 'test' }
    } as never);

    expect(config).toMatchObject({
      host: '10.0.0.1',
      port: 4000,
      localfs: false, // non-local host
      localfsMap: '/app:/local/app',
      cwd: '/local/app',
      env: { RAILS_ENV: 'test' }
    });
  });

  it('rejects attach without a numeric port', () => {
    const adapter = new RubyDebugAdapter(createDependencies());
    expect(() => adapter.transformAttachConfig({ request: 'attach', host: 'x' } as never))
      .toThrow(AdapterError);
  });

  it('tracks state and thread id from DAP events', () => {
    const adapter = new RubyDebugAdapter(createDependencies());

    adapter.handleDapEvent({ seq: 1, type: 'event', event: 'stopped', body: { threadId: 7 } });
    expect(adapter.getState()).toBe(AdapterState.DEBUGGING);
    expect(adapter.getCurrentThreadId()).toBe(7);

    adapter.handleDapEvent({ seq: 2, type: 'event', event: 'continued' });
    expect(adapter.getState()).toBe(AdapterState.DEBUGGING);

    adapter.handleDapEvent({ seq: 3, type: 'event', event: 'terminated' });
    expect(adapter.getState()).toBe(AdapterState.DISCONNECTED);

    // No-throw surface for responses
    adapter.handleDapResponse({ seq: 4, type: 'response', request_seq: 1, success: true, command: 'next' });
  });

  it('translates common error messages', () => {
    const adapter = new RubyDebugAdapter(createDependencies());
    expect(adapter.translateErrorMessage(new Error('rdbg not found anywhere')))
      .toContain('gem install debug');
    expect(adapter.translateErrorMessage(new Error('Ruby not found on PATH')))
      .toContain('Ruby 2.7+');
    expect(adapter.translateErrorMessage(new Error('Permission denied for /usr/bin/rdbg')))
      .toContain('Permission denied');
    expect(adapter.translateErrorMessage(new Error('connection refused by host')))
      .toContain('rdbg DAP server');
    expect(adapter.translateErrorMessage(new Error('something else'))).toBe('something else');
  });

  it('reports feature support and requirements', () => {
    const adapter = new RubyDebugAdapter(createDependencies());
    expect(adapter.supportsFeature(DebugFeature.EXCEPTION_BREAKPOINTS)).toBe(true);
    expect(adapter.getFeatureRequirements(DebugFeature.CONDITIONAL_BREAKPOINTS)).toHaveLength(1);
    expect(adapter.getFeatureRequirements(DebugFeature.EXCEPTION_BREAKPOINTS)).toHaveLength(1);
    expect(adapter.getFeatureRequirements(DebugFeature.STEP_BACK)).toHaveLength(0);
  });

  it('exposes toolchain metadata and helper strings', () => {
    vi.mocked(getRubySearchPaths).mockReturnValue(['/usr/bin']);
    const adapter = new RubyDebugAdapter(createDependencies());
    expect(adapter.getAdapterModuleName()).toBe('rdbg');
    expect(adapter.getAdapterInstallCommand()).toBe('gem install debug');
    expect(adapter.getInstallationInstructions()).toContain('gem install debug');
    expect(adapter.getMissingExecutableError()).toContain('Ruby');
    expect(adapter.getExecutableSearchPaths()).toEqual(['/usr/bin']);
    expect(['ruby', 'ruby.exe']).toContain(adapter.getDefaultExecutableName());
    expect(adapter.getDefaultLaunchConfig().justMyCode).toBe(true);
    expect(adapter.getDefaultAttachConfig?.()).toMatchObject({ request: 'attach', host: '127.0.0.1' });
    expect(adapter.isReady()).toBe(false);
  });

  it('disposes cleanly back to UNINITIALIZED', async () => {
    vi.mocked(findRubyExecutable).mockResolvedValue('/usr/bin/ruby');
    const adapter = new RubyDebugAdapter(createDependencies());
    await adapter.resolveExecutablePath();
    await adapter.dispose();
    expect(adapter.getState()).toBe(AdapterState.UNINITIALIZED);
    expect(adapter.isConnected()).toBe(false);
  });

  it('sendDapRequest is a stub (the proxy owns the DAP transport)', async () => {
    const adapter = new RubyDebugAdapter(createDependencies());
    await expect(adapter.sendDapRequest('threads')).resolves.toEqual({});
  });
});
