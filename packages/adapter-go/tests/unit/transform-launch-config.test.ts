import { describe, it, expect, beforeEach } from 'vitest';
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
});
