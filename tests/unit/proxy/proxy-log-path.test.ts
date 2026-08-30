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
import {
  adapterLogFileName,
  adapterLogPathFor,
  dapTraceFileName,
  dapTracePathFor,
  isSessionRunDirectoryName,
  proxyLogFileName,
  proxyLogPathFor,
  sessionRunDirectoryFor,
  sessionRunDirectoryName,
} from '../../../src/proxy/session-log-layout.js';

describe('proxy log path', () => {
  it('owns the launch-attempt directory layout and recognizes only managed names', () => {
    expect(sessionRunDirectoryName(1234)).toBe('run-1234');
    expect(sessionRunDirectoryFor('/logs', 'abc-123', 1234)).toBe(
      path.join('/logs', 'abc-123', 'run-1234')
    );
    expect(isSessionRunDirectoryName('run-1234')).toBe(true);
    expect(isSessionRunDirectoryName('run-')).toBe(false);
    expect(isSessionRunDirectoryName('run-backup')).toBe(false);
    expect(isSessionRunDirectoryName('run-1234.tmp')).toBe(false);
  });

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

  it('owns the adapter log and DAP trace names and paths', () => {
    const logDir = path.join('/tmp', 'logs', 'abc-123', 'run-1');

    expect(adapterLogFileName('abc-123')).toBe('abc-123.log');
    expect(adapterLogPathFor(logDir, 'abc-123')).toBe(path.join(logDir, 'abc-123.log'));
    expect(dapTraceFileName('abc-123')).toBe('dap-trace-abc-123.ndjson');
    expect(dapTracePathFor(logDir, 'abc-123')).toBe(
      path.join(logDir, 'dap-trace-abc-123.ndjson')
    );
  });
});
