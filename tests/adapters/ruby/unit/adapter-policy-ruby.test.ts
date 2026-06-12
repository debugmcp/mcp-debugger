/**
 * Unit tests for RubyAdapterPolicy and the rdbg invocation helper.
 *
 * Covers the spawn-config matrix introduced with the direct-connect redesign:
 * - attach => { mode: 'connect' } with validated host/port
 * - launch => { mode: 'spawn' } echoing the adapter-built command
 * - error paths: invalid attach port, missing launch adapterCommand
 * plus the Ruby-specific policy hooks (evaluate context, post-attach pause,
 * local scope extraction) and Windows .bat invocation handling.
 */
import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { RubyAdapterPolicy, getPolicyForLanguage, DebugLanguage } from '@debugmcp/shared';
import { buildRdbgInvocation } from '@debugmcp/adapter-ruby';
import type { DebugProtocol } from '@vscode/debugprotocol';

const basePayload = {
  executablePath: '/usr/bin/ruby',
  adapterHost: '127.0.0.1',
  adapterPort: 4711,
  logDir: '/tmp/logs',
  scriptPath: '/workspace/app.rb'
};

describe('RubyAdapterPolicy.getAdapterSpawnConfig', () => {
  it('returns a connect config for attach with discrete host and port', () => {
    const config = RubyAdapterPolicy.getAdapterSpawnConfig!({
      ...basePayload,
      scriptPath: 'attach://remote',
      launchConfig: { request: 'attach', host: '10.0.0.5', port: 12345 }
    });

    expect(config).toEqual({
      mode: 'connect',
      host: '10.0.0.5',
      port: 12345,
      logDir: '/tmp/logs'
    });
  });

  it('defaults attach host to 127.0.0.1', () => {
    const config = RubyAdapterPolicy.getAdapterSpawnConfig!({
      ...basePayload,
      launchConfig: { request: 'attach', port: 9229 }
    });

    expect(config).toMatchObject({ mode: 'connect', host: '127.0.0.1', port: 9229 });
  });

  it.each([
    ['missing', undefined],
    ['zero', 0],
    ['negative', -5],
    ['out of range', 70000],
    ['non-numeric', '12345']
  ])('throws a clear error when the attach port is %s', (_label, port) => {
    expect(() =>
      RubyAdapterPolicy.getAdapterSpawnConfig!({
        ...basePayload,
        launchConfig: { request: 'attach', port } as Record<string, unknown>
      })
    ).toThrow(/Ruby attach requires a valid TCP port/);
  });

  it('never falls back to the proxy adapterPort on attach', () => {
    // Regression: the imported code silently used payload.adapterPort when
    // the attach port failed to parse, producing a confusing connect timeout.
    expect(() =>
      RubyAdapterPolicy.getAdapterSpawnConfig!({
        ...basePayload,
        launchConfig: { request: 'attach' }
      })
    ).toThrow();
  });

  it('returns a spawn config echoing the adapter command for launch', () => {
    const config = RubyAdapterPolicy.getAdapterSpawnConfig!({
      ...basePayload,
      launchConfig: { request: 'launch' },
      adapterCommand: {
        command: '/usr/bin/rdbg',
        args: ['--open', '--host', '127.0.0.1', '--port', '4711'],
        env: { FOO: 'bar' }
      }
    });

    expect(config).toEqual({
      mode: 'spawn',
      command: '/usr/bin/rdbg',
      args: ['--open', '--host', '127.0.0.1', '--port', '4711'],
      host: '127.0.0.1',
      port: 4711,
      logDir: '/tmp/logs',
      env: { FOO: 'bar' }
    });
  });

  it('throws for launch without an adapter command (no silent fallback)', () => {
    expect(() =>
      RubyAdapterPolicy.getAdapterSpawnConfig!({
        ...basePayload,
        launchConfig: { request: 'launch' }
      })
    ).toThrow(/adapter command/i);
  });
});

describe('RubyAdapterPolicy hooks', () => {
  it('matches rdbg adapter commands', () => {
    expect(RubyAdapterPolicy.matchesAdapter!({ command: '/usr/bin/rdbg', args: [] })).toBe(true);
    expect(RubyAdapterPolicy.matchesAdapter!({
      command: 'C:\\Ruby34-x64\\bin\\ruby.exe',
      args: ['C:\\Ruby34-x64\\bin\\rdbg', '--open']
    })).toBe(true);
    expect(RubyAdapterPolicy.matchesAdapter!({ command: 'python', args: ['-m', 'debugpy.adapter'] })).toBe(false);
  });

  it('uses the repl evaluate context (rdbg rejects "variables")', () => {
    expect(RubyAdapterPolicy.getEvaluateContext?.()).toBe('repl');
  });

  it('requests an explicit pause after attach', () => {
    expect(RubyAdapterPolicy.getAttachBehavior?.()).toEqual({ pauseAfterAttach: true });
  });

  it('extracts locals from the rdbg "Local variables" scope', () => {
    const frames = [{ id: 1, name: 'block in main', file: 'app.rb', line: 10 }];
    const scopes: Record<number, DebugProtocol.Scope[]> = {
      1: [
        { name: 'Local variables', presentationHint: 'locals', variablesReference: 7, expensive: false },
        { name: 'Global variables', presentationHint: 'globals', variablesReference: 8, expensive: false }
      ]
    };
    const variables = {
      7: [{ name: 'counter', value: '3', type: 'Integer' }],
      8: [{ name: '$stdout', value: 'IO', type: 'IO' }]
    };

    const locals = RubyAdapterPolicy.extractLocalVariables!(frames, scopes, variables);
    expect(locals).toEqual([{ name: 'counter', value: '3', type: 'Integer' }]);
  });

  it('filters Ruby-internal and gem frames', () => {
    const frames = [
      { id: 1, name: 'block in main', file: '/workspace/app.rb', line: 5 },
      { id: 2, name: 'Kernel#sleep', file: '<internal:kernel>', line: 1 },
      { id: 3, name: 'Rack::Server#start', file: '/usr/lib/gems/rack/server.rb', line: 99 }
    ];

    const visible = RubyAdapterPolicy.filterStackFrames!(frames, false);
    expect(visible.map(f => f.id)).toEqual([1]);
    expect(RubyAdapterPolicy.filterStackFrames!(frames, true)).toHaveLength(3);
  });
});

describe('getPolicyForLanguage', () => {
  it('maps ruby to RubyAdapterPolicy', () => {
    expect(getPolicyForLanguage(DebugLanguage.RUBY)).toBe(RubyAdapterPolicy);
    expect(getPolicyForLanguage('ruby')).toBe(RubyAdapterPolicy);
  });

  it('returns the default policy for unknown languages', () => {
    expect(getPolicyForLanguage('fortran').name).toBe('default');
  });
});

describe('buildRdbgInvocation', () => {
  const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform')!;
  let tmpDir: string | null = null;

  const setPlatform = (platform: string) => {
    Object.defineProperty(process, 'platform', { value: platform });
  };

  afterEach(() => {
    Object.defineProperty(process, 'platform', originalPlatform);
    if (tmpDir) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      tmpDir = null;
    }
  });

  it('passes through unchanged on non-Windows platforms', () => {
    setPlatform('linux');
    expect(buildRdbgInvocation('/usr/bin/rdbg', ['--open'])).toEqual({
      command: '/usr/bin/rdbg',
      args: ['--open']
    });
  });

  it('runs the sibling rdbg script via ruby for a .bat shim (RubyInstaller layout)', () => {
    setPlatform('win32');
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rdbg-test-'));
    const batPath = path.join(tmpDir, 'rdbg.bat');
    const scriptPath = path.join(tmpDir, 'rdbg');
    fs.writeFileSync(batPath, '@echo off');
    fs.writeFileSync(scriptPath, '#!/usr/bin/env ruby');

    expect(buildRdbgInvocation(batPath, ['--open'], 'C:\\Ruby34-x64\\bin\\ruby.exe')).toEqual({
      command: 'C:\\Ruby34-x64\\bin\\ruby.exe',
      args: [scriptPath, '--open']
    });
  });

  it('falls back to cmd.exe when no sibling script exists', () => {
    setPlatform('win32');
    const invocation = buildRdbgInvocation('rdbg.bat', ['--open', '--port', '1']);
    expect(invocation.command.toLowerCase()).toContain('cmd');
    expect(invocation.args).toEqual(['/d', '/s', '/c', 'rdbg.bat', '--open', '--port', '1']);
  });
});
