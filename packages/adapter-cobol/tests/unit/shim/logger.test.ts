/**
 * The shim's append-only file logger (issue #759). Its stdout/stderr belong to
 * the debuggee on Windows, so every line goes to the `--log` file or nowhere.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createFileLogger, NOOP_LOGGER } from '../../../src/shim/logger.js';

describe('shim file logger', () => {
  it('is the shared no-op without a file', () => {
    expect(createFileLogger(undefined)).toBe(NOOP_LOGGER);
    expect(() => NOOP_LOGGER.error('ignored', new Error('ignored'))).not.toThrow();
  });

  it('appends one timestamped line per call, rendering Error messages and JSON data', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'cobol-shim-log-'));
    const file = path.join(dir, 'shim.log');
    try {
      const logger = createFileLogger(file);
      logger.debug('plain');
      logger.info('with data', { port: 4711 });
      logger.warn('with error', new Error('boom'));
      const circular: Record<string, unknown> = {};
      circular.self = circular;
      logger.error('unserialisable', circular);

      const lines = readFileSync(file, 'utf8').trimEnd().split('\n');
      expect(lines).toHaveLength(4);
      expect(lines[0]).toMatch(/^\d{4}-\d{2}-\d{2}T\S+ \[debug\] plain$/);
      expect(lines[1]).toMatch(/ \[info\] with data \{"port":4711\}$/);
      expect(lines[2]).toMatch(/ \[warn\] with error boom$/);
      expect(lines[3]).toMatch(/ \[error\] unserialisable \[object Object\]$/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('gives up silently on a file it cannot write instead of failing the session', () => {
    const file = path.join(os.tmpdir(), `cobol-shim-log-missing-${process.pid}`, 'nested', 'shim.log');
    const logger = createFileLogger(file);
    expect(() => {
      logger.info('first');
      logger.info('second');
    }).not.toThrow();
    expect(existsSync(file)).toBe(false);
  });
});
