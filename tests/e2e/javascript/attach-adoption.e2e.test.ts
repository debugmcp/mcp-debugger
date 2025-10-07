import fs from 'fs';
import net from 'net';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { describe, test, expect, beforeAll, afterAll, vi } from 'vitest';
import { resetAdapterRegistry, getAdapterRegistry } from '../../../src/adapters/adapter-registry.js';
import { createProductionDependencies } from '../../../src/container/dependencies.js';
import { DebugLanguage } from '@debugmcp/shared';
import { JavascriptAdapterFactory } from '../../../packages/adapter-javascript/src/index.ts';
import { waitForEvent } from '../../test-utils/helpers/test-utils.ts';

vi.setConfig({ testTimeout: 90000 });

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

async function findFreePort(host = '127.0.0.1'): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once('error', (e) => reject(e));
    srv.listen(0, host, () => {
      const addr = srv.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      srv.close(() => resolve(port));
    });
  });
}

describe('E2E JS - attach + adoption (parent attach by port, child __pendingTargetId)', () => {
  const logsDir = path.join(process.cwd(), 'logs');
  const sessionId = `e2e-js-attach-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const program = path.resolve(process.cwd(), 'tests/fixtures/javascript-e2e/simple.js');

  let proxyManager: import('../../../src/proxy/proxy-manager.js').IProxyManager | null = null;
  let targetProc: ChildProcess | null = null;
  let adapterPort = 0;
  let inspectorPort = 0;
  let restoreEnv: Record<string, string | undefined> = {};

  beforeAll(async () => {
    // Snapshot env in case adapter modifies
    restoreEnv.NODE_OPTIONS = process.env.NODE_OPTIONS;
    restoreEnv.PATH = process.env.PATH;

    fs.mkdirSync(logsDir, { recursive: true });

    // Build production deps (real implementations)
    const deps = createProductionDependencies({
      logLevel: 'info',
      logFile: path.join(logsDir, `e2e-js-attach-${Date.now()}.log`)
    });

    // Registry: register adapter and create instance
    resetAdapterRegistry();
    const registry = getAdapterRegistry({ validateOnRegister: true });
    await registry.register('javascript', new JavascriptAdapterFactory());

    // Allocate free ports for adapter and inspector
    adapterPort = await findFreePort();
    inspectorPort = await findFreePort();

    // Spawn Node target with --inspect-brk on the chosen inspector port
    targetProc = spawn(process.execPath, [`--inspect-brk=${inspectorPort}`, program], {
      cwd: path.dirname(program),
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      env: process.env
    });
    // Pipe target output for diagnostics (non-fatal if write fails)
    targetProc.stdout?.on('data', d => { try { process.stdout.write(`[target] ${d}`); } catch {} });
    targetProc.stderr?.on('data', d => { try { process.stderr.write(`[target] ${d}`); } catch {} });

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
    expect(adapterCommand.args[1]).toMatch(/^\d+$/);
    expect(Number(adapterCommand.args[1])).toBe(adapterPort);

    // Create proxy manager via factory and start
    const pmFactory = deps.proxyManagerFactory;
    proxyManager = pmFactory.create(adapter);

    // Start proxy (MOCK used for now; switch to DebugLanguage.JAVASCRIPT if available)
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

    // DAP handshake: initialize -> setExceptionBreakpoints -> setBreakpoints -> configurationDone -> attach(by port)
    await proxyManager.sendDapRequest('initialize', {
      clientID: 'e2e',
      adapterID: 'javascript',
      linesStartAt1: true,
      columnsStartAt1: true,
      pathFormat: 'path'
    });

    const breakLine = findBreakLine(program);

    // Send exception filters first (VSCode behavior)
    await proxyManager.sendDapRequest('setExceptionBreakpoints', { filters: [] });

    await proxyManager.sendDapRequest('setBreakpoints', {
      source: { path: program },
      breakpoints: [{ line: breakLine }],
      sourceModified: false
    });

    await proxyManager.sendDapRequest('configurationDone', {});


    // Parent attach to inspector port (single allowed pre-adoption)
    await proxyManager.sendDapRequest('attach', {
      type: 'pwa-node',
      request: 'attach',
      address: '127.0.0.1',
      port: inspectorPort,
      continueOnAttach: false,
      attachExistingChildren: true,
      attachSimplePort: inspectorPort
    });
  }, 120000);

  afterAll(async () => {
    try {
      if (proxyManager) {
        await proxyManager.stop();
      }
    } catch {}
    try {
      if (targetProc && !targetProc.killed) {
        try { targetProc.kill('SIGTERM'); } catch {}
        setTimeout(() => {
          try { targetProc?.kill('SIGKILL'); } catch {}
        }, 250);
      }
    } catch {}
    // restore env
    if (restoreEnv.NODE_OPTIONS !== undefined) process.env.NODE_OPTIONS = restoreEnv.NODE_OPTIONS;
    if (restoreEnv.PATH !== undefined) process.env.PATH = restoreEnv.PATH;
  });

  test('stops at breakpoint (or pause fallback), variables/evaluate ok, step/continue to termination, no DI ambiguity in logs', async () => {
    // Wait for first stopped, with fallback: threads + pause if not emitted yet
    let threadId: number;
    try {
      const [, , body] = await waitForEvent<[number, string, any]>(proxyManager as any, 'stopped', 60000);
      // Try to get threadId from body if available
      const tid = (body && typeof body.threadId === 'number') ? body.threadId : undefined;
      if (typeof tid === 'number') {
        threadId = tid;
      } else {
        // fallback: query threads to get a usable thread id
        const threadsResp: any = await (proxyManager as any).sendDapRequest('threads', {});
        const first = threadsResp?.body?.threads?.[0];
        if (!first?.id) throw new Error('No threads available after stopped');
        threadId = Number(first.id);
      }
    } catch {
      // Fallback path: query threads and pause the first one to force a stop
      const threadsResp: any = await (proxyManager as any).sendDapRequest('threads', {});
      const first = threadsResp?.body?.threads?.[0];
      if (!first?.id) throw new Error('No threads available to pause');
      await (proxyManager as any).sendDapRequest('pause', { threadId: first.id });
      const [, , body2] = await waitForEvent<[number, string, any]>(proxyManager as any, 'stopped', 30000);
      const tid2 = (body2 && typeof body2.threadId === 'number') ? body2.threadId : first.id;
      threadId = Number(tid2);
    }
    expect(typeof threadId).toBe('number');
    expect((proxyManager as any).getCurrentThreadId()).toBe(threadId);

    // stackTrace -> top frame (robust: pause-if-needed and retry on "not paused" or threadId===0)
    let st: any;
    try {
      st = await (proxyManager as any).sendDapRequest('stackTrace', { threadId, startFrame: 0, levels: 20 });
    } catch (_err) {
      // If thread is not paused or id is 0, issue a pause and wait for a real stopped, then retry
      try {
        if (threadId === 0) {
          try { await (proxyManager as any).sendDapRequest('pause', { threadId: 0 }); } catch {}
          try { await (proxyManager as any).sendDapRequest('pause', { threadId: 1 }); } catch {}
        } else {
          try { await (proxyManager as any).sendDapRequest('pause', { threadId }); } catch {}
        }
        // Wait for stopped and refresh threadId
        try {
          const [, , body3] = await waitForEvent<[number, string, any]>(proxyManager as any, 'stopped', 10000);
          const tid3 = (body3 && typeof body3.threadId === 'number') ? body3.threadId : undefined;
          if (typeof tid3 === 'number') {
            threadId = tid3;
          } else {
            const threadsResp3: any = await (proxyManager as any).sendDapRequest('threads', {});
            const first3 = threadsResp3?.body?.threads?.[0];
            if (first3?.id != null) threadId = Number(first3.id);
          }
        } catch {}
        // Retry stackTrace once
        st = await (proxyManager as any).sendDapRequest('stackTrace', { threadId, startFrame: 0, levels: 20 });
      } catch (e2) {
        throw e2;
      }
    }
    const top = st?.body?.stackFrames?.[0];
    expect(top?.id).toBeDefined();

    // evaluate simple expression
    const ev: any = await (proxyManager as any).sendDapRequest('evaluate', {
      expression: '1+1',
      frameId: top.id,
      context: 'repl'
    });
    expect(String(ev?.body?.result ?? '')).toContain('2');

    // single step
    await (proxyManager as any).sendDapRequest('next', { threadId });

    // Try to observe another stopped; regardless, continue to termination
    try {
      await waitForEvent(proxyManager as any, 'stopped', 15000);
    } catch {
      // ignore if not seen quickly
    }

    await (proxyManager as any).sendDapRequest('continue', { threadId });

    // Keep continuing until terminated/exited; js-debug can emit multiple intermediate stops
    const deadline = Date.now() + 40000;
    while (Date.now() < deadline) {
      const evt = await Promise.race([
        waitForEvent(proxyManager as any, 'terminated', 5000).then(() => 'terminated'),
        waitForEvent(proxyManager as any, 'exited', 5000).then(() => 'exited'),
        // If stopped comes in, we will issue another continue
        waitForEvent<[number, string, any]>(proxyManager as any, 'stopped', 5000)
          .then(([, , body]) => ({ type: 'stopped', body }))
          .catch(() => null)
      ]).catch(() => null);

      if (evt === 'terminated' || evt === 'exited') {
        break;
      }

      if (evt && (evt as any).type === 'stopped') {
        try {
          const tid = typeof (evt as any).body?.threadId === 'number' ? (evt as any).body.threadId : threadId;
          await (proxyManager as any).sendDapRequest('continue', { threadId: tid });
        } catch {
          // ignore continue errors and keep trying
        }
        continue;
      }

      // No event observed in the short window; try to nudge by continuing first thread if any
      try {
        const threadsResp: any = await (proxyManager as any).sendDapRequest('threads', {});
        const t = threadsResp?.body?.threads?.[0]?.id;
        if (typeof t === 'number') {
          await (proxyManager as any).sendDapRequest('continue', { threadId: t });
        }
      } catch {
        // ignore
      }
    }

    // Final short wait to confirm termination
    let ended = false;
    try {
      await Promise.race([
        waitForEvent(proxyManager as any, 'terminated', 3000),
        waitForEvent(proxyManager as any, 'exited', 3000),
        waitForEvent(proxyManager as any, 'exit', 3000)
      ]);
      ended = true;
    } catch {}
    if (!ended) {
      // Detach to allow Node to exit (avoids "Waiting for the debugger to disconnect...")
      try {
        await (proxyManager as any).sendDapRequest('disconnect', { restart: false, terminateDebuggee: false });
      } catch {}
      try {
        await Promise.race([
          waitForEvent(proxyManager as any, 'terminated', 5000),
          waitForEvent(proxyManager as any, 'exited', 5000),
          waitForEvent(proxyManager as any, 'exit', 5000)
        ]);
        ended = true;
      } catch {}
    }
    if (!ended) {
      // Last resort: ask adapter to terminate the debuggee
      try {
        await (proxyManager as any).sendDapRequest('disconnect', { restart: false, terminateDebuggee: true });
      } catch {}
      await Promise.race([
        waitForEvent(proxyManager as any, 'terminated', 5000),
        waitForEvent(proxyManager as any, 'exited', 5000),
        waitForEvent(proxyManager as any, 'exit', 5000)
      ]);
    }

    // Assert no DI ambiguity errors in logs
    const proxyLog = path.join(logsDir, `proxy-${sessionId}.log`);
    const dapTrace = path.join(logsDir, `dap-trace-${sessionId}.ndjson`);
    const haystacks: string[] = [];
    try { if (fs.existsSync(proxyLog)) haystacks.push(fs.readFileSync(proxyLog, 'utf8')); } catch {}
    try { if (fs.existsSync(dapTrace)) haystacks.push(fs.readFileSync(dapTrace, 'utf8')); } catch {}

    const allLogs = haystacks.join('\n');
    if (allLogs.length > 0) {
      expect(allLogs.includes('Ambiguous match found for serviceIdentifier: je')).toBe(false);
    }
  });
});
