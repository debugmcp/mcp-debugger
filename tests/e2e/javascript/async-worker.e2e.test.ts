import fs from 'fs';
import path from 'path';
import { describe, test, expect, vi, beforeAll, afterAll } from 'vitest';
import { resetAdapterRegistry, getAdapterRegistry } from '../../../src/adapters/adapter-registry.js';
import { createProductionDependencies } from '../../../src/container/dependencies.js';
import { DebugLanguage } from '@debugmcp/shared';
import { waitForEvent } from '../../test-utils/helpers/test-utils.ts';
// Prefer alias if configured; keep relative fallback for local dev
import { JavascriptAdapterFactory } from '../../../packages/adapter-javascript/src/index.ts';

vi.setConfig({ testTimeout: 90000 });

const norm = (p: string) => p.replace(/\\+/g, '/');

function findBreakLine(filePath: string): number {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  const idx = lines.findIndex(l => l.includes('// BREAK_HERE'));
  if (idx === -1) throw new Error(`BREAK_HERE not found in ${filePath}`);
  return idx + 1;
}

describe('E2E JS - async + worker_threads (multi-thread)', () => {
  const logsDir = path.join(process.cwd(), 'logs');
  const sessionId = `e2e-js-worker-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const fixturesDir = path.resolve(process.cwd(), 'tests/fixtures/javascript-e2e');
  const mainProgram = path.join(fixturesDir, 'worker.js');
  const workerProgram = path.join(fixturesDir, 'worker-helper.js');

  let proxyManager: import('../../../src/proxy/proxy-manager.js').IProxyManager | null = null;
  let restoreEnv: Record<string, string | undefined> = {};

  beforeAll(async () => {
    restoreEnv.NODE_OPTIONS = process.env.NODE_OPTIONS;
    restoreEnv.PATH = process.env.PATH;

    fs.mkdirSync(logsDir, { recursive: true });

    const deps = createProductionDependencies({
      logLevel: 'info',
      logFile: path.join(logsDir, `e2e-js-worker-${Date.now()}.log`)
    });

    resetAdapterRegistry();
    const registry = getAdapterRegistry({ validateOnRegister: true });
    await registry.register('javascript', new JavascriptAdapterFactory());

    // Allocate a valid TCP port for the adapter (proxy requires non-zero port)
    const adapterPort = 9229 + Math.floor(Math.random() * 1000);

    const adapterConfig = {
      sessionId,
      executablePath: process.execPath,
      adapterHost: 'localhost',
      adapterPort,
      logDir: logsDir,
      scriptPath: mainProgram,
      scriptArgs: [],
      launchConfig: {}
    };

    const adapter = await registry.create('javascript', adapterConfig);

    const adapterCommand = adapter.buildAdapterCommand(adapterConfig);
    expect(norm(adapterCommand.args[0])).toMatch(/\/vendor\/js-debug\/vsDebugServer\.cjs$/);
    expect(adapterCommand.args[1]).toMatch(/^\d+$/);
    expect(Number(adapterCommand.args[1])).toBe(adapterPort);

    const launchCfg = adapter.transformLaunchConfig({
      program: mainProgram,
      cwd: fixturesDir,
      stopOnEntry: true,
      args: []
    } as unknown as any);

    const pmFactory = deps.proxyManagerFactory;
    proxyManager = pmFactory.create(adapter);

    // TODO: switch to DebugLanguage.JAVASCRIPT when enum supports it
    await proxyManager.start({
      sessionId,
      language: DebugLanguage.MOCK,
      executablePath: process.execPath,
      adapterHost: 'localhost',
      adapterPort,
      logDir: logsDir,
      scriptPath: mainProgram,
      scriptArgs: [],
      stopOnEntry: false,
      justMyCode: true,
      dryRunSpawn: false,
      adapterCommand
    } as any);

    // DAP sequence
    await proxyManager.sendDapRequest('initialize', {
      clientID: 'e2e',
      adapterID: 'javascript',
      linesStartAt1: true,
      columnsStartAt1: true,
      pathFormat: 'path'
    });

    // Set breakpoints in main and worker sources before launch
    const mainLine = findBreakLine(mainProgram);
    const workerLine = findBreakLine(workerProgram);

    await proxyManager.sendDapRequest('setBreakpoints', {
      source: { path: mainProgram },
      breakpoints: [{ line: mainLine }],
      sourceModified: false
    });

    await proxyManager.sendDapRequest('setBreakpoints', {
      source: { path: workerProgram },
      breakpoints: [{ line: workerLine }],
      sourceModified: false
    });

    // Align with VS Code behavior: send exception filters during configuration phase
    await proxyManager.sendDapRequest('setExceptionBreakpoints', { filters: [] });
    
    await proxyManager.sendDapRequest('configurationDone', {});
    await proxyManager.sendDapRequest('launch', { ...launchCfg });
  }, 90000);

  afterAll(async () => {
    try {
      if (proxyManager) {
        await proxyManager.stop();
      }
    } finally {
      if (restoreEnv.NODE_OPTIONS !== undefined) process.env.NODE_OPTIONS = restoreEnv.NODE_OPTIONS;
      if (restoreEnv.PATH !== undefined) process.env.PATH = restoreEnv.PATH;
    }
  });

  test('hits breakpoints in main and worker; thread IDs differ; step in async path', async () => {
    const seenThreads = new Set<number>();

    // Expect at least two stopped events with different threadIds (main and worker)
    for (let i = 0; i < 2; i++) {
      const [threadId] = await waitForEvent<[number, string, unknown]>(
        proxyManager as any,
        'stopped',
        60000
      );
      expect(typeof threadId).toBe('number');
      seenThreads.add(threadId);

      // Sanity: ProxyManager current thread updated
      expect((proxyManager as any).getCurrentThreadId()).toBe(threadId);

      // Peek stackTrace; optionally step next on the first stop to exercise stepping
      const st: any = await (proxyManager as any).sendDapRequest('stackTrace', { threadId });
      const top = st?.body?.stackFrames?.[0];
      expect(top?.id).toBeDefined();

      if (i === 0) {
        // step next should pause again on a user line (smartStep implied)
        await (proxyManager as any).sendDapRequest('next', { threadId });
        // Wait for paused again (or tolerate quick termination)
        try {
          await waitForEvent(proxyManager as any, 'stopped', 20000);
        } catch {
          // ignore; program may advance quickly
        }
      }

      // Continue after each observed stop to allow progress to next breakpoint
      await (proxyManager as any).sendDapRequest('continue', { threadId });
    }

    expect(seenThreads.size).toBeGreaterThanOrEqual(2);

    // Finally wait for test end
    await Promise.race([
      waitForEvent(proxyManager as any, 'terminated', 30000),
      waitForEvent(proxyManager as any, 'exited', 30000)
    ]);
  });
});
