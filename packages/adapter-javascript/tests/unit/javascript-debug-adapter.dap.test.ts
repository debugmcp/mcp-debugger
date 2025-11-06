import { describe, it, expect, beforeEach, vi } from 'vitest';
import path from 'path';
import type { DebugProtocol } from '@vscode/debugprotocol';
import { JavascriptDebugAdapter } from '../../src/index.js';
import { AdapterState } from '@debugmcp/shared';

// Minimal AdapterDependencies stub
const deps = {
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn()
  }
} as unknown as import('@debugmcp/shared').AdapterDependencies;

describe('JavascriptDebugAdapter DAP plumbing', () => {
  let adapter: JavascriptDebugAdapter;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    adapter = new JavascriptDebugAdapter(deps);
  });

  it('sendDapRequest setBreakpoints: does minimal validation without mutating args', async () => {
    const original = {
      source: { path: 'relative/file.js' },
      lines: [1]
    };
    const cloneBefore = JSON.parse(JSON.stringify(original));

    const result = await adapter.sendDapRequest('setBreakpoints', original);
    expect(typeof result).toBe('object'); // returns {} (transport handled by ProxyManager)

    // Ensure original input not mutated (no absolute resolution on caller object)
    expect(original).toEqual(cloneBefore);

    // And specifically the path stays relative
    expect(original.source.path).toBe('relative/file.js');
    // Sanity: path.resolve would change it on this platform
    expect(path.isAbsolute(path.resolve('relative/file.js'))).toBe(true);
  });

  it('handleDapEvent: output without category defaults to console', async () => {
    const outputs: Array<DebugProtocol.OutputEvent['body']> = [];
    adapter.on('output', (body: DebugProtocol.OutputEvent['body']) => outputs.push(body));

    const evt: DebugProtocol.Event = {
      seq: 1,
      type: 'event',
      event: 'output',
      body: { output: 'hello\n' } as DebugProtocol.OutputEvent['body']
    };
    adapter.handleDapEvent(evt);

    expect(outputs.length).toBe(1);
    expect(outputs[0].category).toBe('console');
    expect(outputs[0].output).toBe('hello\n');
  });

  it('handleDapEvent: stopped sets currentThreadId and transitions to DEBUGGING', () => {
    const stopped: DebugProtocol.Event = {
      seq: 2,
      type: 'event',
      event: 'stopped',
      body: { reason: 'breakpoint', threadId: 42 } as DebugProtocol.StoppedEvent['body']
    };
    adapter.handleDapEvent(stopped);

    expect(adapter.getCurrentThreadId()).toBe(42);
    expect(adapter.getState()).toBe(AdapterState.DEBUGGING);
  });

  it('handleDapEvent: terminated and exited are emitted without forcing state', () => {
    const events: string[] = [];
    adapter.on('terminated', () => events.push('terminated'));
    adapter.on('exited', () => events.push('exited'));

    const terminated: DebugProtocol.Event = {
      seq: 3,
      type: 'event',
      event: 'terminated',
      body: {} as DebugProtocol.TerminatedEvent['body']
    };
    const exited: DebugProtocol.Event = {
      seq: 4,
      type: 'event',
      event: 'exited',
      body: {} as DebugProtocol.ExitedEvent['body']
    };

    adapter.handleDapEvent(terminated);
    adapter.handleDapEvent(exited);

    expect(events).toEqual(['terminated', 'exited']);
  });

  it('handleDapEvent: tolerates missing body safely', () => {
    const outputs: Array<DebugProtocol.OutputEvent['body']> = [];
    adapter.on('output', (body: DebugProtocol.OutputEvent['body']) => outputs.push(body));

    const evt: DebugProtocol.Event = {
      seq: 5,
      type: 'event',
      event: 'output'
      // no body
    } as unknown as DebugProtocol.Event;
    adapter.handleDapEvent(evt);

    expect(outputs.length).toBe(1);
    expect(outputs[0].category).toBe('console'); // defaulted
  });
});
