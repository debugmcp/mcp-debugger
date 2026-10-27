/**
 * The proxy worker's half of `hot_reload` (issue #876): the custom DAP events a policy's
 * `liveUpdate.events` names are forwarded to the session (the Flutter adapter's
 * `flutter.appStart` / `flutter.appStarted` are how the session learns the app has started),
 * and the feature's resume commands (`hotReload`) clear the worker's last stop like a continue.
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

type Sent = Record<string, unknown>;

function liveUpdatePolicy(): AdapterPolicy {
  return {
    ...DefaultAdapterPolicy,
    name: 'flutter-like',
    liveUpdate: {
      events: ['flutter.appStart', 'flutter.appStarted'],
      resumeCommands: ['hotReload'],
      request: () => ({ command: 'hotReload' }),
      changed: () => true,
    },
  } as AdapterPolicy;
}

function initPayload(): ProxyInitPayload {
  return {
    cmd: 'init',
    sessionId: 's',
    executablePath: 'dart',
    adapterHost: '127.0.0.1',
    adapterPort: 4711,
    logDir: 'C:\\logs',
    scriptPath: PROGRAM,
    stopOnEntry: false,
    initialBreakpoints: [],
    initialFunctionBreakpoints: [],
  } as ProxyInitPayload;
}

describe('DapProxyWorker live update events and resumes (issue #876)', () => {
  let worker: DapProxyWorker;
  let mockDapClient: ReturnType<typeof createMockDapClient>;
  let send: ReturnType<typeof vi.fn>;
  let connectionStub: Record<string, unknown>;

  const sent = (): Sent[] => send.mock.calls.map(([m]) => m as Sent);
  const forwardedEvents = (): string[] => sent().filter((m) => m.type === 'dapEvent').map((m) => String(m.event));

  beforeEach(() => {
    mockDapClient = createMockDapClient();
    send = vi.fn();
    connectionStub = {
      setBreakpoints: vi.fn(async () => ({ body: { breakpoints: [] } })),
      setExceptionBreakpoints: vi.fn(async () => ({})),
      sendConfigurationDone: vi.fn(async () => ({})),
      setupEventHandlers: vi.fn((client: EventEmitter, handlers: Record<string, (body?: unknown) => void>) => {
        for (const [key, name] of [['onStopped', 'stopped'], ['onContinued', 'continued']] as const) {
          if (handlers[key]) client.on(name, handlers[key]);
        }
      }),
    };
    const fileSystem = createMockFileSystem();
    fileSystem.readFile = vi.fn(async () => 'void main() {}\n');
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

  async function configure(policy: AdapterPolicy): Promise<void> {
    const w = worker as unknown as Record<string, unknown>;
    w.adapterPolicy = policy;
    w.currentInitPayload = initPayload();
    (w.setupDapEventHandlers as () => void)();
    await (w.runConfigurationPhase as (p: ProxyInitPayload, c: unknown, cm: unknown) => Promise<void>)(initPayload(), mockDapClient, connectionStub);
  }

  it("forwards the policy's live-update events to the session as DAP events, with their bodies", async () => {
    await configure(liveUpdatePolicy());
    mockDapClient.emit('flutter.appStart', { launchMode: 'run', supportsRestart: true });
    mockDapClient.emit('flutter.appStarted', {});
    mockDapClient.emit('dart.serviceExtensionAdded', { extensionRPC: 'ext.flutter.x' });

    expect(forwardedEvents()).toEqual(['flutter.appStart', 'flutter.appStarted']);
    const start = sent().find((m) => m.type === 'dapEvent' && m.event === 'flutter.appStart');
    expect(start?.body).toEqual({ launchMode: 'run', supportsRestart: true });
  });

  it('forwards nothing extra for a policy without liveUpdate', async () => {
    await configure({ ...DefaultAdapterPolicy, name: 'plain' } as AdapterPolicy);
    mockDapClient.emit('flutter.appStarted', {});
    expect(forwardedEvents()).toEqual([]);
  });

  it("clears the last stop when one of the feature's resume commands goes out", async () => {
    await configure(liveUpdatePolicy());
    mockDapClient.emit('stopped', { reason: 'breakpoint', threadId: 1 });
    await new Promise((r) => setImmediate(r));
    const w = worker as unknown as Record<string, unknown>;
    expect(w.lastStop).not.toBeNull();

    mockDapClient.sendRequest = vi.fn(async () => ({ seq: 9, type: 'response', request_seq: 9, success: true, command: 'hotReload', body: {} })) as typeof mockDapClient.sendRequest;
    await (w.handleDapCommand as (p: unknown) => Promise<void>)({ cmd: 'dap', sessionId: 's', requestId: 'r1', dapCommand: 'hotReload', dapArgs: {} });

    expect(w.lastStop).toBeNull();
  });
});
