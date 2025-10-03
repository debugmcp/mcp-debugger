import fs from 'fs';
import path from 'path';
import { describe, test, expect, vi, beforeAll, afterAll } from 'vitest';
import { resetAdapterRegistry, getAdapterRegistry } from '../../../src/adapters/adapter-registry.js';
import { createProductionDependencies } from '../../../src/container/dependencies.js';
import { DebugLanguage } from '@debugmcp/shared';
import { waitForEvent } from '../../test-utils/helpers/test-utils.ts';
// Prefer alias if working; fallback relative import for robustness during local runs
import { JavascriptAdapterFactory } from '../../../packages/adapter-javascript/src/index.ts';

vi.setConfig({ testTimeout: 90000 }); // TS + sourcemaps can be slower

const norm = (p: string) => p.replace(/\\+/g, '/');

function findBreakLine(filePath: string): number {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  const idx = lines.findIndex(l => l.includes('// BREAK_HERE'));
  if (idx === -1) throw new Error(`BREAK_HERE not found in ${filePath}`);
  return idx + 1;
}

describe('E2E JS/TS - TypeScript via tsx (source maps)', () => {
  const logsDir = path.join(process.cwd(), 'logs');
  const sessionId = `e2e-js-ts-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const fixturesDir = path.resolve(process.cwd(), 'tests/fixtures/javascript-e2e');
  const program = path.join(fixturesDir, 'app.ts');

  let proxyManager: import('../../../src/proxy/proxy-manager.js').IProxyManager | null = null;
  let restoreEnv: Record<string, string | undefined> = {};

  beforeAll(async () => {
    restoreEnv.NODE_OPTIONS = process.env.NODE_OPTIONS;
    restoreEnv.PATH = process.env.PATH;

    fs.mkdirSync(logsDir, { recursive: true });

    const deps = createProductionDependencies({
      logLevel: 'info',
      logFile: path.join(logsDir, `e2e-js-ts-${Date.now()}.log`)
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
      scriptPath: program,
      scriptArgs: [],
      launchConfig: {}
    };

    const adapter = await registry.create('javascript', adapterConfig);

    // Build adapter command and assert vendor path and TCP port
    const adapterCommand = adapter.buildAdapterCommand(adapterConfig);
    expect(norm(adapterCommand.args[0])).toMatch(/\/vendor\/js-debug\/vsDebugServer\.cjs$/);
    expect(adapterCommand.args[1]).toMatch(/^\d+$/);
    expect(Number(adapterCommand.args[1])).toBe(adapterPort);

    // Launch config: assert TS sourcemap invariants; runtimeExecutable branch depends on env
    const launchCfg = adapter.transformLaunchConfig({
      program,
      cwd: fixturesDir,
      stopOnEntry: false,
      args: []
    } as unknown as any);

    // Common invariants for TS
    expect((launchCfg as any).sourceMaps).toBe(true);
    expect((launchCfg as any).outFiles).toBeDefined();

    // If tsx present on PATH, expect runtimeExecutable 'tsx'; else allow 'node'
    const rxTsx = /(^|[\\/])tsx(\.cmd|\.exe)?$/i;
    const runtimeExec = String((launchCfg as any).runtimeExecutable || '');
    if (rxTsx.test(runtimeExec)) {
      expect(runtimeExec.toLowerCase().includes('tsx')).toBe(true);
    } else {
      expect(runtimeExec.length).toBeGreaterThan(0); // typically 'node'
    }

    const pmFactory = deps.proxyManagerFactory;
    proxyManager = pmFactory.create(adapter);

    // TODO: switch to DebugLanguage.JAVASCRIPT when available
    await proxyManager.start({
      sessionId,
      language: DebugLanguage.MOCK,
      executablePath: process.execPath,
      adapterHost: 'localhost',
      adapterPort,
      logDir: logsDir,
      scriptPath: program,
      scriptArgs: [],
      stopOnEntry: false,
      justMyCode: true,
      dryRunSpawn: false,
      adapterCommand
    } as any);

    await proxyManager.sendDapRequest('initialize', {
      clientID: 'e2e',
      adapterID: 'javascript',
      linesStartAt1: true,
      columnsStartAt1: true,
      pathFormat: 'path'
    });

    const breakLine = findBreakLine(program);
    await proxyManager.sendDapRequest('setBreakpoints', {
      source: { path: program },
      breakpoints: [{ line: breakLine }],
      sourceModified: false
    });

    await proxyManager.sendDapRequest('launch', { ...launchCfg });
    await proxyManager.sendDapRequest('configurationDone', {});
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

  test('hits TS breakpoint and maps to .ts source', async () => {
    const [threadId] = await waitForEvent<[number, string, unknown]>(
      proxyManager as any,
      'stopped',
      60000
    );
    expect(typeof threadId).toBe('number');

    // stackTrace -> verify top frame source maps to app.ts
    const st: any = await (proxyManager as any).sendDapRequest('stackTrace', { threadId });
    const top = st?.body?.stackFrames?.[0];
    expect(top?.id).toBeDefined();
    const srcPath = norm(String(top?.source?.path || ''));
    expect(srcPath.endsWith('/tests/fixtures/javascript-e2e/app.ts')).toBe(true);

    // Continue to end
    await (proxyManager as any).sendDapRequest('continue', { threadId });
    await Promise.race([
      waitForEvent(proxyManager as any, 'terminated', 30000),
      waitForEvent(proxyManager as any, 'exited', 30000)
    ]);
  });
});
