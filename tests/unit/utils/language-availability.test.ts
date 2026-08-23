/**
 * Unit tests for per-mode language availability computation (issue #331)
 * and the shared per-entry availability probe (issue #435).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  computeModeAvailability,
  probeLanguageEntry,
  ValidationResultCache
} from '../../../src/utils/language-availability.js';

const ok = { valid: true, errors: [], warnings: [] };
const bad = (msg: string) => ({ valid: false, errors: [msg], warnings: [] });

describe('computeModeAvailability', () => {
  it('reports both modes available for an installed direct-connect adapter with a valid toolchain', async () => {
    const modes = await computeModeAvailability({
      language: 'python',
      packageName: '@debugmcp/adapter-python',
      installed: true,
      disabled: false,
      attach: 'direct-connect',
      validate: async () => ok
    });
    expect(modes).toEqual({
      launch: { supported: true, available: true },
      attach: { supported: true, available: true }
    });
  });

  it('keeps attach available when the toolchain probe fails on a direct-connect adapter', async () => {
    const modes = await computeModeAvailability({
      language: 'ruby',
      packageName: '@debugmcp/adapter-ruby',
      installed: true,
      disabled: false,
      attach: 'direct-connect',
      validate: async () => bad('Ruby executable not found')
    });
    expect(modes.launch).toEqual({
      supported: true,
      available: false,
      reason: 'Ruby executable not found'
    });
    expect(modes.attach).toEqual({ supported: true, available: true });
  });

  it('mirrors the toolchain result onto attach for spawn adapters', async () => {
    const modes = await computeModeAvailability({
      language: 'java',
      packageName: '@debugmcp/adapter-java',
      installed: true,
      disabled: false,
      attach: 'spawn',
      validate: async () => bad('JDK not found')
    });
    expect(modes.launch.available).toBe(false);
    expect(modes.attach).toEqual({
      supported: true,
      available: false,
      reason: 'JDK not found'
    });
  });

  it("marks attach unsupported when the adapter declares 'none'", async () => {
    const modes = await computeModeAvailability({
      language: 'rust',
      packageName: '@debugmcp/adapter-rust',
      installed: true,
      disabled: false,
      attach: 'none',
      validate: async () => ok
    });
    expect(modes.launch).toEqual({ supported: true, available: true });
    expect(modes.attach.supported).toBe(false);
    expect(modes.attach.available).toBe(false);
    expect(modes.attach.reason).toContain('does not implement attach');
  });

  it('reports both modes unavailable with a disabled reason and skips the probe when disabled', async () => {
    const validate = vi.fn();
    const modes = await computeModeAvailability({
      language: 'go',
      packageName: '@debugmcp/adapter-go',
      installed: true,
      disabled: true,
      attach: 'spawn',
      validate
    });
    expect(modes.launch.available).toBe(false);
    expect(modes.launch.reason).toContain('disabled in this runtime');
    expect(modes.attach.available).toBe(false);
    expect(modes.attach.reason).toContain('disabled in this runtime');
    expect(modes.attach.supported).toBe(true);
    expect(validate).not.toHaveBeenCalled();
  });

  it('reports both modes unavailable with a not-installed reason when the package is missing', async () => {
    const modes = await computeModeAvailability({
      language: 'dotnet',
      packageName: '@debugmcp/adapter-dotnet',
      installed: false,
      disabled: false,
      attach: 'spawn'
    });
    expect(modes.launch.available).toBe(false);
    expect(modes.launch.reason).toContain('@debugmcp/adapter-dotnet');
    expect(modes.attach.available).toBe(false);
  });

  it('fails open (available) and logs a warning when validate throws', async () => {
    const warn = vi.fn();
    const modes = await computeModeAvailability({
      language: 'python',
      packageName: '@debugmcp/adapter-python',
      installed: true,
      disabled: false,
      attach: 'spawn',
      validate: async () => {
        throw new Error('probe exploded');
      },
      logger: { warn }
    });
    expect(modes.launch).toEqual({ supported: true, available: true });
    expect(modes.attach).toEqual({ supported: true, available: true });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('probe exploded'));
  });

  it('assumes a valid toolchain when no validate probe is provided', async () => {
    const modes = await computeModeAvailability({
      language: 'mock',
      packageName: '@debugmcp/adapter-mock',
      installed: true,
      disabled: false,
      attach: 'none'
    });
    expect(modes.launch).toEqual({ supported: true, available: true });
  });
});

describe('probeLanguageEntry (issue #435)', () => {
  const entry = (overrides: Record<string, unknown> = {}) => ({
    language: 'python',
    packageName: '@debugmcp/adapter-python',
    installed: true,
    attach: 'direct-connect' as const,
    ...overrides
  });

  const makeFactory = (overrides: Record<string, unknown> = {}) => ({
    validate: vi.fn().mockResolvedValue(ok),
    getMetadata: vi.fn().mockReturnValue({ modes: { launch: true, attach: 'spawn' } }),
    createAdapter: vi.fn(),
    ...overrides
  });

  it('does not load the factory for a disabled language and reports disabled modes', async () => {
    const getFactory = vi.fn();

    const probe = await probeLanguageEntry(entry(), {
      registry: { getFactory },
      disabledSet: new Set(['python'])
    });

    expect(probe.disabled).toBe(true);
    expect(getFactory).not.toHaveBeenCalled();
    expect(probe.factory).toBeUndefined();
    expect(probe.modes.launch.available).toBe(false);
    expect(probe.modes.launch.reason).toContain('disabled in this runtime');
  });

  it('does not load the factory for a not-installed package and reports not-installed modes', async () => {
    const getFactory = vi.fn();

    const probe = await probeLanguageEntry(entry({ installed: false }), {
      registry: { getFactory },
      disabledSet: new Set()
    });

    expect(getFactory).not.toHaveBeenCalled();
    expect(probe.modes.launch.reason).toContain('@debugmcp/adapter-python');
  });

  it('prefers the loaded factory metadata attach over the registry entry attach', async () => {
    const factory = makeFactory(); // metadata declares 'spawn'

    const probe = await probeLanguageEntry(entry({ attach: 'none' }), {
      registry: { getFactory: vi.fn().mockResolvedValue(factory) },
      disabledSet: new Set()
    });

    // entry said 'none' (unsupported); metadata's 'spawn' must win
    expect(probe.modes.attach.supported).toBe(true);
  });

  it('falls back to the entry attach when getMetadata throws, and logs a warning', async () => {
    const warn = vi.fn();
    const factory = makeFactory({
      getMetadata: vi.fn(() => {
        throw new Error('metadata exploded');
      })
    });

    const probe = await probeLanguageEntry(entry({ attach: 'direct-connect' }), {
      registry: { getFactory: vi.fn().mockResolvedValue(factory) },
      disabledSet: new Set(),
      logger: { warn }
    });

    expect(probe.modes.attach.supported).toBe(true); // direct-connect from the entry
    expect(probe.modes.launch.available).toBe(true);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('metadata exploded'));
  });

  it('normalizes an unknown metadata attach string instead of producing undefined attach modes', async () => {
    // A version-skewed third-party factory (plain JS) can return any string;
    // computeModeAvailability's switch is not exhaustive, so an unknown value
    // must be normalized here or modes.attach comes back undefined and
    // crashes consumers.
    const factory = makeFactory({
      getMetadata: vi.fn().mockReturnValue({ modes: { launch: true, attach: 'tcp' } })
    });

    const probe = await probeLanguageEntry(entry({ attach: 'direct-connect' }), {
      registry: { getFactory: vi.fn().mockResolvedValue(factory) },
      disabledSet: new Set()
    });

    expect(probe.modes.attach).toBeDefined();
    expect(probe.modes.attach.supported).toBe(true); // fell back to the entry's direct-connect
  });

  it("normalizes to 'none' when both metadata and entry attach are unknown strings", async () => {
    const factory = makeFactory({
      getMetadata: vi.fn().mockReturnValue({ modes: { launch: true, attach: 'tcp' } })
    });

    const probe = await probeLanguageEntry(
      entry({ attach: 'udp' as never }),
      {
        registry: { getFactory: vi.fn().mockResolvedValue(factory) },
        disabledSet: new Set()
      }
    );

    expect(probe.modes.attach).toBeDefined();
    expect(probe.modes.attach.supported).toBe(false); // treated as 'none'
  });

  it('records a factory load failure and fails open like the server', async () => {
    const probe = await probeLanguageEntry(entry(), {
      registry: { getFactory: vi.fn().mockRejectedValue(new Error('import exploded')) },
      disabledSet: new Set()
    });

    expect(probe.factory).toBeUndefined();
    expect(probe.factoryLoadError).toBeInstanceOf(Error);
    // No factory means no probe: availability is assumed (issue #360 contract)
    expect(probe.modes.launch.available).toBe(true);
  });

  it('assumes availability when the registry has no getFactory at all', async () => {
    const probe = await probeLanguageEntry(entry(), {
      registry: undefined,
      disabledSet: new Set()
    });

    expect(probe.modes.launch.available).toBe(true);
  });

  it('routes validate through the runValidate wrapper and carries the result on the probe', async () => {
    const factory = makeFactory();
    const runValidate = vi.fn(async (_language: string, validate: () => Promise<typeof ok>) => {
      return validate();
    });

    const probe = await probeLanguageEntry(entry(), {
      registry: { getFactory: vi.fn().mockResolvedValue(factory) },
      disabledSet: new Set(),
      runValidate
    });

    expect(runValidate).toHaveBeenCalledWith('python', expect.any(Function));
    expect(factory.validate).toHaveBeenCalledTimes(1);
    expect(probe.probeable).toBe(true);
    expect(probe.validation).toEqual(ok);
    expect(probe.validationError).toBeUndefined();
    expect(probe.modes.launch.available).toBe(true);
  });

  it('drives modes from the wrapper result, not a second validate call', async () => {
    const factory = makeFactory();
    const runValidate = vi.fn().mockResolvedValue(bad('toolchain gone'));

    const probe = await probeLanguageEntry(entry(), {
      registry: { getFactory: vi.fn().mockResolvedValue(factory) },
      disabledSet: new Set(),
      runValidate
    });

    expect(probe.validation).toEqual(bad('toolchain gone'));
    expect(probe.modes.launch).toEqual({
      supported: true,
      available: false,
      reason: 'toolchain gone'
    });
    expect(factory.validate).not.toHaveBeenCalled();
  });

  it('fails open and records validationError when the wrapped validate throws', async () => {
    const warn = vi.fn();
    const factory = makeFactory({ validate: vi.fn().mockRejectedValue(new Error('probe exploded')) });

    const probe = await probeLanguageEntry(entry(), {
      registry: { getFactory: vi.fn().mockResolvedValue(factory) },
      disabledSet: new Set(),
      logger: { warn }
    });

    expect(probe.validation).toBeUndefined();
    expect(probe.validationError).toBeInstanceOf(Error);
    expect(probe.modes.launch.available).toBe(true);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('probe exploded'));
  });

  it('marks a factory without a validate function unprobeable (assume valid) and logs a warning', async () => {
    const warn = vi.fn();
    const factory = { getMetadata: vi.fn().mockReturnValue({}) };

    const probe = await probeLanguageEntry(entry(), {
      registry: { getFactory: vi.fn().mockResolvedValue(factory) },
      disabledSet: new Set(),
      logger: { warn }
    });

    expect(probe.probeable).toBe(false);
    expect(probe.factory).toBeDefined();
    expect(probe.modes.launch.available).toBe(true);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('validate'));
  });
});

describe('ValidationResultCache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('caches results within the TTL and re-probes after expiry', async () => {
    const cache = new ValidationResultCache(30_000);
    const validate = vi.fn().mockResolvedValue(ok);

    await cache.get('ruby', validate);
    await cache.get('ruby', validate);
    expect(validate).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(31_000);
    await cache.get('ruby', validate);
    expect(validate).toHaveBeenCalledTimes(2);
  });

  it('caches per language', async () => {
    const cache = new ValidationResultCache(30_000);
    const validateA = vi.fn().mockResolvedValue(ok);
    const validateB = vi.fn().mockResolvedValue(bad('nope'));

    const a = await cache.get('a', validateA);
    const b = await cache.get('b', validateB);
    expect(a.valid).toBe(true);
    expect(b.valid).toBe(false);
    expect(validateA).toHaveBeenCalledTimes(1);
    expect(validateB).toHaveBeenCalledTimes(1);
  });

  it('clear() drops cached entries', async () => {
    const cache = new ValidationResultCache(30_000);
    const validate = vi.fn().mockResolvedValue(ok);
    await cache.get('ruby', validate);
    cache.clear();
    await cache.get('ruby', validate);
    expect(validate).toHaveBeenCalledTimes(2);
  });
});
