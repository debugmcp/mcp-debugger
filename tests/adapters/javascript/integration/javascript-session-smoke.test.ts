import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'path';

import { getAdapterRegistry, resetAdapterRegistry } from '../../../../src/adapters/adapter-registry.js';
import { JavascriptAdapterFactory } from '../../../../packages/adapter-javascript/src/index.js';

function norm(p: unknown): string {
  return typeof p === 'string' ? (p as string).replace(/\\+/g, '/') : '';
}

describe('JavaScript adapter - session smoke (integration)', () => {
  const isWin = process.platform === 'win32';
  const sessionId = 'session-js-3';
  const dummyScriptTs = isWin ? 'C:\\\\proj\\\\app.ts' : '/proj/app.ts';
  const logDir = path.join(process.cwd(), 'logs', 'tests');
  const adapterHost = '127.0.0.1';
  const adapterPort = 56789;

  let originalNodeOptions: string | undefined;

  beforeEach(() => {
    originalNodeOptions = process.env.NODE_OPTIONS;
    resetAdapterRegistry();
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (typeof originalNodeOptions === 'string') {
      process.env.NODE_OPTIONS = originalNodeOptions;
    } else {
      delete (process.env as Record<string, string | undefined>).NODE_OPTIONS;
    }
    resetAdapterRegistry();
    vi.restoreAllMocks();
  });

  it('provides js-debug launch config and adapter command (tsx override path-only assertions)', async () => {
    // Arrange: registry and adapter
    const registry = getAdapterRegistry({ validateOnRegister: false });
    await registry.register('javascript', new JavascriptAdapterFactory());

    const adapterConfig = {
      sessionId,
      executablePath: process.execPath,
      adapterHost,
      adapterPort,
      logDir,
      scriptPath: dummyScriptTs,
      scriptArgs: [],
      launchConfig: {}
    } as any;

    const adapter = await registry.create('javascript', adapterConfig);

    // Smoke: transformLaunchConfig for a TS program; prefer tsx via explicit override
    const cfg = await adapter.transformLaunchConfig({
      program: dummyScriptTs,
      // Ensure deterministic result without module mocking
      runtimeExecutable: 'tsx',
      runtimeArgs: []
    } as any);

    // Assert: runtimeExecutable === 'tsx' and runtimeArgs empty/omitted
    expect((cfg as any).runtimeExecutable).toBe('tsx');
    const rArgs = (cfg as any).runtimeArgs;
    if (Array.isArray(rArgs)) {
      expect(rArgs.length).toBe(0);
    } else {
      // ok if undefined
      expect(rArgs).toBeUndefined();
    }

    // Build adapter command and assert vendor path only
    const cmd = adapter.buildAdapterCommand(adapterConfig);
    expect(typeof cmd.command).toBe('string');
    expect(path.isAbsolute(cmd.command)).toBe(true);

    expect(Array.isArray(cmd.args)).toBe(true);
    const adapterPath = norm(cmd.args?.[0]);
    expect(adapterPath.endsWith('/vendor/js-debug/vsDebugServer.cjs')).toBe(true);
    expect(cmd.args?.[1]).toBe(String(56789));
  });
});
