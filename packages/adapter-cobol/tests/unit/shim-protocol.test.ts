/**
 * Unit tests for the adapter <-> shim argv contract (issue #759).
 */
import { describe, it, expect } from 'vitest';
import {
  buildShimArgs,
  parseShimArgs,
  COBOL_PRIVATE_KEY,
  SHIM_ENTRY_BASENAME,
  type CobolShimArgv
} from '../../src/shim-protocol.js';

const full: CobolShimArgv = {
  listenPort: 4711,
  manifestDirs: ['/work/.debug-mcp/cobol/hello/abc123', '/work/.debug-mcp/cobol/mod1/def456'],
  logFile: '/tmp/logs/cobol-shim-s1.log',
  stdinFile: '/work/input.txt',
  engineScopes: true,
  refCheck: 'strict',
  engineCommand: ['/vendor/adapter/codelldb', '--liblldb', '/vendor/lldb/lib/liblldb.so']
};

describe('shim protocol constants', () => {
  it('names the private launch-config block and the shim entry file', () => {
    expect(COBOL_PRIVATE_KEY).toBe('__cobol');
    expect(SHIM_ENTRY_BASENAME).toBe('cobol-shim.js');
  });
});

describe('buildShimArgs', () => {
  it('emits only the port and the engine command when nothing else is set', () => {
    expect(buildShimArgs({ listenPort: 4711, manifestDirs: [], engineCommand: ['/vendor/adapter/codelldb'] }))
      .toEqual(['--port', '4711', '--', '/vendor/adapter/codelldb']);
  });

  it('emits every option in a fixed order with the engine command last', () => {
    expect(buildShimArgs(full)).toEqual([
      '--port', '4711',
      '--manifest-dir', '/work/.debug-mcp/cobol/hello/abc123',
      '--manifest-dir', '/work/.debug-mcp/cobol/mod1/def456',
      '--log', '/tmp/logs/cobol-shim-s1.log',
      '--stdin-file', '/work/input.txt',
      '--engine-scopes',
      '--ref-check', 'strict',
      '--', '/vendor/adapter/codelldb', '--liblldb', '/vendor/lldb/lib/liblldb.so'
    ]);
  });

  it('omits the engine-scopes flag when it is false', () => {
    const args = buildShimArgs({ ...full, engineScopes: false, refCheck: undefined });
    expect(args).not.toContain('--engine-scopes');
    expect(args).not.toContain('--ref-check');
  });
});

describe('parseShimArgs', () => {
  it('round-trips the full option set', () => {
    expect(parseShimArgs(buildShimArgs(full))).toEqual(full);
  });

  it('round-trips the minimal option set without inventing optional keys', () => {
    const minimal: CobolShimArgv = { listenPort: 1, manifestDirs: [], engineCommand: ['/c'] };
    const parsed = parseShimArgs(buildShimArgs(minimal));
    expect(parsed).toEqual(minimal);
    expect(parsed).not.toHaveProperty('logFile');
    expect(parsed).not.toHaveProperty('stdinFile');
    expect(parsed).not.toHaveProperty('engineScopes');
    expect(parsed).not.toHaveProperty('refCheck');
  });

  it('takes everything after "--" verbatim, even when it looks like a shim flag', () => {
    const parsed = parseShimArgs(['--port', '9', '--', '/c', '--port', '77', '--manifest-dir', 'x']);
    expect(parsed.listenPort).toBe(9);
    expect(parsed.manifestDirs).toEqual([]);
    expect(parsed.engineCommand).toEqual(['/c', '--port', '77', '--manifest-dir', 'x']);
  });

  it('accepts the flags in any order', () => {
    const parsed = parseShimArgs(['--engine-scopes', '--manifest-dir', '/m', '--port', '5', '--', '/c']);
    expect(parsed).toEqual({ listenPort: 5, manifestDirs: ['/m'], engineScopes: true, engineCommand: ['/c'] });
  });

  it('maps --ref-check strict to strict and anything else to warn', () => {
    expect(parseShimArgs(['--port', '1', '--ref-check', 'strict', '--', '/c']).refCheck).toBe('strict');
    expect(parseShimArgs(['--port', '1', '--ref-check', 'warn', '--', '/c']).refCheck).toBe('warn');
    expect(parseShimArgs(['--port', '1', '--ref-check', 'bogus', '--', '/c']).refCheck).toBe('warn');
  });

  it('rejects an unknown flag by name', () => {
    expect(() => parseShimArgs(['--port', '1', '--bogus', 'x', '--', '/c'])).toThrow(/unknown argument --bogus/);
  });

  it('requires a positive integer --port', () => {
    expect(() => parseShimArgs(['--', '/c'])).toThrow(/--port <n> is required/);
    expect(() => parseShimArgs(['--port', 'abc', '--', '/c'])).toThrow(/--port <n> is required/);
    expect(() => parseShimArgs(['--port', '0', '--', '/c'])).toThrow(/--port <n> is required/);
    expect(() => parseShimArgs(['--port', '-4', '--', '/c'])).toThrow(/--port <n> is required/);
    expect(() => parseShimArgs(['--port', '1.5', '--', '/c'])).toThrow(/--port <n> is required/);
  });

  it('requires the engine command after "--"', () => {
    expect(() => parseShimArgs(['--port', '1'])).toThrow(/CodeLLDB command must follow "--"/);
    expect(() => parseShimArgs(['--port', '1', '--'])).toThrow(/CodeLLDB command must follow "--"/);
  });
});
