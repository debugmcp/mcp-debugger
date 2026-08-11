/**
 * Minimal scripted DAP client over a real TCP socket (issue #217).
 * Stands in for an IDE when testing the DAP mirror endpoint: request/response
 * correlation by seq, plus predicate waits for events. Uses the production
 * framing codec so the wire format is exercised end to end.
 */
import net from 'net';
import type { DebugProtocol } from '@vscode/debugprotocol';
import { DapFrameDecoder, encodeDapMessage } from '../../../src/proxy/dap-framing.js';

export class TcpDapClient {
  private socket!: net.Socket;
  private decoder = new DapFrameDecoder();
  private received: DebugProtocol.ProtocolMessage[] = [];
  /** Pending waits; a waiter returns true once settled and is then removed. */
  private waiters: Array<() => boolean> = [];
  private nextSeq = 1;
  private closed = false;

  connect(port: number, host = '127.0.0.1'): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = net.connect({ port, host }, resolve);
      this.socket.on('error', (err) => {
        if (!this.closed) reject(err);
      });
      this.socket.on('close', () => {
        this.closed = true;
        this.notifyWaiters();
      });
      this.socket.on('data', (data) => {
        this.received.push(...this.decoder.push(data));
        this.notifyWaiters();
      });
    });
  }

  /** Unsettled waiters stay registered for the next data/close event. */
  private notifyWaiters(): void {
    this.waiters = this.waiters.filter((waiter) => !waiter());
  }

  get isClosed(): boolean {
    return this.closed;
  }

  /** All frames received so far (decoded protocol messages). */
  get frames(): readonly DebugProtocol.ProtocolMessage[] {
    return this.received;
  }

  async request(command: string, args?: unknown, timeoutMs = 10_000): Promise<DebugProtocol.Response> {
    const seq = this.nextSeq++;
    this.socket.write(
      encodeDapMessage({
        seq,
        type: 'request',
        command,
        ...(args !== undefined ? { arguments: args } : {})
      } as DebugProtocol.Request)
    );
    return this.waitFor(
      (m): m is DebugProtocol.Response =>
        m.type === 'response' && (m as DebugProtocol.Response).request_seq === seq,
      timeoutMs,
      `response to '${command}' (seq ${seq})`
    );
  }

  waitForEvent(event: string, timeoutMs = 10_000): Promise<DebugProtocol.Event> {
    return this.waitFor(
      (m): m is DebugProtocol.Event => m.type === 'event' && (m as DebugProtocol.Event).event === event,
      timeoutMs,
      `event '${event}'`
    );
  }

  /** Resolves once the server closes the connection. */
  waitForClose(timeoutMs = 10_000): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.closed) {
        resolve();
        return;
      }
      const timer = setTimeout(() => reject(new Error('Timed out waiting for socket close')), timeoutMs);
      this.waiters.push(() => {
        if (this.closed) {
          clearTimeout(timer);
          resolve();
          return true;
        }
        return false;
      });
    });
  }

  private waitFor<T extends DebugProtocol.ProtocolMessage>(
    predicate: (m: DebugProtocol.ProtocolMessage) => m is T,
    timeoutMs: number,
    what: string
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const check = (): boolean => {
        const match = this.received.find(predicate);
        if (match) {
          clearTimeout(timer);
          resolve(match);
          return true;
        }
        if (this.closed) {
          clearTimeout(timer);
          reject(new Error(`Socket closed while waiting for ${what}`));
          return true;
        }
        return false;
      };
      const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${what}`)), timeoutMs);
      if (check()) return;
      this.waiters.push(check);
    });
  }

  close(): void {
    this.closed = true;
    this.socket?.destroy();
  }
}

/** True when a fresh TCP connection to the port is refused. */
export function isPortRefused(port: number, host = '127.0.0.1'): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host }, () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => resolve(true));
  });
}
