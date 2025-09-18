import { describe, test, expect } from 'vitest';
import {
  PythonAdapterFactory,
  PythonDebugAdapter,
  findPythonExecutable
} from '../src/index.js';

describe('@debugmcp/adapter-python package', () => {
  test('exports PythonAdapterFactory', () => {
    expect(PythonAdapterFactory).toBeDefined();
    const factory = new PythonAdapterFactory();
    expect(factory).toBeInstanceOf(PythonAdapterFactory);
  });

  test('exports PythonDebugAdapter class', () => {
    expect(PythonDebugAdapter).toBeDefined();
    // Do not instantiate without proper dependencies in this smoke test
  });

  test('exports findPythonExecutable as a function', () => {
    expect(typeof findPythonExecutable).toBe('function');
  });
});
