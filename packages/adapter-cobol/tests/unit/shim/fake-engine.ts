/**
 * An in-process stand-in for CodeLLDB: a DAP server on a TCP port with a
 * scripted handler per command, events the test emits on demand, and reverse
 * requests it can send. Nothing here knows about COBOL.
 */
import net from 'node:net';
import type { DebugProtocol } from '@vscode/debugprotocol';
import { DapFrameDecoder, encodeDapMessage } from '@debugmcp/shared';

export class EngineError {
  constructor(readonly message: string) {}
}

export function engineError(message: string): EngineError {
  return new EngineError(message);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EngineHandler = (args: any, request: DebugProtocol.Request) => unknown;

export class FakeEngine {
  readonly requests: DebugProtocol.Request[] = [];
  private readonly handlers = new Map<string, EngineHandler>();
  private readonly decoder = new DapFrameDecoder();
  private readonly pendingReverse = new Map<number, (response: DebugProtocol.Response) => void>();
  private readonly requestWaiters: Array<{ command: string; resolve: (request: DebugProtocol.Request) => void }> = [];
  private readonly connectWaiters: Array<() => void> = [];
  private server?: net.Server;
  private socket?: net.Socket;
  private seq = 0;
  /** Pauses inbound processing (tests that need a request to sit unanswered). */
  private queueResponses = false;
  private readonly parked: Array<() => void> = [];

  on(command: string, handler: EngineHandler): this {
    this.handlers.set(command, handler);
    return this;
  }

  handler(command: string): EngineHandler | undefined {
    return this.handlers.get(command);
  }

  get connected(): boolean {
    return this.socket !== undefined && !this.socket.destroyed;
  }

  listen(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const server = net.createServer((socket) => this.accept(socket));
      server.once('error', reject);
      server.listen(port, '127.0.0.1', () => resolve());
      this.server = server;
    });
  }

  waitForConnection(): Promise<void> {
    if (this.connected) {
      return Promise.resolve();
    }
    return new Promise((resolve) => this.connectWaiters.push(resolve));
  }

  /** The next request with this command (future ones only). */
  waitForRequest(command: string, timeoutMs = 5000): Promise<DebugProtocol.Request> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`no '${command}' request within ${timeoutMs} ms`)), timeoutMs);
      this.requestWaiters.push({
        command,
        resolve: (request) => {
          clearTimeout(timer);
          resolve(request);
        }
      });
    });
  }

  received(command: string): DebugProtocol.Request[] {
    return this.requests.filter((r) => r.command === command);
  }

  emit(event: string, body?: unknown): void {
    this.write({ seq: 0, type: 'event', event, body } as DebugProtocol.Event);
  }

  sendRequest(command: string, args?: unknown): Promise<DebugProtocol.Response> {
    return new Promise((resolve) => {
      const seq = this.seq + 1;
      this.pendingReverse.set(seq, resolve);
      this.write({ seq: 0, type: 'request', command, arguments: args } as DebugProtocol.Request);
    });
  }

  /** Hold every inbound request unanswered until `release()`. */
  hold(): void {
    this.queueResponses = true;
  }

  release(): void {
    this.queueResponses = false;
    for (const run of this.parked.splice(0)) {
      run();
    }
  }

  /** Go away the way a real engine does on exit: flush what was written, then close. */
  close(): void {
    const socket = this.socket;
    this.socket = undefined;
    if (socket && !socket.destroyed) {
      socket.end();
      setTimeout(() => socket.destroy(), 50).unref();
    }
    this.server?.close();
    this.server = undefined;
  }

  private accept(socket: net.Socket): void {
    if (this.socket) {
      socket.destroy();
      return;
    }
    this.socket = socket;
    socket.on('data', (chunk: Buffer) => {
      for (const message of this.decoder.push(chunk)) {
        this.dispatch(message);
      }
    });
    socket.on('error', () => undefined);
    for (const resolve of this.connectWaiters.splice(0)) {
      resolve();
    }
  }

  private dispatch(message: DebugProtocol.ProtocolMessage): void {
    if (message.type === 'response') {
      const response = message as DebugProtocol.Response;
      const resolve = this.pendingReverse.get(response.request_seq);
      this.pendingReverse.delete(response.request_seq);
      resolve?.(response);
      return;
    }
    if (message.type !== 'request') {
      return;
    }
    const request = message as DebugProtocol.Request;
    this.requests.push(request);
    const waiterIndex = this.requestWaiters.findIndex((w) => w.command === request.command);
    if (waiterIndex >= 0) {
      const [waiter] = this.requestWaiters.splice(waiterIndex, 1);
      waiter.resolve(request);
    }
    const run = (): void => {
      void this.answer(request);
    };
    if (this.queueResponses) {
      this.parked.push(run);
    } else {
      run();
    }
  }

  private async answer(request: DebugProtocol.Request): Promise<void> {
    const handler = this.handlers.get(request.command);
    let body: unknown = {};
    try {
      body = handler ? await handler(request.arguments, request) : {};
    } catch (error) {
      body = engineError(error instanceof Error ? error.message : String(error));
    }
    if (body instanceof EngineError) {
      this.write({
        seq: 0,
        type: 'response',
        request_seq: request.seq,
        success: false,
        command: request.command,
        message: body.message,
        body: { error: { id: 1, format: body.message } }
      } as DebugProtocol.Response);
      return;
    }
    this.write({ seq: 0, type: 'response', request_seq: request.seq, success: true, command: request.command, body } as DebugProtocol.Response);
  }

  private write(message: DebugProtocol.ProtocolMessage): void {
    if (!this.socket || this.socket.destroyed) {
      return;
    }
    message.seq = ++this.seq;
    this.socket.write(encodeDapMessage(message));
  }
}

export interface MemorySymbol {
  address: bigint;
  bytes: Uint8Array;
}

const ADDRESS_EXPRESSION = /^\/nat \(unsigned long long\)\((&?)([A-Za-z_][A-Za-z0-9_]*)(?:\s*\+\s*(\d+))?\)(?:\s*\+\s*(\d+))?$/;

/**
 * Answer the shim's address evaluations and memory reads from a symbol table:
 * `/nat (unsigned long long)(b_24 + 24)` → `address(b_24) + 24` as a decimal string,
 * `readMemory` → base64 of the bytes at that address (short when the range runs out).
 * Other `evaluate` expressions go to `fallback`.
 */
export function installMemory(engine: FakeEngine, symbols: Record<string, MemorySymbol>, fallback?: EngineHandler): void {
  engine.on('evaluate', (args: { expression: string; frameId?: number; context?: string }, request) => {
    const match = ADDRESS_EXPRESSION.exec(args.expression);
    if (!match) {
      return fallback ? fallback(args, request) : engineError(`fake engine cannot evaluate '${args.expression}'`);
    }
    const symbol = symbols[match[2]];
    if (!symbol) {
      return engineError(`use of undeclared identifier '${match[2]}'`);
    }
    const offset = BigInt(match[3] ?? match[4] ?? '0');
    const address = symbol.address === 0n ? 0n : symbol.address + offset;
    return { result: address.toString(10), type: 'unsigned long long', variablesReference: 0 };
  });
  engine.on('readMemory', (args: { memoryReference: string; count: number; offset?: number }) => {
    const wanted = BigInt(args.memoryReference) + BigInt(args.offset ?? 0);
    for (const symbol of Object.values(symbols)) {
      const end = symbol.address + BigInt(symbol.bytes.length);
      if (symbol.address !== 0n && wanted >= symbol.address && wanted < end) {
        const start = Number(wanted - symbol.address);
        const slice = symbol.bytes.subarray(start, Math.min(symbol.bytes.length, start + args.count));
        return {
          address: args.memoryReference,
          data: Buffer.from(slice).toString('base64'),
          unreadableBytes: args.count - slice.length
        };
      }
    }
    return engineError(`memory read failed for ${args.memoryReference}`);
  });
}

export function ascii(text: string): Uint8Array {
  return Uint8Array.from(Buffer.from(text, 'latin1'));
}
