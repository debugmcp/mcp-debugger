import { describe, it, expect } from 'vitest';
import type { AdapterDependencies } from '@debugmcp/shared';
import { DebugFeature, DebugLanguage } from '@debugmcp/shared';
import { MockAdapterFactory, createMockAdapterFactory } from '../../src/mock-adapter-factory.js';
import { MockDebugAdapter } from '../../src/mock-debug-adapter.js';

const createDependencies = (): AdapterDependencies & {
  logger: { info: () => void; debug: () => void; error: () => void };
} => ({
  fileSystem: {} as unknown,
  environment: {
    get: () => undefined,
    getAll: () => ({}),
    getCurrentWorkingDirectory: () => process.cwd()
  },
  logger: {
    info: () => undefined,
    debug: () => undefined,
    error: () => undefined
  }
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
    expect(result.details.config).toEqual({});
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
