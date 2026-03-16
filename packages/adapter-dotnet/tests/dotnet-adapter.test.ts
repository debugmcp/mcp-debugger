import { describe, test, expect } from 'vitest';
import {
  DotnetAdapterFactory,
  DotnetDebugAdapter,
  findNetcoredbgExecutable,
  findDotnetBackend,
  listDotnetProcesses,
  CommandNotFoundError
} from '../src/index.js';

describe('@debugmcp/adapter-dotnet package', () => {
  test('exports DotnetAdapterFactory', () => {
    expect(DotnetAdapterFactory).toBeDefined();
    const factory = new DotnetAdapterFactory();
    expect(factory).toBeInstanceOf(DotnetAdapterFactory);
  });

  test('exports DotnetDebugAdapter class', () => {
    expect(DotnetDebugAdapter).toBeDefined();
  });

  test('exports findNetcoredbgExecutable as a function', () => {
    expect(typeof findNetcoredbgExecutable).toBe('function');
  });

  test('exports findDotnetBackend as a function', () => {
    expect(typeof findDotnetBackend).toBe('function');
  });

  test('exports listDotnetProcesses as a function', () => {
    expect(typeof listDotnetProcesses).toBe('function');
  });

  test('exports CommandNotFoundError', () => {
    expect(CommandNotFoundError).toBeDefined();
    const err = new CommandNotFoundError('netcoredbg');
    expect(err).toBeInstanceOf(Error);
    expect(err.command).toBe('netcoredbg');
  });
});
