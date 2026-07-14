/**
 * Unit tests for dap-proxy-dependencies.ts
 *
 * The messageSender tests inject a FakeCurrentProcess (issue #183) instead of
 * mutating the global process object. The standalone setupGlobalErrorHandlers
 * was deleted with issue #183 — production uses
 * ProxyRunner.setupGlobalErrorHandlers (covered in dap-proxy-core.test.ts).
 */
import { describe, it, expect, vi } from 'vitest';
import {
  createProductionDependencies,
  createConsoleLogger
} from '../../../src/proxy/dap-proxy-dependencies.js';
import { FakeCurrentProcess } from '../../test-utils/mocks/fake-current-process.js';

/* ------------------------------------------------------------------ */
/*  createProductionDependencies                                       */
/* ------------------------------------------------------------------ */

describe('createProductionDependencies', () => {
  it('returns an object with all expected dependency keys', () => {
    const deps = createProductionDependencies();
    expect(deps).toHaveProperty('loggerFactory');
    expect(deps).toHaveProperty('fileSystem');
    expect(deps).toHaveProperty('processSpawner');
    expect(deps).toHaveProperty('dapClientFactory');
    expect(deps).toHaveProperty('messageSender');
  });

  it('loggerFactory is a function', () => {
    const deps = createProductionDependencies();
    expect(typeof deps.loggerFactory).toBe('function');
  });

  it('fileSystem has ensureDir and pathExists', () => {
    const deps = createProductionDependencies();
    expect(typeof deps.fileSystem.ensureDir).toBe('function');
    expect(typeof deps.fileSystem.pathExists).toBe('function');
  });

  it('processSpawner has spawn', () => {
    const deps = createProductionDependencies();
    expect(typeof deps.processSpawner.spawn).toBe('function');
  });

  it('dapClientFactory has create', () => {
    const deps = createProductionDependencies();
    expect(typeof deps.dapClientFactory.create).toBe('function');
  });

  it('messageSender.send uses stdout when proc.send is unavailable', async () => {
    const fakeProc = new FakeCurrentProcess().disableIPC();

    const deps = createProductionDependencies(fakeProc);
    deps.messageSender.send({ type: 'test', data: 123 });

    // Let the PassThrough 'data' event flush
    await new Promise(r => setImmediate(r));
    expect(fakeProc.stdoutChunks.join('')).toBe(
      JSON.stringify({ type: 'test', data: 123 }) + '\n'
    );
  });

  it('messageSender.send uses proc.send when available', () => {
    const fakeProc = new FakeCurrentProcess();

    const deps = createProductionDependencies(fakeProc);
    deps.messageSender.send({ type: 'test' });

    expect(fakeProc.send).toHaveBeenCalledWith({ type: 'test' });
  });
});

/* ------------------------------------------------------------------ */
/*  createConsoleLogger                                                */
/* ------------------------------------------------------------------ */

describe('createConsoleLogger', () => {
  it('returns a logger with info, error, debug, and warn', () => {
    const logger = createConsoleLogger();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.warn).toBe('function');
  });

  it('info delegates to console.log', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const logger = createConsoleLogger();
    logger.info('hello');
    expect(spy).toHaveBeenCalledWith('[INFO]', 'hello');
    spy.mockRestore();
  });

  it('error delegates to console.error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logger = createConsoleLogger();
    logger.error('boom');
    expect(spy).toHaveBeenCalledWith('[ERROR]', 'boom');
    spy.mockRestore();
  });

  it('debug delegates to console.error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logger = createConsoleLogger();
    logger.debug('trace');
    expect(spy).toHaveBeenCalledWith('[DEBUG]', 'trace');
    spy.mockRestore();
  });

  it('warn delegates to console.error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logger = createConsoleLogger();
    logger.warn('caution');
    expect(spy).toHaveBeenCalledWith('[WARN]', 'caution');
    spy.mockRestore();
  });
});
