import fs from 'fs';
import net from 'net';
import os from 'os';
import path from 'path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { DebugLanguage, type ILogger } from '@debugmcp/shared';
import { FileSystemImpl } from '../../../src/implementations/file-system-impl.js';
import { ProcessManagerImpl } from '../../../src/implementations/process-manager-impl.js';
import { ProxyProcessLauncherImpl } from '../../../src/implementations/process-launcher-impl.js';
import { ProxyManager } from '../../../src/proxy/proxy-manager.js';
import type { ProxyConfig } from '../../../src/proxy/proxy-config.js';

interface ScenarioRule {
  delayMs?: number;
  dropResponse?: boolean;
  eventsBeforeResponse?: Array<{ event: string; body?: Record<string, unknown> }>;
  eventsAfterResponse?: Array<{ event: string; body?: Record<string, unknown> }>;
  junkPrefix?: string | number[];
  duplicateResponse?: boolean;
  close?: 'before-response' | 'mid-response' | 'after-response';
  closeAfterBytes?: number;
}

interface Scenario {
  neverListen?: boolean;
  commands?: Record<string, ScenarioRule>;
}

const fixturePath = path.resolve('tests/fixtures/adversarial-adapter/server.mjs');
const managers = new Set<ProxyManager>();
const logger: ILogger = {
  info: () => {},
  error: () => {},
  debug: () => {},
  warn: () => {}
};

let tempDir: string;
let sessionSequence = 0;

async function reservePort(): Promise<number> {
  const server = net.createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    server.close();
    throw new Error('Failed to reserve a TCP port for the adversarial adapter');
  }
  await new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  });
  return address.port;
}

async function createManager(
  scenario: Scenario,
  initializationTimeoutMs = 6000
): Promise<{ manager: ProxyManager; config: ProxyConfig }> {
  const port = await reservePort();
  const sessionId = `adversarial-dap-${process.pid}-${++sessionSequence}`;
  const scenarioPath = path.join(tempDir, `${sessionId}.json`);
  const logDir = path.join(tempDir, `${sessionId}-logs`);
  fs.writeFileSync(scenarioPath, JSON.stringify(scenario));
  fs.mkdirSync(logDir, { recursive: true });

  const manager = new ProxyManager(
    null,
    new ProxyProcessLauncherImpl(new ProcessManagerImpl()),
    new FileSystemImpl(),
    logger,
    undefined,
    { initializationTimeoutMs }
  );
  managers.add(manager);

  return {
    manager,
    config: {
      sessionId,
      language: DebugLanguage.RUBY,
      executablePath: process.execPath,
      adapterHost: '127.0.0.1',
      adapterPort: port,
      logDir,
      scriptPath: path.join(tempDir, 'target.rb'),
      stopOnEntry: false,
      justMyCode: true,
      launchConfig: {
        type: 'rdbg',
        request: 'launch',
        script: path.join(tempDir, 'target.rb'),
        stopOnEntry: false
      },
      adapterCommand: {
        command: process.execPath,
        args: [fixturePath, '--port', String(port), '--scenario', scenarioPath]
      }
    }
  };
}

async function captureError(promise: Promise<unknown>): Promise<Error & { initProgress?: unknown }> {
  try {
    await promise;
  } catch (error) {
    return error as Error & { initProgress?: unknown };
  }
  throw new Error('Expected operation to reject');
}

describe.sequential('adversarial TCP DAP adapter', () => {
  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-adversarial-dap-'));
    fs.writeFileSync(path.join(tempDir, 'target.rb'), 'puts "fixture"\n');
  });

  afterEach(async () => {
    await Promise.allSettled([...managers].map(manager => manager.stop()));
    managers.clear();
  });

  afterAll(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('recovers when initialized arrives but the initialize response is dropped', async () => {
    const { manager, config } = await createManager({
      commands: {
        initialize: {
          dropResponse: true,
          eventsBeforeResponse: [{ event: 'initialized' }]
        }
      }
    });

    await expect(manager.start(config)).resolves.toBeUndefined();
    expect(manager.isRunning()).toBe(true);
  });

  it('reports the launch stage when initialize recovers but launch never responds', async () => {
    const { manager, config } = await createManager({
      commands: {
        initialize: {
          dropResponse: true,
          eventsBeforeResponse: [{ event: 'initialized' }]
        },
        launch: { dropResponse: true }
      }
    }, 4500);

    const error = await captureError(manager.start(config));

    expect(error.message).toContain('within 4.5s');
    expect(error.message).toContain('the "launch" request never received a response');
    expect(error.message).toMatch(/adapter process is running \(PID \d+\)/);
    expect(error.initProgress).toMatchObject({
      transportConnected: true,
      pendingCommand: 'launch'
    });
  });

  it('resynchronizes after junk and tolerates delayed events and a duplicate response', async () => {
    const { manager, config } = await createManager({
      commands: {
        initialize: {
          delayMs: 25,
          eventsBeforeResponse: [{ event: 'output', body: { category: 'console', output: 'before\n' } }],
          junkPrefix: 'DEBUGGER: unexpected preamble\r\n\r\n',
          duplicateResponse: true,
          eventsAfterResponse: [
            { event: 'initialized' },
            { event: 'output', body: { category: 'console', output: 'after\n' } }
          ]
        }
      }
    });
    const output: string[] = [];
    manager.on('output', body => output.push(body.output ?? ''));

    await expect(manager.start(config)).resolves.toBeUndefined();
    expect(output.join('')).toContain('before\n');
    expect(output.join('')).toContain('after\n');
  });

  it('fails promptly when the adapter closes in the middle of launch response framing', async () => {
    const { manager, config } = await createManager({
      commands: {
        initialize: { eventsAfterResponse: [{ event: 'initialized' }] },
        launch: { close: 'mid-response', closeAfterBytes: 18 }
      }
    }, 5000);

    const startedAt = Date.now();
    const error = await captureError(manager.start(config));

    expect(Date.now() - startedAt).toBeLessThan(5000);
    expect(error.message).toMatch(/closed|disconnect|exited|terminated|proxy/i);
  });

  it('distinguishes an adapter process that spawned but never listened', async () => {
    const { manager, config } = await createManager({ neverListen: true }, 1800);

    const error = await captureError(manager.start(config));

    expect(error.message).toContain('within 1.8s');
    expect(error.message).toMatch(/adapter process spawned \(PID \d+\)/);
    expect(error.message).toContain('DAP connection was never established');
    expect(error.initProgress).toMatchObject({ transportConnected: false });
  });
});
