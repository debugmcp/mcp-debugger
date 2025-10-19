import { describe, it, expect, afterEach, vi, type Mock } from 'vitest';
import { EventEmitter } from 'events';
import { PythonDebugAdapter } from '../../../packages/adapter-python/src/python-debug-adapter.js';
import { AdapterState, AdapterError, DebugFeature } from '@debugmcp/shared';

vi.mock('child_process', () => ({
  spawn: vi.fn()
}));

vi.mock('../../../packages/adapter-python/src/utils/python-utils.js', () => ({
  findPythonExecutable: vi.fn(),
  getPythonVersion: vi.fn()
}));

const { findPythonExecutable, getPythonVersion } = await import('../../../packages/adapter-python/src/utils/python-utils.js');
const { spawn } = await import('child_process');

const createDependencies = () => ({
  fileSystem: {} as unknown,
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  },
  environment: {} as unknown,
  processLauncher: {} as unknown,
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
      { stdio: ['ignore', 'pipe', 'pipe'] }
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

  it('transforms launch configuration with python defaults', () => {
    const adapter = new PythonDebugAdapter(createDependencies());
    const config = adapter.transformLaunchConfig({
      type: 'python',
      request: 'launch',
      name: 'Test',
      stopOnEntry: true,
      justMyCode: false
    });

    expect(config.name).toBe('Python: Current File');
    expect(config.console).toBe('integratedTerminal');
    expect(config.redirectOutput).toBe(true);
    expect(config.showReturnValue).toBe(true);
    expect(config.stopOnEntry).toBe(true);
    expect(config.justMyCode).toBe(false);
  });
});
