import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import type { IProxyProcessLauncher } from '@debugmcp/shared';
import type { IFileSystem } from '@debugmcp/shared';
import type { ILogger } from '@debugmcp/shared';
import { ProxyManager } from '../../../src/proxy/proxy-manager.js';

describe('ProxyManager sendInitWithRetry', () => {
  const launcherStub: IProxyProcessLauncher = {
    launchProxy: vi.fn(),
  };
  const fsStub: IFileSystem = {
    ensureDir: vi.fn(),
    ensureDirSync: vi.fn(),
    pathExists: vi.fn(),
    exists: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    readdir: vi.fn(),
    stat: vi.fn(),
    unlink: vi.fn(),
    rmdir: vi.fn(),
    remove: vi.fn(),
    copy: vi.fn(),
    outputFile: vi.fn(),
    existsSync: vi.fn(),
  };
  const loggerStub: ILogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };

  let manager: ProxyManager;

  beforeEach(() => {
    manager = new ProxyManager(null, launcherStub, fsStub, loggerStub);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('resolves when init acknowledgement arrives within the first window', async () => {
    vi.useFakeTimers();
    const sendCommandMock = vi
      .spyOn(manager as unknown as { sendCommand: (command: object) => void }, 'sendCommand')
      .mockImplementation(() => {
        setTimeout(() => (manager as unknown as EventEmitter).emit('init-received'), 160);
      });

    const initPromise = (manager as unknown as { sendInitWithRetry: (command: object) => Promise<void> }).sendInitWithRetry(
      { cmd: 'init' }
    );

    vi.advanceTimersByTime(160);
    await initPromise;

    expect(sendCommandMock).toHaveBeenCalledTimes(1);
  });

  it('retries when acknowledgement arrives after the first timeout', async () => {
    vi.useFakeTimers();
    let attempt = 0;
    const sendCommandMock = vi
      .spyOn(manager as unknown as { sendCommand: (command: object) => void }, 'sendCommand')
      .mockImplementation(() => {
        attempt += 1;
        const delay = attempt === 1 ? 600 : 100;
        setTimeout(() => (manager as unknown as EventEmitter).emit('init-received'), delay);
      });

    const initPromise = (manager as unknown as { sendInitWithRetry: (command: object) => Promise<void> }).sendInitWithRetry(
      { cmd: 'init' }
    );

    vi.advanceTimersByTime(600); // first ack (lost) + first timeout (500)
    await Promise.resolve();
    vi.advanceTimersByTime(500); // backoff before retry
    await Promise.resolve();
    vi.advanceTimersByTime(100); // second attempt acknowledges
    await Promise.resolve();
    await initPromise;
    expect(sendCommandMock).toHaveBeenCalledTimes(2);
  });

  it('throws after exhausting retries when acknowledgement never arrives', async () => {
    vi.useFakeTimers();
    const sendCommandMock = vi
      .spyOn(manager as unknown as { sendCommand: (command: object) => void }, 'sendCommand')
      .mockImplementation(() => {});

    (manager as unknown as { lastExitDetails: unknown }).lastExitDetails = {
      code: 0,
      signal: null,
      timestamp: Date.now(),
      capturedStderr: ['timeout'],
    };

    const initPromise = (manager as unknown as { sendInitWithRetry: (command: object) => Promise<void> }).sendInitWithRetry(
      { cmd: 'init' }
    );

    const ackTimeouts = [500, 1000, 2000, 4000, 8000, 8000] as const;
    for (let i = 0; i < ackTimeouts.length; i++) {
      vi.advanceTimersByTime(ackTimeouts[i]);
      await Promise.resolve();
      if (i < ackTimeouts.length - 1) {
        vi.advanceTimersByTime(ackTimeouts[i]);
        await Promise.resolve();
      }
    }

    await expect(initPromise).rejects.toThrow('Failed to initialize proxy');
    expect(sendCommandMock).toHaveBeenCalledTimes(6);
  });
});
