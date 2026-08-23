import { describe, it, expect } from 'vitest';
import { isAdapterRegistry, isAdapterFactory } from '../../src/index.js';

const noop = () => undefined;

describe('isAdapterRegistry', () => {
  const fullRegistry = {
    register: noop,
    unregister: noop,
    create: noop,
    getSupportedLanguages: noop,
    isLanguageSupported: noop,
    listLanguages: noop,
    listAvailableAdapters: noop,
    getFactory: noop,
    getFactoryMetadata: noop,
    getAdapterInfo: noop,
    getAllAdapterInfo: noop,
    disposeAll: noop,
    getActiveAdapterCount: noop
  };

  it('accepts a registry with the full typed surface', () => {
    expect(isAdapterRegistry(fullRegistry)).toBe(true);
  });

  it('rejects a legacy registry missing the typed discovery surface (issue #435 part 4)', () => {
    // Pre-part-4 registries had only register/create/getSupportedLanguages;
    // certifying one would reintroduce guard-shaped duck-typing: callers of
    // the new required members would TypeError at runtime.
    expect(
      isAdapterRegistry({ register: noop, create: noop, getSupportedLanguages: noop })
    ).toBe(false);
  });

  it('rejects non-objects', () => {
    expect(isAdapterRegistry(null)).toBe(false);
    expect(isAdapterRegistry(undefined)).toBe(false);
    expect(isAdapterRegistry('registry')).toBe(false);
  });
});

describe('isAdapterFactory', () => {
  it('accepts a factory without the optional describeToolchain member', () => {
    expect(
      isAdapterFactory({ createAdapter: noop, getMetadata: noop, validate: noop })
    ).toBe(true);
  });
});
