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

const { findRubyExecutable, getRubyVersion, findRdbgExecutable, getRdbgVersion } = await import('../../src/utils/ruby-utils.js');

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
});
