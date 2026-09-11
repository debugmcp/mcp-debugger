import { describe, it, expect } from 'vitest';
import type { AdapterDependencies } from '@debugmcp/shared';
import {
  createMockAdapterDependencies,
  createMockEnvironment
} from '../../../../tests/test-utils/helpers/adapter-dependencies.js';
import { DebugFeature, DebugLanguage } from '@debugmcp/shared';
import { MockAdapterFactory, createMockAdapterFactory } from '../../src/mock-adapter-factory.js';
import { MockDebugAdapter } from '../../src/mock-debug-adapter.js';

// These adapters read `process.env` directly and never consult `dependencies.environment`
// (nor `dependencies.fileSystem`), but the inline double this replaced reported an *empty*
// environment — keep that, so this stays a type fix and not a behaviour change.
const createDependencies = (): AdapterDependencies =>
  createMockAdapterDependencies({
    environment: createMockEnvironment({ get: () => undefined, getAll: () => ({}) })
  });

describe('MockAdapterFactory', () => {
  it('creates MockDebugAdapter instances using provided configuration', () => {
    const factory = new MockAdapterFactory({
      supportedFeatures: [DebugFeature.LOG_POINTS]
    });

    const adapter = factory.createAdapter(createDependencies());

    expect(adapter).toBeInstanceOf(MockDebugAdapter);
    expect(adapter.supportsFeature(DebugFeature.LOG_POINTS)).toBe(true);
  });

  it('exposes accurate metadata for the mock adapter', () => {
    const metadata = new MockAdapterFactory().getMetadata();

    expect(metadata).toMatchObject({
      language: DebugLanguage.MOCK,
      displayName: 'Mock Debug Adapter',
      version: '1.0.0',
      author: 'MCP Debugger Team',
      fileExtensions: ['.mock', '.test']
    });
  });

  it('validates successfully with default configuration', async () => {
    const result = await new MockAdapterFactory().validate();

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.details?.config).toEqual({});
  });

  it('createMockAdapterFactory helper forwards configuration', () => {
    const factory = createMockAdapterFactory({
      supportedFeatures: [DebugFeature.SET_VARIABLE]
    });

    const adapter = factory.createAdapter(createDependencies());

    expect(factory).toBeInstanceOf(MockAdapterFactory);
    expect(adapter.supportsFeature(DebugFeature.SET_VARIABLE)).toBe(true);
  });
});

describe('MockAdapterFactory.describeToolchain', () => {
  it('renders standalone (built-in) cells regardless of details', async () => {
    const description = await new MockAdapterFactory().describeToolchain({
      valid: true,
      errors: [],
      warnings: []
    });

    expect(description).toEqual({
      runtime: { label: '(built-in)' },
      backend: { label: '(built-in)' }
    });
  });
});
