/**
 * The #729 regression, driven end to end through the real process wrapper.
 *
 * proxy-manager.start.test.ts substitutes a hand-written IProxyProcess, so it
 * cannot see the bug at all: the ordering that broke dry runs is produced by
 * ProxyProcessAdapter, between the raw child and the manager. Here the manager
 * gets a real ProxyProcessLauncherImpl over a fake IProcessManager, and the
 * fake child replays exactly what Node does — the raw `exit` first, the
 * `dry_run_complete` the child had already written still queued behind it,
 * then the channel EOF.
 *
 * Before the fix the adapter tore its message forwarder down on that raw exit,
 * the acknowledgement was dropped, and start() rejected with "Proxy exited
 * during initialization. Code: 0".
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import { PassThrough } from 'stream';
import { ProxyManager } from '../../../src/proxy/proxy-manager.js';
import { ProxyProcessLauncherImpl } from '../../../src/implementations/process-launcher-impl.js';
import type { ProxyConfig } from '../../../src/proxy/proxy-config.js';
import {
  DebugLanguage,
  type IChildProcess,
  type IFileSystem,
  type ILogger,
  type IProcessManager
} from '@debugmcp/shared';

class FakeChildProcess extends EventEmitter implements IChildProcess {
  pid = 5150;
  killed = false;
  connected = true;
  stdin: NodeJS.WritableStream | null = null;
  stdout: NodeJS.ReadableStream | null = null;
  stderr: NodeJS.ReadableStream | null = new PassThrough();

  kill = vi.fn().mockReturnValue(true);
  send = vi.fn().mockReturnValue(true);
}

describe('ProxyManager dry run whose exit beats its acknowledgement (issue #729)', () => {
  let child: FakeChildProcess;
  let logger: ILogger;
  let proxyManager: ProxyManager;

  const config: ProxyConfig = {
    sessionId: 'session-729',
    language: DebugLanguage.JAVASCRIPT,
    executablePath: 'node',
    adapterHost: '127.0.0.1',
    adapterPort: 9229,
    logDir: './.tmp/logs',
    scriptPath: './tests/fixtures/app.js',
    dryRunSpawn: true
  };

  beforeEach(() => {
    child = new FakeChildProcess();

    // Node's real ordering on a dry run: the worker acks, writes
    // dry_run_complete and exits; the process handle closes before the last
    // IPC bytes are drained, so `exit` is dispatched with the message still
    // in the pipe and the channel still connected.
    child.send.mockImplementation((command: unknown) => {
      if ((command as { cmd?: string }).cmd !== 'init') return true;
      setImmediate(() => {
        child.emit('message', { type: 'status', status: 'init_received', sessionId: config.sessionId });
        // A turn later, as a real worker's boot takes: the process handle
        // closes with the last IPC bytes still in the pipe, so Node dispatches
        // `exit` BEFORE the dry_run_complete the child had already written,
        // and only then reports channel EOF.
        setImmediate(() => {
          child.emit('exit', 0, null);
          child.emit('message', {
            type: 'status',
            status: 'dry_run_complete',
            sessionId: config.sessionId,
            command: 'node --inspect-brk ./tests/fixtures/app.js',
            script: config.scriptPath
          });
          child.connected = false;
          child.emit('disconnect');
        });
      });
      return true;
    });

    const processManager = {
      spawn: vi.fn().mockReturnValue(child),
      exec: vi.fn()
    } as unknown as IProcessManager;

    const fileSystem = {
      pathExists: vi.fn().mockResolvedValue(true)
    } as unknown as IFileSystem;

    logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    } as unknown as ILogger;

    proxyManager = new ProxyManager(
      null,
      new ProxyProcessLauncherImpl(processManager, process.platform, () => {}),
      fileSystem,
      logger
    );
  });

  afterEach(async () => {
    child.removeAllListeners();
    (child.stderr as unknown as PassThrough | null)?.removeAllListeners();
    proxyManager.removeAllListeners();
    await new Promise((resolve) => setImmediate(resolve));
  });

  it('completes the dry run instead of reporting a death before initialization', async () => {
    await expect(proxyManager.start(config)).resolves.toBeUndefined();

    expect(proxyManager.hasDryRunCompleted()).toBe(true);
    expect(logger.error).not.toHaveBeenCalledWith(
      expect.stringContaining('exited before initialization'),
      expect.anything()
    );
  });
});
