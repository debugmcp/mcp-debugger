/**
 * Entry-stop handling for adapters whose own entry stop is bookkeeping (issue #790).
 *
 * The Dart SDK adapters pause every new isolate at start, report `stopped { reason: 'entry' }`
 * and resume it themselves a millisecond later. A policy that sets `suppressesAdapterEntryStop`
 * has those events dropped by the worker; a `stopOnEntry` launch instead arms a breakpoint on
 * the line the policy's `entryBreakpointLine` names in the program, keeps it out of the session's
 * breakpoint list, and relabels its first hit as the entry stop.
 */
import { EventEmitter } from 'events';
import path from 'path';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DefaultAdapterPolicy, type AdapterPolicy } from '@debugmcp/shared';
import { DapProxyWorker } from '../../src/proxy/dap-proxy-worker.js';
import type { DapProxyDependencies, ProxyInitPayload } from '../../src/proxy/dap-proxy-interfaces.js';
import { createMockDapClient } from '../test-utils/mocks/dap-client.js';
import { createMockLogger } from '../test-utils/helpers/test-dependencies.js';
import { createMockFileSystem, createMockProcessSpawner } from '../test-utils/mocks/dap-proxy-doubles.js';

// Absolute on both platforms (the worker canonicalizes with path.resolve, which treats a
// Windows path as relative on Linux — CI's ubuntu lane).
const PROGRAM = path.resolve('/p/bin/app.dart');
const SOURCE = "import 'dart:io';\n\nFuture<void> main(List<String> args) async {\n  print('x');\n}\n";

type Sent = Record<string, unknown>;

function entryPolicy(overrides: Partial<AdapterPolicy> = {}): AdapterPolicy {
  return {
    ...DefaultAdapterPolicy,
    name: 'dart-like',
    suppressesAdapterEntryStop: true,
    entryBreakpointLine: (src: string) => { const i = src.split(/\r?\n/).findIndex((l) => /\bmain\s*\(/.test(l)); return i >= 0 ? i + 1 : undefined; },
    ...overrides,
  } as AdapterPolicy;
}

function initPayload(extra: Partial<ProxyInitPayload> = {}): ProxyInitPayload {
  return {
    cmd: 'init',
    sessionId: 's',
    executablePath: 'dart',
    adapterHost: '127.0.0.1',
    adapterPort: 4711,
    logDir: 'C:\\logs',
    scriptPath: PROGRAM,
    stopOnEntry: true,
    initialBreakpoints: [],
    initialFunctionBreakpoints: [],
    ...extra,
  } as ProxyInitPayload;
}

describe('DapProxyWorker entry stop (issue #790)', () => {
  let worker: DapProxyWorker;
  let dependencies: DapProxyDependencies;
  let mockDapClient: ReturnType<typeof createMockDapClient>;
  let send: ReturnType<typeof vi.fn>;
  let setBreakpoints: ReturnType<typeof vi.fn>;
  let connectionStub: Record<string, unknown>;

  const sent = (): Sent[] => send.mock.calls.map(([m]) => m as Sent);
  const forwardedStops = (): Sent[] => sent().filter((m) => m.type === 'dapEvent' && m.event === 'stopped').map((m) => m.body as Sent);
  const syncedBreakpoints = (): Sent[] | undefined => {
    const m = sent().find((x) => JSON.stringify(x).includes('breakpoints_synced'));
    if (!m) return undefined;
    const holder = (m.breakpoints ?? (m.data as Sent | undefined)?.breakpoints ?? (m.body as Sent | undefined)?.breakpoints) as Sent[] | undefined;
    return holder;
  };

  beforeEach(() => {
    mockDapClient = createMockDapClient();
    send = vi.fn();
    setBreakpoints = vi.fn(async (_client: unknown, _file: string, bps: Array<{ line: number }>) => ({
      body: { breakpoints: bps.map((b, i) => ({ id: 100000 + i, verified: false, line: b.line, message: 'pending' })) },
    }));
    connectionStub = {
      setBreakpoints,
      setExceptionBreakpoints: vi.fn(async () => ({})),
      sendConfigurationDone: vi.fn(async () => ({})),
      setupEventHandlers: vi.fn((client: EventEmitter, handlers: Record<string, (body?: unknown) => void>) => {
        for (const [key, name] of [['onStopped', 'stopped'], ['onContinued', 'continued'], ['onBreakpoint', 'breakpoint']] as const) {
          if (handlers[key]) client.on(name, handlers[key]);
        }
      }),
    };
    const fileSystem = createMockFileSystem();
    fileSystem.readFile = vi.fn(async () => SOURCE);
    dependencies = {
      fileSystem,
      loggerFactory: vi.fn().mockResolvedValue(createMockLogger()),
      processSpawner: createMockProcessSpawner(),
      dapClientFactory: { create: vi.fn().mockResolvedValue(mockDapClient) },
      messageSender: { send },
    } as unknown as DapProxyDependencies;
    worker = new DapProxyWorker(dependencies, { exit: vi.fn() });
    const w = worker as unknown as Record<string, unknown>;
    w.logger = createMockLogger();
    w.dapClient = mockDapClient;
    w.connectionManager = connectionStub;
    w.adapterState = DefaultAdapterPolicy.createInitialState();
    w.currentSessionId = 's';
  });

  async function configure(payload: ProxyInitPayload, policy: AdapterPolicy): Promise<void> {
    const w = worker as unknown as Record<string, unknown>;
    w.adapterPolicy = policy;
    w.currentInitPayload = payload;
    (w.setupDapEventHandlers as () => void)();
    await (w.runConfigurationPhase as (p: ProxyInitPayload, c: unknown, cm: unknown) => Promise<void>)(payload, mockDapClient, connectionStub);
  }

  it('drops the adapter\'s own entry stop together with the resume that follows it, and forwards every other stop', async () => {
    await configure(initPayload({ stopOnEntry: false }), entryPolicy());
    mockDapClient.emit('stopped', { reason: 'entry', threadId: 1, allThreadsStopped: false });
    mockDapClient.emit('continued', { threadId: 1 });
    mockDapClient.emit('stopped', { reason: 'breakpoint', threadId: 1, hitBreakpointIds: [100000] });
    await new Promise((r) => setImmediate(r));
    expect(forwardedStops().map((b) => b.reason)).toEqual(['breakpoint']);
    // The session never saw that stop, so it must not see its resume either.
    expect(sent().some((m) => m.type === 'dapEvent' && m.event === 'continued')).toBe(false);
  });

  it('forwards a durable entry stop (no resume follows within the hold): a VM started with --pause_isolates_on_start', async () => {
    vi.useFakeTimers();
    try {
      await configure(initPayload({ stopOnEntry: false }), entryPolicy());
      mockDapClient.emit('stopped', { reason: 'entry', threadId: 1, allThreadsStopped: false });
      await vi.advanceTimersByTimeAsync(50);
      expect(forwardedStops()).toEqual([]);
      await vi.advanceTimersByTimeAsync(1000);
      expect(forwardedStops().map((b) => b.reason)).toEqual(['entry']);
      // A later resume is the user's, not the adapter's: forwarded.
      mockDapClient.emit('continued', { threadId: 1 });
      expect(sent().some((m) => m.type === 'dapEvent' && m.event === 'continued')).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('holds an entry stop that names no thread before discovering one, so the resume in the same tick still cancels it', async () => {
    vi.useFakeTimers();
    try {
      await configure(initPayload({ stopOnEntry: false }), entryPolicy());
      mockDapClient.sendRequest = vi.fn(async () => ({ seq: 1, type: 'response', request_seq: 1, success: true, command: 'threads', body: { threads: [{ id: 7, name: 'main' }] } })) as typeof mockDapClient.sendRequest;
      mockDapClient.emit('stopped', { reason: 'entry' });
      mockDapClient.emit('continued', { threadId: 7 });
      await vi.advanceTimersByTimeAsync(1000);
      expect(forwardedStops()).toEqual([]);
      expect(sent().some((m) => m.type === 'dapEvent' && m.event === 'continued')).toBe(false);
      // A durable thread-less entry stop is still forwarded with the discovered thread.
      mockDapClient.emit('stopped', { reason: 'entry' });
      await vi.advanceTimersByTimeAsync(1000);
      expect(forwardedStops()).toEqual([expect.objectContaining({ reason: 'entry', threadId: 7 })]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('swallows the superseded isolate\'s own resume, not the user\'s later one', async () => {
    vi.useFakeTimers();
    try {
      await configure(initPayload({ stopOnEntry: false }), entryPolicy());
      mockDapClient.emit('stopped', { reason: 'entry', threadId: 2 }); // a spawned isolate's entry
      mockDapClient.emit('stopped', { reason: 'breakpoint', threadId: 1, hitBreakpointIds: [100000] }); // main's breakpoint supersedes
      mockDapClient.emit('continued', { threadId: 2 }); // the adapter resuming the isolate it paused
      mockDapClient.emit('continued', { threadId: 1 }); // the user's continue
      await vi.advanceTimersByTimeAsync(1000);
      expect(forwardedStops().map((b) => b.reason)).toEqual(['breakpoint']);
      const continued = sent().filter((m) => m.type === 'dapEvent' && m.event === 'continued').map((m) => (m.body as Sent).threadId);
      expect(continued).toEqual([1]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('forgets a held entry stop when the program ends', async () => {
    vi.useFakeTimers();
    try {
      const policy = entryPolicy();
      await configure(initPayload({ stopOnEntry: false }), policy);
      const w = worker as unknown as Record<string, unknown>;
      (w.connectionManager as { setupEventHandlers: ReturnType<typeof vi.fn> }).setupEventHandlers.mockImplementation((client: EventEmitter, handlers: Record<string, (body?: unknown) => void>) => {
        for (const [key, name] of [['onStopped', 'stopped'], ['onContinued', 'continued'], ['onExited', 'exited'], ['onTerminated', 'terminated']] as const) {
          if (handlers[key]) client.on(name, handlers[key]);
        }
      });
      mockDapClient.removeAllListeners();
      (w.setupDapEventHandlers as () => void)();
      mockDapClient.emit('stopped', { reason: 'entry', threadId: 1 });
      mockDapClient.emit('exited', { exitCode: 0 });
      mockDapClient.emit('terminated', {});
      await vi.advanceTimersByTimeAsync(5000);
      expect(forwardedStops()).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('lets a real stop supersede a held entry stop instead of reporting both', async () => {
    vi.useFakeTimers();
    try {
      await configure(initPayload({ stopOnEntry: false }), entryPolicy());
      mockDapClient.emit('stopped', { reason: 'entry', threadId: 1 });
      mockDapClient.emit('stopped', { reason: 'exception', threadId: 1 });
      await vi.advanceTimersByTimeAsync(1000);
      expect(forwardedStops().map((b) => b.reason)).toEqual(['exception']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('relabels the first breakpoint stop that names no hitBreakpointIds as the entry while the entry breakpoint is armed (the Dart SDK adapter names none)', async () => {
    await configure(initPayload({ stopOnEntry: true }), entryPolicy());
    mockDapClient.emit('stopped', { reason: 'breakpoint', threadId: 1, allThreadsStopped: false });
    mockDapClient.emit('stopped', { reason: 'breakpoint', threadId: 1, allThreadsStopped: false });
    await new Promise((r) => setImmediate(r));
    const stops = forwardedStops();
    expect(stops.map((b) => b.reason)).toEqual(['entry', 'breakpoint']);
    expect(stops[0].hitBreakpointIds).toBeUndefined();
  });

  it('re-adds the armed entry breakpoint to a relayed setBreakpoints for the program file, hides it from the answer, and takes its new id', async () => {
    await configure(initPayload({ stopOnEntry: true }), entryPolicy());
    let nextId = 200000;
    mockDapClient.sendRequest = vi.fn(async (command: string, args: Record<string, unknown>) => {
      const bps = (args.breakpoints as Array<{ line: number }>) ?? [];
      return { seq: 1, type: 'response', request_seq: 1, success: true, command, body: { breakpoints: bps.map((b) => ({ id: nextId++, verified: false, line: b.line })) } };
    }) as typeof mockDapClient.sendRequest;
    await (worker as unknown as { handleDapCommand: (cmd: unknown) => Promise<void> }).handleDapCommand({
      requestId: 'r1', cmd: 'dap', sessionId: 's', dapCommand: 'setBreakpoints',
      dapArgs: { source: { path: PROGRAM }, breakpoints: [{ line: 9 }] },
    });
    // The adapter saw the user's line and the entry line; the parent sees only the user's answer.
    const sentArgs = (mockDapClient.sendRequest as ReturnType<typeof vi.fn>).mock.calls[0][1] as { breakpoints: Array<{ line: number }> };
    expect(sentArgs.breakpoints.map((b) => b.line)).toEqual([9, 3]);
    const answer = sent().find((m) => m.type === 'dapResponse' && m.requestId === 'r1') as Sent;
    expect(((answer.body as Sent).breakpoints as Sent[]).map((b) => b.line)).toEqual([9]);
    // The entry breakpoint now has the adapter's new id (Dart rotates ids on every re-send).
    mockDapClient.emit('stopped', { reason: 'breakpoint', threadId: 1, hitBreakpointIds: [200001] });
    await new Promise((r) => setImmediate(r));
    expect(forwardedStops()[0]).toMatchObject({ reason: 'entry', hitBreakpointIds: [] });
  });

  it('arms nothing for an attach session (there is no program start to stop at)', async () => {
    (worker as unknown as Record<string, unknown>).isAttachMode = true;
    await configure(initPayload({ stopOnEntry: true, scriptPath: 'attach://remote' }), entryPolicy());
    expect(setBreakpoints).not.toHaveBeenCalled();
    expect(dependencies.fileSystem.readFile).not.toHaveBeenCalled();
    expect(sent().some((m) => m.status === 'adapter_notice')).toBe(false);
  });

  it('tells the caller when stopOnEntry could not be armed', async () => {
    await configure(initPayload({ stopOnEntry: true }), entryPolicy({ entryBreakpointLine: () => undefined }));
    const notice = sent().find((m) => m.type === 'status' && m.status === 'adapter_notice') as Sent | undefined;
    expect(notice?.note).toMatch(/stopOnEntry/);
    expect(notice?.note).toMatch(/no entry breakpoint armed/);
  });

  it('still forwards entry stops for policies that do not suppress them', async () => {
    await configure(initPayload({ stopOnEntry: false }), entryPolicy({ suppressesAdapterEntryStop: undefined }));
    mockDapClient.emit('stopped', { reason: 'entry', threadId: 1 });
    await new Promise((r) => setImmediate(r));
    expect(forwardedStops().map((b) => b.reason)).toEqual(['entry']);
  });

  it('arms a breakpoint on the policy\'s entry line for a stopOnEntry launch, hidden from the synced list', async () => {
    const userBp = { id: 'u1', file: PROGRAM, line: 9 };
    await configure(initPayload({ stopOnEntry: true, initialBreakpoints: [userBp] }), entryPolicy());
    expect(setBreakpoints).toHaveBeenCalledTimes(1);
    const [, file, bps] = setBreakpoints.mock.calls[0] as [unknown, string, Array<{ line: number }>];
    expect(file.toLowerCase()).toBe(PROGRAM.toLowerCase());
    expect(bps.map((b) => b.line)).toEqual([9, 3]);
    expect(dependencies.fileSystem.readFile).toHaveBeenCalledWith(PROGRAM, 'utf8');
    const synced = syncedBreakpoints();
    expect(synced).toBeDefined();
    expect(synced!.map((b) => b.line)).toEqual([9]);
    expect(synced![0].adapterId).toBe(100000);
  });

  it('relabels the first hit of the entry breakpoint as the entry stop and strips its id, once', async () => {
    await configure(initPayload({ stopOnEntry: true }), entryPolicy());
    expect((setBreakpoints.mock.calls[0] as [unknown, string, Array<{ line: number }>])[2].map((b) => b.line)).toEqual([3]);
    mockDapClient.emit('stopped', { reason: 'entry', threadId: 1 }); // the adapter's own, dropped
    mockDapClient.emit('stopped', { reason: 'breakpoint', threadId: 1, hitBreakpointIds: [100000] });
    mockDapClient.emit('stopped', { reason: 'breakpoint', threadId: 1, hitBreakpointIds: [100000] });
    await new Promise((r) => setImmediate(r));
    const stops = forwardedStops();
    expect(stops.map((b) => b.reason)).toEqual(['entry', 'breakpoint']);
    expect(stops[0].hitBreakpointIds).toEqual([]);
    expect(stops[0].threadId).toBe(1);
  });

  it('keeps a user breakpoint id on a shared hit while relabelling the entry', async () => {
    await configure(initPayload({ stopOnEntry: true, initialBreakpoints: [{ id: 'u1', file: PROGRAM, line: 3 }] }), entryPolicy());
    mockDapClient.emit('stopped', { reason: 'breakpoint', threadId: 1, hitBreakpointIds: [100000, 100001] });
    await new Promise((r) => setImmediate(r));
    expect(forwardedStops()[0]).toMatchObject({ reason: 'entry', hitBreakpointIds: [100000] });
  });

  it('arms nothing when stopOnEntry is off, the debugger is off, or the policy finds no entry line', async () => {
    await configure(initPayload({ stopOnEntry: false, initialBreakpoints: [{ id: 'u1', file: PROGRAM, line: 9 }] }), entryPolicy());
    expect((setBreakpoints.mock.calls[0] as [unknown, string, Array<{ line: number }>])[2].map((b) => b.line)).toEqual([9]);

    setBreakpoints.mockClear();
    await configure(initPayload({ stopOnEntry: true, debuggerOff: true }), entryPolicy());
    expect(setBreakpoints).not.toHaveBeenCalled();

    setBreakpoints.mockClear();
    await configure(initPayload({ stopOnEntry: true }), entryPolicy({ entryBreakpointLine: () => undefined }));
    expect(setBreakpoints).not.toHaveBeenCalled();
  });

  it('does not touch policies without an entry line (the existing adapters)', async () => {
    await configure(initPayload({ stopOnEntry: true, initialBreakpoints: [{ id: 'u1', file: PROGRAM, line: 9 }] }), { ...DefaultAdapterPolicy } as AdapterPolicy);
    expect((setBreakpoints.mock.calls[0] as [unknown, string, Array<{ line: number }>])[2].map((b) => b.line)).toEqual([9]);
    expect(dependencies.fileSystem.readFile).not.toHaveBeenCalled();
  });
});
