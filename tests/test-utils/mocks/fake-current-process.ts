/**
 * Fake of the CURRENT process handle (ProcessLike) for unit tests — issue #183.
 *
 * EventEmitter-backed, so production code's proc.on(...) attaches listeners to
 * THIS object, never to the real global process: tests drive lifecycle events
 * with fakeProc.emit(...) and nothing can leak into the vitest fork worker
 * (issue #159). Not to be confused with FakeProcess in
 * tests/implementations/test/fake-process-launcher.ts, which models a spawned
 * CHILD process (IProcess).
 */
import { EventEmitter } from 'events';
import { PassThrough } from 'stream';
import { vi, type Mock } from 'vitest';
import type { ProcessLike } from '../../../src/interfaces/process-interfaces.js';

export class FakeCurrentProcess extends EventEmitter implements ProcessLike {
  /** Recording exit mock — never terminates anything. Assert with expect(fakeProc.exit).toHaveBeenCalledWith(n). */
  public exit: Mock<(code?: number) => void> = vi.fn();

  /**
   * IPC send. Defaults to a recording mock returning true (IPC available).
   * Set to undefined (or call disableIPC()) to model "spawned without IPC".
   */
  public send?: Mock<(message: unknown) => boolean> = vi.fn(() => true);

  public connected = true;
  public env: NodeJS.ProcessEnv = {};
  public argv: string[] = ['/usr/bin/node', '/fake/dap-proxy-entry.js'];
  public uptime: Mock<() => number> = vi.fn(() => 0);

  public stdin = new PassThrough();
  public stdout = new PassThrough();

  /** Everything written to stdout, decoded as utf8, in write order. */
  public readonly stdoutChunks: string[] = [];

  constructor() {
    super();
    this.stdout.on('data', (chunk: Buffer) => this.stdoutChunks.push(chunk.toString('utf8')));
  }

  /** Fresh live IPC channel: new recording send mock, connected = true. */
  enableIPC(): this {
    this.send = vi.fn(() => true);
    this.connected = true;
    return this;
  }

  /** No IPC channel: send undefined, connected = false. */
  disableIPC(): this {
    this.send = undefined;
    this.connected = false;
    return this;
  }

  /** Broken IPC channel: send throws (e.g. ERR_IPC_CHANNEL_CLOSED). */
  failSendWith(error: Error): this {
    this.send = vi.fn(() => {
      throw error;
    });
    this.connected = false;
    return this;
  }

  /** Payloads passed to send() so far (empty when IPC is disabled). */
  get sentMessages(): unknown[] {
    return this.send ? this.send.mock.calls.map((c) => c[0]) : [];
  }

  /** Last listener registered for an event — for tests that must await an async handler. */
  lastListener(event: string): (...args: unknown[]) => unknown {
    const ls = this.listeners(event);
    if (ls.length === 0) {
      throw new Error(`No '${event}' listener registered on FakeCurrentProcess`);
    }
    return ls[ls.length - 1] as (...args: unknown[]) => unknown;
  }
}

export function createFakeCurrentProcess(): FakeCurrentProcess {
  return new FakeCurrentProcess();
}
