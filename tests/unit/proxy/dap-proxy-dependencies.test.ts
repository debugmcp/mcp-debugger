/**
 * Unit tests for dap-proxy-dependencies.ts
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  createProductionDependencies,
  createConsoleLogger,
  setupGlobalErrorHandlers
} from '../../../src/proxy/dap-proxy-dependencies.js';

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

  it('messageSender.send uses stdout when process.send is unavailable', () => {
    const originalSend = process.send;
    delete (process as any).send;

    const stdoutWrite = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const deps = createProductionDependencies();
    deps.messageSender.send({ type: 'test', data: 123 });

    expect(stdoutWrite).toHaveBeenCalledWith(
      JSON.stringify({ type: 'test', data: 123 }) + '\n'
    );

    stdoutWrite.mockRestore();
    if (originalSend) process.send = originalSend;
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

/* ------------------------------------------------------------------ */
/*  setupGlobalErrorHandlers                                           */
/* ------------------------------------------------------------------ */

describe('setupGlobalErrorHandlers', () => {
  const handlers: Record<string, Function[]> = {};

  afterEach(() => {
    // Clean up all registered handlers
    for (const [event, fns] of Object.entries(handlers)) {
      for (const fn of fns) {
        process.removeListener(event, fn as any);
      }
    }
    for (const key of Object.keys(handlers)) {
      delete handlers[key];
    }
  });

  it('registers handlers for uncaughtException, unhandledRejection, SIGINT, SIGTERM', () => {
    const spy = vi.spyOn(process, 'on').mockImplementation(function (this: any, event: string, fn: any) {
      if (!handlers[event]) handlers[event] = [];
      handlers[event].push(fn);
      return this;
    });

    const logger = createConsoleLogger();
    const messageSender = { send: vi.fn() };
    const shutdownFn = vi.fn().mockResolvedValue(undefined);
    const getSessionId = vi.fn().mockReturnValue(null);

    setupGlobalErrorHandlers(logger, messageSender, shutdownFn, getSessionId);

    const registeredEvents = spy.mock.calls.map(([event]) => event);
    expect(registeredEvents).toContain('uncaughtException');
    expect(registeredEvents).toContain('unhandledRejection');
    expect(registeredEvents).toContain('SIGINT');
    expect(registeredEvents).toContain('SIGTERM');

    spy.mockRestore();
  });

  it('uncaughtException handler sends error and calls shutdown', async () => {
    const capturedHandlers: Record<string, Function> = {};
    const spy = vi.spyOn(process, 'on').mockImplementation(function (this: any, event: string, fn: any) {
      capturedHandlers[event] = fn;
      return this;
    });
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    const logger = createConsoleLogger();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const messageSender = { send: vi.fn() };
    const shutdownFn = vi.fn().mockResolvedValue(undefined);
    const getSessionId = vi.fn().mockReturnValue('session-1');

    setupGlobalErrorHandlers(logger, messageSender, shutdownFn, getSessionId);

    const handler = capturedHandlers['uncaughtException'];
    expect(handler).toBeDefined();

    await handler(new Error('test crash'), 'uncaughtException');
    // Allow .finally() microtask to run
    await new Promise(r => setTimeout(r, 0));

    expect(messageSender.send).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error', sessionId: 'session-1' })
    );
    expect(shutdownFn).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(1);

    spy.mockRestore();
    exitSpy.mockRestore();
  });

  it('unhandledRejection handler sends error message', () => {
    const capturedHandlers: Record<string, Function> = {};
    const spy = vi.spyOn(process, 'on').mockImplementation(function (this: any, event: string, fn: any) {
      capturedHandlers[event] = fn;
      return this;
    });
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    const logger = createConsoleLogger();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const messageSender = { send: vi.fn() };
    const shutdownFn = vi.fn().mockResolvedValue(undefined);
    const getSessionId = vi.fn().mockReturnValue(null);

    setupGlobalErrorHandlers(logger, messageSender, shutdownFn, getSessionId);

    const handler = capturedHandlers['unhandledRejection'];
    handler('some reason', Promise.resolve());

    expect(messageSender.send).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error', sessionId: 'unknown' })
    );

    spy.mockRestore();
    exitSpy.mockRestore();
  });

  it('SIGTERM handler calls shutdown and exits with 0', async () => {
    const capturedHandlers: Record<string, Function> = {};
    const spy = vi.spyOn(process, 'on').mockImplementation(function (this: any, event: string, fn: any) {
      capturedHandlers[event] = fn;
      return this;
    });
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    const logger = createConsoleLogger();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const messageSender = { send: vi.fn() };
    const shutdownFn = vi.fn().mockResolvedValue(undefined);
    const getSessionId = vi.fn().mockReturnValue(null);

    setupGlobalErrorHandlers(logger, messageSender, shutdownFn, getSessionId);

    await capturedHandlers['SIGTERM']();
    expect(shutdownFn).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(0);

    spy.mockRestore();
    exitSpy.mockRestore();
  });

  it('SIGINT handler calls shutdown and exits with 0', async () => {
    const capturedHandlers: Record<string, Function> = {};
    const spy = vi.spyOn(process, 'on').mockImplementation(function (this: any, event: string, fn: any) {
      capturedHandlers[event] = fn;
      return this;
    });
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    const logger = createConsoleLogger();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const messageSender = { send: vi.fn() };
    const shutdownFn = vi.fn().mockResolvedValue(undefined);
    const getSessionId = vi.fn().mockReturnValue(null);

    setupGlobalErrorHandlers(logger, messageSender, shutdownFn, getSessionId);

    await capturedHandlers['SIGINT']();
    expect(shutdownFn).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(0);

    spy.mockRestore();
    exitSpy.mockRestore();
  });
});

/* ------------------------------------------------------------------ */
/*  messageSender.send with process.send available                     */
/* ------------------------------------------------------------------ */

describe('messageSender with process.send', () => {
  it('uses process.send when available', () => {
    const originalSend = process.send;
    const fakeSend = vi.fn();
    (process as any).send = fakeSend;

    const deps = createProductionDependencies();
    deps.messageSender.send({ type: 'test' });

    expect(fakeSend).toHaveBeenCalledWith({ type: 'test' });

    if (originalSend) {
      process.send = originalSend;
    } else {
      delete (process as any).send;
    }
  });
});
