/**
 * The DAP client side of the shim tests: what mcp-debugger's proxy would be.
 * Records every message in arrival order so ordering assertions are possible.
 */
import net from 'node:net';
import type { DebugProtocol } from '@vscode/debugprotocol';
import { DapFrameDecoder, encodeDapMessage } from '@debugmcp/shared';

export class TestClient {
  readonly received: DebugProtocol.ProtocolMessage[] = [];
  /** Events not yet consumed by `nextEvent`. */
  private readonly backlog: DebugProtocol.Event[] = [];
  private readonly eventWaiters: Array<{ name: string; resolve: (event: DebugProtocol.Event) => void }> = [];
  private readonly pending = new Map<number, (response: DebugProtocol.Response) => void>();
  private readonly decoder = new DapFrameDecoder();
  private seq = 0;
  /** Answers reverse requests from the engine; the returned value is the response body. */
  onReverseRequest: (request: DebugProtocol.Request) => unknown = () => ({});

  private constructor(private readonly socket: net.Socket) {
    socket.on('data', (chunk: Buffer) => {
      for (const message of this.decoder.push(chunk)) {
        this.dispatch(message);
      }
    });
    socket.on('error', () => undefined);
  }

  static connect(port: number): Promise<TestClient> {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection({ port, host: '127.0.0.1' }, () => resolve(new TestClient(socket)));
      socket.once('error', reject);
    });
  }

  get closed(): boolean {
    return this.socket.destroyed;
  }

  request(command: string, args?: unknown, timeoutMs = 5000): Promise<DebugProtocol.Response> {
    return new Promise((resolve, reject) => {
      const seq = ++this.seq;
      const timer = setTimeout(() => {
        this.pending.delete(seq);
        reject(new Error(`no response to '${command}' (seq ${seq}) within ${timeoutMs} ms`));
      }, timeoutMs);
      this.pending.set(seq, (response) => {
        clearTimeout(timer);
        resolve(response);
      });
      this.sendRaw({ seq, type: 'request', command, arguments: args } as DebugProtocol.Request);
    });
  }

  /** Send a request and do not wait for its response (the response still lands in `received`). */
  fire(command: string, args?: unknown): number {
    const seq = ++this.seq;
    this.sendRaw({ seq, type: 'request', command, arguments: args } as DebugProtocol.Request);
    return seq;
  }

  sendRaw(message: DebugProtocol.ProtocolMessage): void {
    this.socket.write(encodeDapMessage(message));
  }

  /** The next event named `name`: a backlogged one first, else the next to arrive. */
  nextEvent(name: string, timeoutMs = 5000): Promise<DebugProtocol.Event> {
    const index = this.backlog.findIndex((e) => e.event === name);
    if (index >= 0) {
      const [event] = this.backlog.splice(index, 1);
      return Promise.resolve(event);
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`no '${name}' event within ${timeoutMs} ms`)), timeoutMs);
      this.eventWaiters.push({
        name,
        resolve: (event) => {
          clearTimeout(timer);
          resolve(event);
        }
      });
    });
  }

  events(name?: string): DebugProtocol.Event[] {
    return this.received
      .filter((m): m is DebugProtocol.Event => m.type === 'event')
      .filter((e) => name === undefined || e.event === name);
  }

  responses(command?: string): DebugProtocol.Response[] {
    return this.received
      .filter((m): m is DebugProtocol.Response => m.type === 'response')
      .filter((r) => command === undefined || r.command === command);
  }

  close(): Promise<void> {
    return new Promise((resolve) => {
      if (this.socket.destroyed) {
        resolve();
        return;
      }
      this.socket.once('close', () => resolve());
      this.socket.destroy();
    });
  }

  private dispatch(message: DebugProtocol.ProtocolMessage): void {
    this.received.push(message);
    if (message.type === 'response') {
      const response = message as DebugProtocol.Response;
      const resolve = this.pending.get(response.request_seq);
      this.pending.delete(response.request_seq);
      resolve?.(response);
      return;
    }
    if (message.type === 'event') {
      const event = message as DebugProtocol.Event;
      const waiterIndex = this.eventWaiters.findIndex((w) => w.name === event.event);
      if (waiterIndex >= 0) {
        const [waiter] = this.eventWaiters.splice(waiterIndex, 1);
        waiter.resolve(event);
      } else {
        this.backlog.push(event);
      }
      return;
    }
    if (message.type === 'request') {
      const request = message as DebugProtocol.Request;
      Promise.resolve(this.onReverseRequest(request)).then((body) => {
        this.sendRaw({
          seq: ++this.seq,
          type: 'response',
          request_seq: request.seq,
          success: true,
          command: request.command,
          body
        } as DebugProtocol.Response);
      }).catch(() => undefined);
    }
  }
}
