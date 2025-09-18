import { describe, test, expect } from 'vitest';
import { MockAdapterFactory, MockDebugAdapter } from '../src/index.js';

describe('Mock Adapter Package', () => {
  test('exports MockAdapterFactory', () => {
    expect(MockAdapterFactory).toBeDefined();
  });
  
  test('exports MockDebugAdapter', () => {
    expect(MockDebugAdapter).toBeDefined();
  });
  
  test('factory creates adapter', () => {
    const factory = new MockAdapterFactory();
    const adapter = factory.createAdapter({} as any);
    expect(adapter).toBeInstanceOf(MockDebugAdapter);
  });
});
