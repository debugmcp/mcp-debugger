/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JavascriptDebugAdapter } from '../../src/index.js';
import { AdapterState } from '@debugmcp/shared';
import type { DebugProtocol } from '@vscode/debugprotocol';

// Minimal AdapterDependencies variants
const depsWithLogger = {
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn()
  }
} as unknown as import('@debugmcp/shared').AdapterDependencies;

const depsNoLogger = {
  logger: undefined
} as unknown as import('@debugmcp/shared').AdapterDependencies;

describe('JavascriptDebugAdapter additional branch coverage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('dispose without prior connect: emits only disposed (no disconnected), state reset', async () => {
    const adapter = new JavascriptDebugAdapter(depsWithLogger);
    vi.spyOn(adapter, 'validateEnvironment').mockResolvedValue({
      valid: true,
      errors: [],
      warnings: []
    });
    await adapter.initialize();

    const events: string[] = [];
    adapter.on('disconnected', () => events.push('disconnected'));
    adapter.on('disposed', () => events.push('disposed'));

    await adapter.dispose();

    expect(events).toEqual(['disposed']);
    expect(adapter.getState()).toBe(AdapterState.UNINITIALIZED);
    expect(adapter.isConnected()).toBe(false);
  });

  it('transformLaunchConfig: respects user env.NODE_ENV and merges process.env', async () => {
    const adapter = new JavascriptDebugAdapter(depsWithLogger);
    const cfg = await adapter.transformLaunchConfig({
      program: '/proj/app.js',
      env: { NODE_ENV: 'production', CUSTOM_X: '1' }
    } as any);

    const env = cfg.env as Record<string, string>;
    expect(env.NODE_ENV).toBe('production');
    expect(env.CUSTOM_X).toBe('1');
  });

  it('handleDapEvent: continued leaves state unchanged', () => {
    const adapter = new JavascriptDebugAdapter(depsWithLogger);
    const before = adapter.getState();

    const evt: DebugProtocol.Event = {
      seq: 1,
      type: 'event',
      event: 'continued',
      body: {} as DebugProtocol.ContinuedEvent['body']
    };
    adapter.handleDapEvent(evt);

    expect(adapter.getState()).toBe(before);
  });

  it('handleDapEvent: unknown event goes through default branch and emits with provided body object', () => {
    const adapter = new JavascriptDebugAdapter(depsWithLogger);

    const emitted: Array<{ event: string; body: unknown }> = [];
    adapter.on('customEvent' as any, (body: unknown) => emitted.push({ event: 'customEvent', body }));

    const evt: DebugProtocol.Event = {
      seq: 2,
      type: 'event',
      event: 'customEvent',
      body: { foo: 'bar' } as any
    };
    adapter.handleDapEvent(evt);

    expect(emitted.length).toBe(1);
    expect((emitted[0].body as any).foo).toBe('bar');
  });

  it('getRequiredDependencies: returns Node.js dependency with version and URL', () => {
    const adapter = new JavascriptDebugAdapter(depsWithLogger);
    const reqs = adapter.getRequiredDependencies();
    expect(Array.isArray(reqs)).toBe(true);
    expect(reqs[0]?.name).toMatch(/Node\.js/i);
    expect(typeof reqs[0]?.version).toBe('string');
    expect(String(reqs[0]?.installCommand)).toMatch(/nodejs\.org/i);
  });
});
