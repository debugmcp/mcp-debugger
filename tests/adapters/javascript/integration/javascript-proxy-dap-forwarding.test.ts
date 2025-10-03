import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'path';

import { getAdapterRegistry, resetAdapterRegistry } from '../../../../src/adapters/adapter-registry.js';
import { ProxyManagerFactory } from '../../../../src/factories/proxy-manager-factory.js';
import { FakeProxyProcessLauncher } from '../../../implementations/test/fake-process-launcher.js';
import { createMockFileSystem, createMockLogger, waitForEvent, waitForEvents } from '../../../test-utils/helpers/test-utils.js';
import { JavascriptAdapterFactory } from '../../../../packages/adapter-javascript/src/index.js';

function norm(p: unknown): string {
  return typeof p === 'string' ? (p as string).replace(/\\+/g, '/') : '';
}

describe('JavaScript adapter - DAP forwarding (integration)', () => {
  const isWin = process.platform === 'win32';
  const sessionId = 'session-js-2';
  const dummyScript = isWin ? 'C:\\\\tmp\\\\app.js' : '/tmp/app.js';
  const logDir = path.join(process.cwd(), 'logs', 'tests');
  const adapterHost = '127.0.0.1';
  const adapterPort = 45678;

  let originalNodeOptions: string | undefined;

  beforeEach(() => {
    originalNodeOptions = process.env.NODE_OPTIONS;
    resetAdapterRegistry();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    if (typeof originalNodeOptions === 'string') {
      process.env.NODE_OPTIONS = originalNodeOptions;
    } else {
      delete (process.env as Record<string, string | undefined>).NODE_OPTIONS;
    }
    resetAdapterRegistry();
    vi.restoreAllMocks();
  });

  it('propagates stopped/output events and tracks threadId', async () => {
    // Arrange registry + adapter
    const registry = getAdapterRegistry({ validateOnRegister: false });
    await registry.register('javascript', new JavascriptAdapterFactory());

    const adapterConfig = {
      sessionId,
      executablePath: process.execPath,
      adapterHost,
      adapterPort,
      logDir,
      scriptPath: dummyScript,
      scriptArgs: [],
      launchConfig: {}
    } as any;

    const adapter = await registry.create('javascript', adapterConfig);
    const adapterCommand = adapter.buildAdapterCommand(adapterConfig);

    // Arrange proxy + manager
    const fakeLauncher = new FakeProxyProcessLauncher();
    const fs = createMockFileSystem();
    vi.mocked(fs.pathExists).mockResolvedValue(true);
    const logger = createMockLogger();

    const factory = new ProxyManagerFactory(
      fakeLauncher as unknown as any,
      fs as unknown as any,
      logger as unknown as any
    );
    const proxyManager = factory.create(adapter);

    // Prepare proxy: proxy-ready -> adapter_configured_and_launched -> DAP events
    fakeLauncher.prepareProxy((proxy) => {
      process.nextTick(() => {
        proxy.simulateMessage({ type: 'proxy-ready', pid: process.pid });
      });
      setTimeout(() => {
        proxy.simulateMessage({
          type: 'status',
          sessionId,
          status: 'adapter_configured_and_launched'
        });
      }, 5);
      setTimeout(() => {
        proxy.simulateMessage({
          type: 'dapEvent',
          sessionId,
          event: 'stopped',
          body: { threadId: 7, reason: 'breakpoint' }
        });
      }, 10);
      setTimeout(() => {
        proxy.simulateMessage({
          type: 'dapEvent',
          sessionId,
          event: 'output',
          body: { output: 'hello' }
        });
      }, 15);
    });

    const proxyConfig = {
      sessionId,
      language: 'javascript' as any,
      executablePath: process.execPath,
      adapterHost,
      adapterPort,
      logDir,
      scriptPath: dummyScript,
      scriptArgs: [],
      stopOnEntry: false,
      justMyCode: true,
      initialBreakpoints: [],
      dryRunSpawn: false,
      adapterCommand
    } as any;

    // Set up listeners BEFORE start to avoid missing early events
    const order: string[] = [];
    const configuredP = new Promise<void>((resolve) => {
      (proxyManager as any).once('adapter-configured', () => { order.push('configured'); resolve(); });
    });
    const initializedP = new Promise<void>((resolve) => {
      (proxyManager as any).once('initialized', () => { order.push('initialized'); resolve(); });
    });
    const stoppedP = new Promise<[number, string]>((resolve) => {
      (proxyManager as any).once('stopped', (threadId: number, reason: string) => resolve([threadId, reason]));
    });
    const dapEventP = new Promise<[string, any]>((resolve) => {
      (proxyManager as any).once('dap-event', (evt: string, body: any) => resolve([evt, body]));
    });

    // Act
    await proxyManager.start(proxyConfig);

    // Await status events and assert order
    await configuredP;
    await initializedP;
    expect(order).toEqual(['configured', 'initialized']);

    // Assert stopped event and thread tracking
    const [stoppedThreadId, reason] = await stoppedP;
    expect(stoppedThreadId).toBe(7);
    expect(reason).toBe('breakpoint');

    // currentThreadId reflects last stopped thread
    expect(proxyManager.getCurrentThreadId()).toBe(7);

    // Assert passthrough of generic DAP event ('output')
    const [evt, body] = await dapEventP;
    expect(evt).toBe('output');
    expect(body).toEqual({ output: 'hello' });

    // Cleanup
    await proxyManager.stop();
  });
});
