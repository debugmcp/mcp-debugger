/**
 * Unit tests for per-mode language availability computation (issue #331)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  computeModeAvailability,
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
