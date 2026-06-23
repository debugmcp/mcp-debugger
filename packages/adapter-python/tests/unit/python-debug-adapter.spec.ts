import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdapterState } from '@debugmcp/shared';
import { PythonDebugAdapter } from '../../src/python-debug-adapter.js';
import type { AdapterDependencies } from '@debugmcp/shared';

const createDependencies = (): AdapterDependencies & {
  logger: { info: ReturnType<typeof vi.fn>; debug: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
} => ({
  fileSystem: {} as any,
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

  it('initialize succeeds with a warning when debugpy is missing from the auto-detected interpreter', async () => {
    // Registration/init runs without a configured interpreter, so a missing debugpy must NOT block:
    // it is re-checked at launch against the user's real executablePath. Regression guard for #106/#16.
    const adapter = new PythonDebugAdapter(deps);
    (adapter as any).resolveExecutablePath = vi.fn().mockResolvedValue('/usr/bin/python3');
    (adapter as any).checkPythonVersion = vi.fn().mockResolvedValue('3.10.1');
    (adapter as any).checkDebugpyInstalled = vi.fn().mockResolvedValue(false);
    (adapter as any).detectVirtualEnv = vi.fn().mockResolvedValue(false);

    await adapter.initialize();
    expect(adapter.getState()).toBe(AdapterState.READY);
    expect(adapter.isReady()).toBe(true);
  });

  it('validateEnvironment reports version as error and missing debugpy as a warning when auto-detected', async () => {
    const adapter = new PythonDebugAdapter(deps);
    (adapter as any).resolveExecutablePath = vi.fn().mockResolvedValue('/usr/bin/python');
    (adapter as any).checkPythonVersion = vi.fn().mockResolvedValue('3.6.9');
    (adapter as any).checkDebugpyInstalled = vi.fn().mockResolvedValue(false);
    (adapter as any).detectVirtualEnv = vi.fn().mockResolvedValue(true);

    const result = await adapter.validateEnvironment();
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'PYTHON_VERSION_TOO_OLD' })]),
    );
    // No explicit interpreter was provided, so a missing debugpy is a warning, not an error.
    expect(result.errors.some((e) => e.code === 'DEBUGPY_NOT_INSTALLED')).toBe(false);
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'DEBUGPY_NOT_INSTALLED' })]),
    );
    expect(deps.logger.info).toHaveBeenCalledWith('[PythonDebugAdapter] Virtual environment detected');
  });

  describe('configured-interpreter validation (issue #106)', () => {
    it('forwards the configured executablePath to resolveExecutablePath', async () => {
      // Root-cause guard: validateEnvironment must check the interpreter the user configured,
      // not an auto-detected one. Pre-fix this was called with undefined.
      const adapter = new PythonDebugAdapter(deps);
      const resolveSpy = vi.fn().mockResolvedValue('/project/.venv/bin/python');
      (adapter as any).resolveExecutablePath = resolveSpy;
      (adapter as any).checkPythonVersion = vi.fn().mockResolvedValue('3.12.0');
      (adapter as any).checkDebugpyInstalled = vi.fn().mockResolvedValue(true);
      (adapter as any).detectVirtualEnv = vi.fn().mockResolvedValue(true);

      await adapter.validateEnvironment('/project/.venv/bin/python');

      expect(resolveSpy).toHaveBeenCalledWith('/project/.venv/bin/python');
    });

    it('passes when the configured venv python has debugpy even if the global one does not', async () => {
      const adapter = new PythonDebugAdapter(deps);
      // resolveExecutablePath echoes an explicit preferred path, as findPythonExecutable does.
      (adapter as any).resolveExecutablePath = vi.fn(async (p?: string) => p ?? '/usr/bin/python3');
      (adapter as any).checkPythonVersion = vi.fn().mockResolvedValue('3.12.0');
      (adapter as any).checkDebugpyInstalled = vi.fn(async (p: string) => p === '/project/.venv/bin/python');
      (adapter as any).detectVirtualEnv = vi.fn().mockResolvedValue(true);

      const result = await adapter.validateEnvironment('/project/.venv/bin/python');

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('reports missing debugpy as an error when an explicit interpreter was provided', async () => {
      const adapter = new PythonDebugAdapter(deps);
      (adapter as any).resolveExecutablePath = vi.fn(async (p?: string) => p ?? '/usr/bin/python3');
      (adapter as any).checkPythonVersion = vi.fn().mockResolvedValue('3.12.0');
      (adapter as any).checkDebugpyInstalled = vi.fn().mockResolvedValue(false);
      (adapter as any).detectVirtualEnv = vi.fn().mockResolvedValue(false);

      const result = await adapter.validateEnvironment('/project/.venv/bin/python');

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: 'DEBUGPY_NOT_INSTALLED' })]),
      );
    });
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
