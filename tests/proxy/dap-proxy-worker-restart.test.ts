/**
 * Hot restart through DAP `restart` (issue #876): what the proxy worker must do for it.
 *
 * - The Flutter adapter advertises `supportsRestartRequest` in a `capabilities` EVENT after
 *   `app.start`, not in its initialize response; the worker forwards that event to the parent,
 *   merged into the capabilities it already reported, past the once-only guard that exists for
 *   the initialize response.
 * - `restart` resumes the program: the worker's `lastStop` is cleared like a continue.
 * - A hot restart re-runs `main()`, so the entry breakpoint a `stopOnEntry` launch armed hits
 *   again; the relabel is re-armed when `restart` goes out, so the session sees `entry` again
 *   rather than a `breakpoint` stop on a breakpoint it cannot list.
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

const PROGRAM = path.resolve('/p/lib/main.dart');
const SOURCE = "import 'package:flutter/material.dart';\n\nvoid main() {\n  runApp(const App());\n}\n";

type Sent = Record<string, unknown>;

function entryPolicy(): AdapterPolicy {
  return {
    ...DefaultAdapterPolicy,
    name: 'dart-like',
    suppressesAdapterEntryStop: true,
    entryBreakpointLine: (src: string) => { const i = src.split(/\r?\n/).findIndex((l) => /\bmain\s*\(/.test(l)); return i >= 0 ? i + 1 : undefined; },
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

describe('DapProxyWorker hot restart (issue #876)', () => {
  let worker: DapProxyWorker;
  let mockDapClient: ReturnType<typeof createMockDapClient>;
  let send: ReturnType<typeof vi.fn>;
  let connectionStub: Record<string, unknown>;

  const sent = (): Sent[] => send.mock.calls.map(([m]) => m as Sent);
  const forwardedStops = (): Sent[] => sent().filter((m) => m.type === 'dapEvent' && m.event === 'stopped').map((m) => m.body as Sent);
  const capabilityStatuses = (): Sent[] => sent().filter((m) => m.type === 'status' && m.status === 'adapter_capabilities');

  beforeEach(() => {
    mockDapClient = createMockDapClient();
    send = vi.fn();
    connectionStub = {
      setBreakpoints: vi.fn(async (_client: unknown, _file: string, bps: Array<{ line: number }>) => ({
        body: { breakpoints: bps.map((b, i) => ({ id: 100000 + i, verified: true, line: b.line })) },
      })),
      setExceptionBreakpoints: vi.fn(async () => ({})),
      sendConfigurationDone: vi.fn(async () => ({})),
      setupEventHandlers: vi.fn((client: EventEmitter, handlers: Record<string, (body?: unknown) => void>) => {
        for (const [key, name] of [['onStopped', 'stopped'], ['onContinued', 'continued'], ['onBreakpoint', 'breakpoint'], ['onCapabilities', 'capabilities']] as const) {
          if (handlers[key]) client.on(name, handlers[key]);
        }
      }),
    };
    const fileSystem = createMockFileSystem();
    fileSystem.readFile = vi.fn(async () => SOURCE);
    const dependencies = {
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

  async function sendRestart(): Promise<void> {
    mockDapClient.sendRequest = vi.fn(async () => ({ seq: 9, type: 'response', request_seq: 9, success: true, command: 'restart', body: {} })) as typeof mockDapClient.sendRequest;
    const w = worker as unknown as Record<string, unknown>;
    await (w.handleDapCommand as (p: unknown) => Promise<void>)({ cmd: 'dap', sessionId: 's', requestId: 'r-restart', dapCommand: 'restart', dapArgs: {} });
  }

  it('forwards a capabilities event to the parent, merged into the capabilities the initialize response reported', async () => {
    await configure(initPayload({ stopOnEntry: false }), entryPolicy());
    const w = worker as unknown as Record<string, unknown>;
    (w.captureAdapterCapabilities as (c: unknown) => void)({ supportsLogPoints: true, supportsRestartRequest: false });
    expect(capabilityStatuses()).toHaveLength(1);

    mockDapClient.emit('capabilities', { capabilities: { supportsRestartRequest: true } });

    const statuses = capabilityStatuses();
    expect(statuses).toHaveLength(2);
    expect(statuses[1].capabilities).toEqual({ supportsLogPoints: true, supportsRestartRequest: true });
  });

  it('treats restart as a resume: the last stop is cleared', async () => {
    await configure(initPayload({ stopOnEntry: false }), entryPolicy());
    mockDapClient.emit('stopped', { reason: 'breakpoint', threadId: 1, hitBreakpointIds: [100000] });
    await new Promise((r) => setImmediate(r));
    const w = worker as unknown as Record<string, unknown>;
    expect(w.lastStop).not.toBeNull();

    await sendRestart();

    expect(w.lastStop).toBeNull();
  });

  it('re-arms the entry relabel on restart: the entry breakpoint hit by the re-run main() is reported as entry again', async () => {
    await configure(initPayload({ stopOnEntry: true }), entryPolicy());
    // The launch's own entry hit, relabelled once.
    mockDapClient.emit('stopped', { reason: 'breakpoint', threadId: 1 });
    await new Promise((r) => setImmediate(r));
    expect(forwardedStops().map((b) => b.reason)).toEqual(['entry']);

    await sendRestart();
    // The hot restart re-runs main() on a new isolate: the same armed breakpoint hits again.
    mockDapClient.emit('stopped', { reason: 'breakpoint', threadId: 2 });
    await new Promise((r) => setImmediate(r));

    expect(forwardedStops().map((b) => b.reason)).toEqual(['entry', 'entry']);
  });

  it('leaves a later breakpoint stop alone once the re-armed entry hit has been reported', async () => {
    await configure(initPayload({ stopOnEntry: true }), entryPolicy());
    mockDapClient.emit('stopped', { reason: 'breakpoint', threadId: 1 });
    await new Promise((r) => setImmediate(r));
    await sendRestart();
    mockDapClient.emit('stopped', { reason: 'breakpoint', threadId: 2 });
    mockDapClient.emit('stopped', { reason: 'breakpoint', threadId: 2 });
    await new Promise((r) => setImmediate(r));

    expect(forwardedStops().map((b) => b.reason)).toEqual(['entry', 'entry', 'breakpoint']);
  });
});
