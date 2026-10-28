import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { GoDebugAdapter } from '../../src/index.js';
import type { AdapterDependencies, GenericLaunchConfig } from '@debugmcp/shared';

const deps = {
  logger: {
    info: () => {},
    error: () => {},
    debug: () => {},
    warn: () => {}
  }
} as unknown as AdapterDependencies;

describe('GoDebugAdapter.transformLaunchConfig — mode inference', () => {
  let adapter: GoDebugAdapter;

  beforeEach(() => {
    adapter = new GoDebugAdapter(deps);
  });

  it('infers mode "debug" for a .go source file', async () => {
    const cfg = await adapter.transformLaunchConfig({
      program: '/proj/main.go'
    } as unknown as GenericLaunchConfig);

    expect(cfg.mode).toBe('debug');
    expect(cfg.type).toBe('go');
    expect(cfg.request).toBe('launch');
  });

  it('infers mode "exec" for a Windows .exe binary', async () => {
    const cfg = await adapter.transformLaunchConfig({
      program: 'C:\\proj\\hello.exe'
    } as unknown as GenericLaunchConfig);

    expect(cfg.mode).toBe('exec');
  });

  it('infers mode "exec" for a bare Linux binary path with no extension', async () => {
    const cfg = await adapter.transformLaunchConfig({
      program: '/tmp/myapp'
    } as unknown as GenericLaunchConfig);

    expect(cfg.mode).toBe('exec');
  });

  it('treats uppercase .GO extension as source (case-insensitive)', async () => {
    const cfg = await adapter.transformLaunchConfig({
      program: 'C:\\proj\\HELLO.GO'
    } as unknown as GenericLaunchConfig);

    expect(cfg.mode).toBe('debug');
  });

  // Issue #1036: a package directory is a `dlv debug` target — `exec` can never
  // run a directory, and the "not an executable file" it answered said nothing
  // about why. Only a directory that exists is inferred; a bare path that cannot
  // be read stays a binary.
  describe('a package directory as the program', () => {
    const packageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'go-pkg-'));
    afterAll(() => fs.rmSync(packageDir, { recursive: true, force: true }));

    it('infers mode "debug" for a directory that exists', async () => {
      const cfg = await adapter.transformLaunchConfig({ program: packageDir } as unknown as GenericLaunchConfig);
      expect(cfg.mode).toBe('debug');
    });

    it('still lets an explicit mode win over the directory inference', async () => {
      const cfg = await adapter.transformLaunchConfig({ program: packageDir, mode: 'test' } as unknown as GenericLaunchConfig);
      expect(cfg.mode).toBe('test');
    });
  });

  it('preserves explicit mode "test" against a _test.go program', async () => {
    const cfg = await adapter.transformLaunchConfig({
      program: '/proj/foo_test.go',
      mode: 'test'
    } as unknown as GenericLaunchConfig);

    expect(cfg.mode).toBe('test');
  });

  it('preserves explicit mode "exec" even when program is .go (user override wins)', async () => {
    const cfg = await adapter.transformLaunchConfig({
      program: '/proj/main.go',
      mode: 'exec'
    } as unknown as GenericLaunchConfig);

    expect(cfg.mode).toBe('exec');
  });

  it('preserves explicit mode "replay" with no program', async () => {
    const cfg = await adapter.transformLaunchConfig({
      mode: 'replay'
    } as unknown as GenericLaunchConfig);

    expect(cfg.mode).toBe('replay');
  });

  it('falls through to "exec" when program is undefined and no explicit mode is set', async () => {
    const cfg = await adapter.transformLaunchConfig(
      {} as unknown as GenericLaunchConfig
    );

    expect(cfg.mode).toBe('exec');
  });

  it('preserves the existing transform behavior alongside mode inference', async () => {
    const cfg = await adapter.transformLaunchConfig({
      program: '/proj/main.go',
      cwd: '/proj',
      args: ['--verbose'],
      env: { FOO: 'bar' },
      stopOnEntry: true
    } as unknown as GenericLaunchConfig);

    expect(cfg.mode).toBe('debug');
    expect(cfg.dlvCwd).toBe('/proj');
    expect(cfg.args).toEqual(['--verbose']);
    expect(cfg.env).toEqual({ FOO: 'bar' });
    expect(cfg.stopOnEntry).toBe(true);
    expect(cfg.stackTraceDepth).toBe(50);
    expect(cfg.showGlobalVariables).toBe(false);
    expect(cfg.hideSystemGoroutines).toBe(true);
  });

  it('defaults stopOnEntry to false when not provided', async () => {
    const cfg = await adapter.transformLaunchConfig({
      program: '/proj/main.go'
    } as unknown as GenericLaunchConfig);

    expect(cfg.stopOnEntry).toBe(false);
  });

  it('defaults outputMode to "remote" so target stdio arrives as DAP output events (issue #225)', async () => {
    const cfg = await adapter.transformLaunchConfig({
      program: '/proj/main.go'
    } as unknown as GenericLaunchConfig);

    expect(cfg.outputMode).toBe('remote');
  });

  it('preserves a user-supplied outputMode override', async () => {
    const cfg = await adapter.transformLaunchConfig({
      program: '/proj/main.go',
      outputMode: 'local'
    } as unknown as GenericLaunchConfig);

    expect(cfg.outputMode).toBe('local');
  });
});
