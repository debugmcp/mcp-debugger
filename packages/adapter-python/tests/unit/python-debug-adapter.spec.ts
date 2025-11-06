import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdapterState, AdapterErrorCode } from '@debugmcp/shared';
import { PythonDebugAdapter } from '../../src/python-debug-adapter.js';
import type { AdapterDependencies } from '@debugmcp/shared';

const createDependencies = (): AdapterDependencies & {
  logger: { info: ReturnType<typeof vi.fn>; debug: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
} => ({
  fileSystem: {} as any,
  processLauncher: {} as any,
  environment: {
    get: () => undefined,
    getAll: () => ({}),
    getCurrentWorkingDirectory: () => '/tmp',
  },
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  },
});

const setSuccessfulEnvironment = (adapter: PythonDebugAdapter) => {
  (adapter as any).resolveExecutablePath = vi.fn().mockResolvedValue('/usr/bin/python3');
  (adapter as any).checkPythonVersion = vi.fn().mockResolvedValue('3.10.1');
  (adapter as any).checkDebugpyInstalled = vi.fn().mockResolvedValue(true);
  (adapter as any).detectVirtualEnv = vi.fn().mockResolvedValue(false);
};

describe('PythonDebugAdapter', () => {
  let deps: ReturnType<typeof createDependencies>;

  beforeEach(() => {
    deps = createDependencies();
  });

  it('transitions to READY on successful initialize', async () => {
    const adapter = new PythonDebugAdapter(deps);
    setSuccessfulEnvironment(adapter);

    const events: string[] = [];
    adapter.on('initialized', () => events.push('initialized'));

    await adapter.initialize();

    expect(adapter.getState()).toBe(AdapterState.READY);
    expect(adapter.isReady()).toBe(true);
    expect(events).toContain('initialized');
  });

  it('fails initialize when debugpy is missing', async () => {
    const adapter = new PythonDebugAdapter(deps);
    (adapter as any).resolveExecutablePath = vi.fn().mockResolvedValue('/usr/bin/python3');
    (adapter as any).checkPythonVersion = vi.fn().mockResolvedValue('3.10.1');
    (adapter as any).checkDebugpyInstalled = vi.fn().mockResolvedValue(false);
    (adapter as any).detectVirtualEnv = vi.fn().mockResolvedValue(false);

    await expect(adapter.initialize()).rejects.toMatchObject({
      code: AdapterErrorCode.ENVIRONMENT_INVALID,
    });
    expect(adapter.getState()).toBe(AdapterState.ERROR);
  });

  it('validateEnvironment reports version and debugpy issues', async () => {
    const adapter = new PythonDebugAdapter(deps);
    (adapter as any).resolveExecutablePath = vi.fn().mockResolvedValue('/usr/bin/python');
    (adapter as any).checkPythonVersion = vi.fn().mockResolvedValue('3.6.9');
    (adapter as any).checkDebugpyInstalled = vi.fn().mockResolvedValue(false);
    (adapter as any).detectVirtualEnv = vi.fn().mockResolvedValue(true);

    const result = await adapter.validateEnvironment();
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'PYTHON_VERSION_TOO_OLD' }),
        expect.objectContaining({ code: 'DEBUGPY_NOT_INSTALLED' }),
      ]),
    );
    expect(deps.logger.info).toHaveBeenCalledWith('[PythonDebugAdapter] Virtual environment detected');
  });

  it('dispose resets state to UNINITIALIZED', async () => {
    const adapter = new PythonDebugAdapter(deps);
    setSuccessfulEnvironment(adapter);
    await adapter.initialize();

    await adapter.dispose();
    expect(adapter.getState()).toBe(AdapterState.UNINITIALIZED);
    expect(adapter.getCurrentThreadId()).toBeNull();
    expect(adapter.isReady()).toBe(false);
  });

  it('translateErrorMessage provides friendly text for ENOENT', () => {
    const adapter = new PythonDebugAdapter(deps);
    const message = adapter.translateErrorMessage(new Error('ENOENT: no such file'));
    expect(message).toContain('ENOENT');
  });
});
