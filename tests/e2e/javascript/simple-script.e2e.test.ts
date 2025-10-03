import fs from 'fs';
import path from 'path';
import { describe, test, expect, vi, beforeAll, afterAll } from 'vitest';
import { resetAdapterRegistry, getAdapterRegistry } from '../../../src/adapters/adapter-registry.js';
import { createProductionDependencies } from '../../../src/container/dependencies.js';
import { DebugLanguage } from '@debugmcp/shared';
import { JavascriptAdapterFactory } from '../../../packages/adapter-javascript/src/index.ts';
import { waitForEvent } from '../../test-utils/helpers/test-utils.ts';

vi.setConfig({ testTimeout: 60000 }); // per-file safety; individual waits use 45s

// Normalize paths for cross-platform assertions
const norm = (p: string) => p.replace(/\\+/g, '/');

// Parse BREAK_HERE marker to 1-based line number
function findBreakLine(filePath: string): number {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  const idx = lines.findIndex(l => l.includes('// BREAK_HERE'));
  if (idx === -1) throw new Error(`BREAK_HERE not found in ${filePath}`);
  return idx + 1; // 1-based
}

describe('E2E JS - simple script (breakpoint + step)', () => {
  const logsDir = path.join(process.cwd(), 'logs');
  const sessionId = `e2e-js-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const program = path.resolve(process.cwd(), 'tests/fixtures/javascript-e2e/simple.js');

  let proxyManager: import('../../../src/proxy/proxy-manager.js').IProxyManager | null = null;
  let restoreEnv: Record<string, string | undefined> = {};

  beforeAll(async () => {
    // Snapshot a couple of env vars in case they are modified by adapterCommand
    restoreEnv.NODE_OPTIONS = process.env.NODE_OPTIONS;
    restoreEnv.PATH = process.env.PATH;

    fs.mkdirSync(logsDir, { recursive: true });

    // Build production deps (real implementations)
    const deps = createProductionDependencies({
      logLevel: 'info',
      logFile: path.join(logsDir, `e2e-js-${Date.now()}.log`)
    });

    // Registry: register adapter and create instance
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

    // Verify adapter command points to vendored js-debug with TCP mode
    const adapterCommand = adapter.buildAdapterCommand(adapterConfig);
    expect(norm(adapterCommand.args[0])).toMatch(/\/vendor\/js-debug\/vsDebugServer\.cjs$/);
    expect(adapterCommand.args[1]).toMatch(/^\d+$/); // Should be a port number
    expect(Number(adapterCommand.args[1])).toBe(adapterPort); // Should match our allocated port
    expect(typeof adapterCommand.command).toBe('string');

    // Transform launch config for the script
    const launchCfg = adapter.transformLaunchConfig({
      program,
      cwd: path.dirname(program),
      stopOnEntry: false,
      args: []
    } as unknown as any);

    // Create proxy manager via factory
    const pmFactory = deps.proxyManagerFactory;
    proxyManager = pmFactory.create(adapter);

    // TODO: switch to DebugLanguage.JAVASCRIPT once added to enum (using MOCK placeholder for now)
    await proxyManager.start({
      sessionId,
      language: DebugLanguage.MOCK,
      executablePath: process.execPath,
      adapterHost: 'localhost',
      adapterPort, // Use the allocated port
      logDir: logsDir,
      scriptPath: program,
      scriptArgs: [],
      stopOnEntry: false,
      justMyCode: true,
      dryRunSpawn: false,
      adapterCommand
    } as any);

    // DAP handshake
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
      // restore env
      if (restoreEnv.NODE_OPTIONS !== undefined) process.env.NODE_OPTIONS = restoreEnv.NODE_OPTIONS;
      if (restoreEnv.PATH !== undefined) process.env.PATH = restoreEnv.PATH;
    }
  });

  test('hits breakpoint, can evaluate, step, and continue to termination', async () => {
    // Wait for first stopped
    const [threadId/*, reason, body*/] = await waitForEvent<[number, string, unknown]>(
      proxyManager as any,
      'stopped',
      45000
    );
    expect(typeof threadId).toBe('number');
    expect((proxyManager as any).getCurrentThreadId()).toBe(threadId);

    // stackTrace -> top frame
    const st: any = await (proxyManager as any).sendDapRequest('stackTrace', { threadId });
    const top = st?.body?.stackFrames?.[0];
    expect(top?.id).toBeDefined();

    // evaluate simple expression
    const ev: any = await (proxyManager as any).sendDapRequest('evaluate', {
      expression: '1+1',
      frameId: top.id
    });
    // js-debug returns strings for values
    expect(String(ev?.body?.result ?? '')).toBe('2');

    // single step
    await (proxyManager as any).sendDapRequest('next', { threadId });

    // Should stop again or terminate very quickly; try to observe another stop, else continue to end
    let stoppedAgain = false;
    try {
      await waitForEvent<[number, string, unknown]>(proxyManager as any, 'stopped', 15000);
      stoppedAgain = true;
    } catch {
      stoppedAgain = false;
    }

    if (stoppedAgain) {
      await (proxyManager as any).sendDapRequest('continue', { threadId });
    } else {
      // If we didn't see an immediate second stop, still continue
      await (proxyManager as any).sendDapRequest('continue', { threadId });
    }

    // Wait for exit or terminated
    await Promise.race([
      waitForEvent(proxyManager as any, 'terminated', 30000),
      waitForEvent(proxyManager as any, 'exited', 30000)
    ]);
  });
});
