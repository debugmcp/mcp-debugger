import { describe, test, expect } from 'vitest';
import { JavascriptAdapterFactory } from '../../src/index.js';
import { AdapterState } from '@debugmcp/shared';
import type { AdapterDependencies, IFileSystem, ILogger, IEnvironment, IProcessLauncher } from '@debugmcp/shared';

describe('@debugmcp/adapter-javascript package', () => {
  test('exports JavascriptAdapterFactory', () => {
    expect(JavascriptAdapterFactory).toBeDefined();
    const factory = new JavascriptAdapterFactory();
    expect(factory).toBeInstanceOf(JavascriptAdapterFactory);
  });

  test('factory.createAdapter returns an object with IDebugAdapter shape', () => {
    const factory = new JavascriptAdapterFactory();
    const deps: AdapterDependencies = {
      fileSystem: {} as unknown as IFileSystem,
      logger: { debug() {}, info() {}, warn() {}, error() {} } as unknown as ILogger,
      environment: {} as unknown as IEnvironment,
      processLauncher: {} as unknown as IProcessLauncher
    };

    const adapter = factory.createAdapter(deps);
    expect(adapter).toBeDefined();
    expect(typeof adapter.initialize).toBe('function');
    expect(typeof adapter.dispose).toBe('function');
    expect(typeof adapter.getState).toBe('function');
  });

  test('initialize transitions to READY and emits initialized', async () => {
    const factory = new JavascriptAdapterFactory();
    const deps: AdapterDependencies = {
      fileSystem: {} as unknown as IFileSystem,
      logger: { debug() {}, info() {}, warn() {}, error() {} } as unknown as ILogger,
      environment: {} as unknown as IEnvironment,
      processLauncher: {} as unknown as IProcessLauncher
    };

    const adapter = factory.createAdapter(deps);

    const initialized = new Promise<void>((resolve) => {
      adapter.once('initialized', () => resolve());
    });

    await adapter.initialize();
    await initialized;

    expect(adapter.isReady()).toBe(true);
    expect(adapter.getState()).toBe(AdapterState.READY);
  });
});
