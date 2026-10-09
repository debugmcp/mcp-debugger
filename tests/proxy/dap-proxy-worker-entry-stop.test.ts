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
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DefaultAdapterPolicy, type AdapterPolicy } from '@debugmcp/shared';
import { DapProxyWorker } from '../../src/proxy/dap-proxy-worker.js';
import type { DapProxyDependencies, ProxyInitPayload } from '../../src/proxy/dap-proxy-interfaces.js';
import { createMockDapClient } from '../test-utils/mocks/dap-client.js';
import { createMockLogger } from '../test-utils/helpers/test-dependencies.js';
import { createMockFileSystem, createMockProcessSpawner } from '../test-utils/mocks/dap-proxy-doubles.js';

const PROGRAM = 'C:\\p\\bin\\app.dart';
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

  it('drops the adapter\'s own entry stop when the policy says it is noise, and forwards every other stop', async () => {
    await configure(initPayload({ stopOnEntry: false }), entryPolicy());
    mockDapClient.emit('stopped', { reason: 'entry', threadId: 1, allThreadsStopped: false });
    mockDapClient.emit('continued', { threadId: 1 });
    mockDapClient.emit('stopped', { reason: 'breakpoint', threadId: 1, hitBreakpointIds: [100000] });
    await new Promise((r) => setImmediate(r));
    expect(forwardedStops().map((b) => b.reason)).toEqual(['breakpoint']);
    expect(sent().some((m) => m.type === 'dapEvent' && m.event === 'continued')).toBe(true);
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
