import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'path';

import { getAdapterRegistry, resetAdapterRegistry } from '../../../../src/adapters/adapter-registry.js';
import { ProxyManagerFactory } from '../../../../src/factories/proxy-manager-factory.js';
import { FakeProxyProcessLauncher } from '../../../implementations/test/fake-process-launcher.js';
import { createMockFileSystem, createMockLogger, waitForEvent } from '../../../test-utils/helpers/test-utils.js';
import { JavascriptAdapterFactory } from '../../../../packages/adapter-javascript/src/index.js';

function norm(p: unknown): string {
  return typeof p === 'string' ? (p as string).replace(/\\+/g, '/') : '';
}

describe('JavaScript adapter - proxy startup (integration)', () => {
  const isWin = process.platform === 'win32';
  const sessionId = 'session-js-1';
  const dummyScript = isWin ? 'C:\\\\tmp\\\\app.js' : '/tmp/app.js';
  const logDir = path.join(process.cwd(), 'logs', 'tests');
  const adapterHost = '127.0.0.1';
  const adapterPort = 34567;

  let originalNodeOptions: string | undefined;

  beforeEach(() => {
    originalNodeOptions = process.env.NODE_OPTIONS;
    resetAdapterRegistry();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Restore env
    if (typeof originalNodeOptions === 'string') {
      process.env.NODE_OPTIONS = originalNodeOptions;
    } else {
      delete (process.env as Record<string, string | undefined>).NODE_OPTIONS;
    }
    // Extra safety to avoid registry leakage across tests
    resetAdapterRegistry();
    vi.restoreAllMocks();
  });

  it('wires adapterCommand into ProxyManager init and supports dry run', async () => {
    // Arrange: registry and adapter
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

    // Arrange: fake launcher and proxies
    const fakeLauncher = new FakeProxyProcessLauncher();
    const fs = createMockFileSystem();
    // Ensure proxy bootstrap check passes
    vi.mocked(fs.pathExists).mockResolvedValue(true);
    const logger = createMockLogger();

    const factory = new ProxyManagerFactory(
      // IProxyProcessLauncher
      fakeLauncher as unknown as any,
      fs as unknown as any,
      logger as unknown as any
    );
    const proxyManager = factory.create(adapter);

    // Prepare proxy: first signal 'proxy-ready', then dry run complete and exit
    fakeLauncher.prepareProxy((proxy) => {
      process.nextTick(() => {
        proxy.simulateMessage({ type: 'proxy-ready', pid: process.pid });
      });
      setTimeout(() => {
        proxy.simulateMessage({
          type: 'status',
          sessionId,
          status: 'dry_run_complete',
          command: 'node -e "0"',
          script: dummyScript
        });
        // Simulate normal exit for dry run
        proxy.simulateExit(0);
      }, 5);
    });

    // Build ProxyConfig with dryRunSpawn and adapterCommand
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
      dryRunSpawn: true,
      adapterCommand
    } as any;

    // Act - set listener before start to avoid missing the event
    const dryRunPromise = waitForEvent<[string, string]>(proxyManager as any, 'dry-run-complete');
    await proxyManager.start(proxyConfig);
    await dryRunPromise;

    // Assert: init payload sent to proxy contains adapterCommand
    expect(fakeLauncher.launchedProxies.length).toBe(1);
    const launched = fakeLauncher.getLastLaunchedProxy()!;
    expect(launched).toBeDefined();
    const initPayload = (launched.sentCommands[0] || {}) as any;
    expect(initPayload).toBeDefined();
    expect(initPayload.cmd).toBe('init');
    expect(initPayload.sessionId).toBe(sessionId);
    expect(initPayload.adapterCommand).toBeDefined();

    const cmd = initPayload.adapterCommand as {
      command: string;
      args: string[];
      env?: Record<string, string>;
    };

    // Command is absolute node path
    expect(typeof cmd.command).toBe('string');
    expect(path.isAbsolute(cmd.command)).toBe(true);

    // Args: [vendor/js-debug/vsDebugServer.js, '--stdio']
    expect(Array.isArray(cmd.args)).toBe(true);
    expect(cmd.args.length).toBeGreaterThanOrEqual(2);
    const adapterPath = norm(cmd.args[0]);
    expect(adapterPath.endsWith('/vendor/js-debug/vsDebugServer.cjs')).toBe(true);
    expect(cmd.args[1]).toBe(String(34567));

    // Env contains NODE_OPTIONS memory flag; do not assert entire env
    const nodeOpts = String(cmd.env?.NODE_OPTIONS || '');
    expect(nodeOpts.includes('--max-old-space-size=4096')).toBe(true);

    // Ensure process.env not mutated
    expect(process.env.NODE_OPTIONS).toBe(originalNodeOptions);

    // Cleanup
    await proxyManager.stop();
  });
});
