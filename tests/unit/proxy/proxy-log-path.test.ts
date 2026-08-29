/**
 * The proxy log path is written by the worker and *read back* by the session
 * layer's failure diagnostics, so the two halves must agree byte for byte.
 * These tests pin the composition rule rather than a literal string: the name
 * is `proxy-<sessionId>.log`, and the full path is that name joined onto the
 * run directory with the host separator (a hand-built `${dir}/${name}` was the
 * Windows hazard this module removes).
 */
import { describe, it, expect } from 'vitest';
import path from 'path';
import { proxyLogFileName, proxyLogPathFor } from '../../../src/proxy/proxy-log-path.js';

describe('proxy log path', () => {
  it('names the file after the session', () => {
    expect(proxyLogFileName('abc-123')).toBe('proxy-abc-123.log');
  });

  it('joins the file name onto the run directory with the host separator', () => {
    const logDir = path.join('/tmp', 'logs', 'abc-123', 'run-1');

    expect(proxyLogPathFor(logDir, 'abc-123')).toBe(
      path.join(logDir, 'proxy-abc-123.log')
    );
  });

  it('composes from the file name, so renaming the file moves both halves', () => {
    const logDir = path.join('/var', 'log', 'mcp');

    expect(proxyLogPathFor(logDir, 'sess')).toBe(path.join(logDir, proxyLogFileName('sess')));
  });

  it('normalizes a trailing separator instead of doubling it', () => {
    expect(proxyLogPathFor(`${path.join('/tmp', 'logs')}${path.sep}`, 's1')).toBe(
      path.join('/tmp', 'logs', 'proxy-s1.log')
    );
  });
});
