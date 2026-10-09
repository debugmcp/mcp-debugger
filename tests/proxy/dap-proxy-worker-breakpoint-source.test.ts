/**
 * `breakpoint` events without a `source` (issue #790).
 *
 * The Dart SDK adapters verify breakpoints after the fact with `breakpoint` events that carry an
 * id and a line but no `source`, and they hand out NEW ids on every `setBreakpoints` re-send. The
 * session store matches an event by adapter id or by (file, line); with a fresh id and no file it
 * matches nothing and the verification is lost. The worker relays every `setBreakpoints`, so it
 * knows which file each adapter id belongs to and fills the `source` in before forwarding.
 */
import { EventEmitter } from 'events';
import path from 'path';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DefaultAdapterPolicy } from '@debugmcp/shared';
import { DapProxyWorker } from '../../src/proxy/dap-proxy-worker.js';
import type { DapProxyDependencies, ProxyInitPayload } from '../../src/proxy/dap-proxy-interfaces.js';
import { createMockDapClient } from '../test-utils/mocks/dap-client.js';
import { createMockLogger } from '../test-utils/helpers/test-dependencies.js';
import { createMockFileSystem, createMockProcessSpawner } from '../test-utils/mocks/dap-proxy-doubles.js';

// Absolute on both platforms (the worker canonicalizes with path.resolve, which treats a
// Windows path as relative on Linux — CI's ubuntu lane).
const FILE = path.resolve('/p/hello.dart');
type Sent = Record<string, unknown>;

describe('DapProxyWorker breakpoint events without source (issue #790)', () => {
  let worker: DapProxyWorker;
  let mockDapClient: ReturnType<typeof createMockDapClient>;
  let send: ReturnType<typeof vi.fn>;
  let nextId = 100000;

  const sent = (): Sent[] => send.mock.calls.map(([m]) => m as Sent);
  const forwardedBreakpointEvents = (): Sent[] => sent().filter((m) => m.type === 'dapEvent' && m.event === 'breakpoint').map((m) => m.body as Sent);

  beforeEach(() => {
    mockDapClient = createMockDapClient();
    send = vi.fn();
    nextId = 100000;
    // The adapter answers every setBreakpoints with fresh ids and verified:false (the Dart shape).
    mockDapClient.sendRequest = vi.fn(async (command: string, args: Record<string, unknown>) => {
      if (command === 'setBreakpoints') {
        const bps = (args.breakpoints as Array<{ line: number }>) ?? [];
        return { seq: 1, type: 'response', request_seq: 1, success: true, command, body: { breakpoints: bps.map(() => ({ id: nextId++, verified: false, message: 'pending' })) } };
      }
      return { seq: 1, type: 'response', request_seq: 1, success: true, command, body: {} };
    }) as typeof mockDapClient.sendRequest;
    const dependencies = {
      fileSystem: createMockFileSystem(),
      loggerFactory: vi.fn().mockResolvedValue(createMockLogger()),
      processSpawner: createMockProcessSpawner(),
      dapClientFactory: { create: vi.fn().mockResolvedValue(mockDapClient) },
      messageSender: { send },
    } as unknown as DapProxyDependencies;
    worker = new DapProxyWorker(dependencies, { exit: vi.fn() });
    const w = worker as unknown as Record<string, unknown>;
    w.logger = createMockLogger();
    w.dapClient = mockDapClient;
    w.connectionManager = {
      setBreakpoints: vi.fn(async (client: typeof mockDapClient, file: string, bps: Array<{ line: number }>) =>
        client.sendRequest('setBreakpoints', { source: { path: file }, breakpoints: bps })),
      setExceptionBreakpoints: vi.fn(async () => ({})),
      sendConfigurationDone: vi.fn(async () => ({})),
      setupEventHandlers: vi.fn((client: EventEmitter, handlers: Record<string, (body?: unknown) => void>) => {
        if (handlers.onBreakpoint) client.on('breakpoint', handlers.onBreakpoint);
        if (handlers.onStopped) client.on('stopped', handlers.onStopped);
      }),
    };
    w.adapterPolicy = DefaultAdapterPolicy;
    w.adapterState = DefaultAdapterPolicy.createInitialState();
    w.currentSessionId = 's';
    w.state = 'connected';
    (w.setupDapEventHandlers as () => void)();
  });

  async function relaySetBreakpoints(lines: number[]): Promise<void> {
    await (worker as unknown as { handleDapCommand: (cmd: unknown) => Promise<void> }).handleDapCommand({
      requestId: `r${Date.now()}`, cmd: 'dap', sessionId: 's', dapCommand: 'setBreakpoints',
      dapArgs: { source: { path: FILE }, breakpoints: lines.map((line) => ({ line })) },
    });
  }

  it('adds the source of an id it learned from a relayed setBreakpoints response', async () => {
    await relaySetBreakpoints([3, 4]);
    mockDapClient.emit('breakpoint', { reason: 'changed', breakpoint: { id: 100001, line: 4, verified: true } });
    await new Promise((r) => setImmediate(r));
    const [evt] = forwardedBreakpointEvents();
    expect((evt.breakpoint as Sent).source).toEqual({ path: FILE });
    expect((evt.breakpoint as Sent).verified).toBe(true);
  });

  it('tracks rotating ids across re-sends, latest mapping wins', async () => {
    await relaySetBreakpoints([3]);
    await relaySetBreakpoints([3]); // the adapter now calls it 100001
    mockDapClient.emit('breakpoint', { reason: 'changed', breakpoint: { id: 100001, line: 3, verified: true } });
    await new Promise((r) => setImmediate(r));
    expect((forwardedBreakpointEvents()[0].breakpoint as Sent).source).toEqual({ path: FILE });
  });

  it('learns ids from the launch configuration phase too', async () => {
    const payload = { cmd: 'init', sessionId: 's', executablePath: 'dart', adapterHost: '127.0.0.1', adapterPort: 1, logDir: 'C:\\logs', scriptPath: FILE, stopOnEntry: false, initialBreakpoints: [{ id: 'u1', file: FILE, line: 3 }], initialFunctionBreakpoints: [] } as unknown as ProxyInitPayload;
    const w = worker as unknown as Record<string, unknown>;
    w.currentInitPayload = payload;
    await (w.runConfigurationPhase as (p: ProxyInitPayload, c: unknown, cm: unknown) => Promise<void>)(payload, mockDapClient, w.connectionManager);
    mockDapClient.emit('breakpoint', { reason: 'changed', breakpoint: { id: 100000, line: 3, verified: true } });
    await new Promise((r) => setImmediate(r));
    expect((forwardedBreakpointEvents()[0].breakpoint as Sent).source).toEqual({ path: FILE });
  });

  // The Dart adapter resolves a re-sent set in the same chunk as its response (measured: the
  // `breakpoint` events for the fresh ids carry the response's timestamp), so they reach the
  // worker before the response promise settles — before the ids are known. Held until the
  // response names them, they go out with their source, ahead of the response.
  function answerAndResolveInSameChunk(fail = false): void {
    mockDapClient.sendRequest = vi.fn(async (command: string, args: Record<string, unknown>) => {
      if (command === 'setBreakpoints') {
        const bps = (args.breakpoints as Array<{ line: number }>) ?? [];
        const ids = bps.map(() => nextId++);
        ids.forEach((id, i) => mockDapClient.emit('breakpoint', { reason: 'changed', breakpoint: { id, line: bps[i].line, verified: true } }));
        if (fail) throw new Error('adapter went away');
        return { seq: 1, type: 'response', request_seq: 1, success: true, command, body: { breakpoints: ids.map((id) => ({ id, verified: false, reason: 'pending', message: 'pending' })) } };
      }
      return { seq: 1, type: 'response', request_seq: 1, success: true, command, body: {} };
    }) as typeof mockDapClient.sendRequest;
  }

  it('holds an event for an id the in-flight setBreakpoints has not yet named, then forwards it with its source ahead of the response', async () => {
    answerAndResolveInSameChunk();
    await relaySetBreakpoints([3, 4]);
    const messages = sent();
    const eventIndexes = messages.map((m, i) => (m.type === 'dapEvent' && m.event === 'breakpoint' ? i : -1)).filter((i) => i >= 0);
    const responseIndex = messages.findIndex((m) => m.type === 'dapResponse');
    expect(eventIndexes).toHaveLength(2);
    expect(Math.max(...eventIndexes)).toBeLessThan(responseIndex);
    expect(forwardedBreakpointEvents().map((e) => (e.breakpoint as Sent).source)).toEqual([{ path: FILE }, { path: FILE }]);
  });

  it('releases a held event as-is when the in-flight setBreakpoints fails', async () => {
    answerAndResolveInSameChunk(true);
    await relaySetBreakpoints([3]);
    const messages = sent();
    const eventIndex = messages.findIndex((m) => m.type === 'dapEvent' && m.event === 'breakpoint');
    const responseIndex = messages.findIndex((m) => m.type === 'dapResponse');
    expect(eventIndex).toBeGreaterThanOrEqual(0);
    expect(eventIndex).toBeLessThan(responseIndex);
    expect((messages[responseIndex] as Sent).success).toBe(false);
    expect((forwardedBreakpointEvents()[0].breakpoint as Sent).source).toBeUndefined();
  });

  it('leaves events alone when they already carry a source or the id is unknown', async () => {
    await relaySetBreakpoints([3]);
    mockDapClient.emit('breakpoint', { reason: 'changed', breakpoint: { id: 100000, line: 3, verified: true, source: { path: 'C:\\other.dart' } } });
    mockDapClient.emit('breakpoint', { reason: 'new', breakpoint: { id: 777, line: 9, verified: true } });
    await new Promise((r) => setImmediate(r));
    const [withSource, unknown] = forwardedBreakpointEvents();
    expect((withSource.breakpoint as Sent).source).toEqual({ path: 'C:\\other.dart' });
    expect((unknown.breakpoint as Sent).source).toBeUndefined();
  });
});
