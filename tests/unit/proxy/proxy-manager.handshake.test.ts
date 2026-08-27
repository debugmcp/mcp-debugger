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

  it('latches an acknowledgement that lands between attempt windows (issue #512)', async () => {
    vi.useFakeTimers();
    // The worker acks once, 600ms after the init send — after attempt 1's
    // 500ms window expired, during the backoff sleep. Pre-#512 this ack was
    // dropped (its listener had been removed) and the whole launch failed if
    // the worker then exited; now it resolves the retry loop without a resend.
    const sendCommandMock = vi
      .spyOn(manager as unknown as { sendCommand: (command: object) => void }, 'sendCommand')
      .mockImplementationOnce(() => {
        setTimeout(() => (manager as unknown as EventEmitter).emit('init-received'), 600);
      });

    const initPromise = (manager as unknown as { sendInitWithRetry: (command: object) => Promise<void> }).sendInitWithRetry(
      { cmd: 'init' }
    );

    vi.advanceTimersByTime(500); // attempt 1 window expires without the ack
    await Promise.resolve();
    vi.advanceTimersByTime(100); // ack fires during the backoff sleep
    await Promise.resolve();
    await initPromise;

    expect(sendCommandMock).toHaveBeenCalledTimes(1);
  });

  it('retries and resolves when only a later attempt is acknowledged', async () => {
    vi.useFakeTimers();
    let attempt = 0;
    const sendCommandMock = vi
      .spyOn(manager as unknown as { sendCommand: (command: object) => void }, 'sendCommand')
      .mockImplementation(() => {
        attempt += 1;
        if (attempt === 2) {
          setTimeout(() => (manager as unknown as EventEmitter).emit('init-received'), 100);
        }
        // attempt 1: message lost entirely — no ack ever fires for it
      });

    const initPromise = (manager as unknown as { sendInitWithRetry: (command: object) => Promise<void> }).sendInitWithRetry(
      { cmd: 'init' }
    );

    vi.advanceTimersByTime(500); // attempt 1 window expires
    await Promise.resolve();
    vi.advanceTimersByTime(500); // backoff before retry
    await Promise.resolve();
    vi.advanceTimersByTime(100); // attempt 2 acknowledges
    await Promise.resolve();
    await initPromise;
    expect(sendCommandMock).toHaveBeenCalledTimes(2);
  });

  it('fails fast once the worker has exited without acking (issue #512)', async () => {
    vi.useFakeTimers();
    let attempt = 0;
    const sendCommandMock = vi
      .spyOn(manager as unknown as { sendCommand: (command: object) => void }, 'sendCommand')
      .mockImplementation(() => {
        attempt += 1;
        if (attempt > 1) {
          // Worker exited between attempts; ProxyManager recorded the exit
          (manager as unknown as { lastExitDetails: unknown }).lastExitDetails = {
            code: 1,
            signal: null,
            timestamp: Date.now(),
            capturedStderr: ['boom'],
          };
          throw new Error('Proxy process not available');
        }
      });

    const initPromise = (manager as unknown as { sendInitWithRetry: (command: object) => Promise<void> }).sendInitWithRetry(
      { cmd: 'init' }
    );
    // The message reports the attempts actually made, flagged as a fast-fail
    // (issue #517), and still carries the exit details
    const rejection = expect(initPromise).rejects.toThrow(
      /after 2 attempts \(proxy exited; further retries skipped\)[\s\S]*Proxy exit details -> code=1/
    );

    vi.advanceTimersByTime(500); // attempt 1 window expires
    await Promise.resolve();
    vi.advanceTimersByTime(500); // backoff, then attempt 2's send throws
    await Promise.resolve();

    // No further windows/backoffs are burned: the loop breaks on the dead
    // worker instead of retrying four more times over ~15s
    await rejection;
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

    // Exhaustion reports the full count without the fast-fail suffix — every
    // one of the 6 attempts was really made (issue #517)
    await expect(initPromise).rejects.toThrow(/Failed to initialize proxy after 6 attempts\./);
    expect(sendCommandMock).toHaveBeenCalledTimes(6);
  });
});
