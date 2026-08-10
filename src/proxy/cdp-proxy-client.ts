/**
 * Minimal CDP-over-WebSocket JSON client for js-debug's requestCDPProxy
 * facility (issue #295).
 *
 * The proxy speaks `{id, method, params}` requests answered by
 * `{id, result | error}`; frames without an id are CDP events. The transport
 * is injectable for tests; the default wraps the Node >=22 global WebSocket.
 */
import { EventEmitter } from 'events';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('cdp-proxy-client');

export interface CdpTransport {
  send(data: string): void;
  close(): void;
  on(event: 'open' | 'message' | 'close' | 'error', listener: (...args: unknown[]) => void): unknown;
}

export interface CdpProxyClientOptions {
  transportFactory?: (url: string) => CdpTransport;
  connectTimeoutMs?: number;
  callTimeoutMs?: number;
}

/** Structural type for the Node >=22 global WebSocket (tsconfig has no DOM lib). */
interface GlobalWebSocket {
  send(data: string): void;
  close(): void;
  onopen: (() => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onclose: (() => void) | null;
  onerror: ((ev: { message?: string }) => void) | null;
}

function defaultTransportFactory(url: string): CdpTransport {
  const WebSocketCtor = (globalThis as { WebSocket?: new (url: string) => GlobalWebSocket }).WebSocket;
  if (!WebSocketCtor) {
    throw new Error('global WebSocket is unavailable (Node >= 22 required)');
  }
  const ws = new WebSocketCtor(url);
  const emitter = new EventEmitter();
  ws.onopen = () => emitter.emit('open');
  ws.onmessage = (ev) => emitter.emit('message', typeof ev.data === 'string' ? ev.data : String(ev.data));
  ws.onclose = () => emitter.emit('close');
  ws.onerror = (ev) => emitter.emit('error', new Error(ev?.message ?? 'WebSocket error'));
  return {
    send: (data) => ws.send(data),
    close: () => {
      try {
        ws.close();
      } catch {
        // already closed
      }
    },
    on: (event, listener) => emitter.on(event, listener)
  };
}

interface PendingCall {
  method: string;
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
}

export class CdpProxyClient extends EventEmitter {
  private readonly transportFactory: (url: string) => CdpTransport;
  private readonly connectTimeoutMs: number;
  private readonly callTimeoutMs: number;
  private transport: CdpTransport | null = null;
  private connected = false;
  private disposed = false;
  private nextId = 0;
  private readonly pending = new Map<number, PendingCall>();

  constructor(options?: CdpProxyClientOptions) {
    super();
    this.transportFactory = options?.transportFactory ?? defaultTransportFactory;
    this.connectTimeoutMs = options?.connectTimeoutMs ?? 5000;
    this.callTimeoutMs = options?.callTimeoutMs ?? 5000;
  }

  async connect(host: string, port: number, path: string): Promise<void> {
    const wsPath = path.startsWith('/') ? path : `/${path}`;
    const url = `ws://${host}:${port}${wsPath}`;
    const transport = this.transportFactory(url);
    this.transport = transport;

    transport.on('message', (data) => this.onMessage(String(data)));
    transport.on('close', () => this.onClosed());
    transport.on('error', (err) => this.onClosed(err instanceof Error ? err : new Error(String(err))));

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`CDP proxy connect timeout after ${this.connectTimeoutMs}ms (${url})`)),
        this.connectTimeoutMs
      );
      transport.on('open', () => {
        clearTimeout(timer);
        this.connected = true;
        resolve();
      });
      const failOnce = (why: string) => {
        if (!this.connected) {
          clearTimeout(timer);
          reject(new Error(`CDP proxy connection failed: ${why}`));
        }
      };
      transport.on('error', (err) => failOnce(err instanceof Error ? err.message : String(err)));
      transport.on('close', () => failOnce('closed before open'));
    });
    logger.info(`[CdpProxyClient] connected to ${url}`);
  }

  send<T = unknown>(method: string, params?: object, timeoutMs?: number): Promise<T> {
    if (!this.connected || !this.transport) {
      return Promise.reject(new Error(`CDP proxy not connected (sending ${method})`));
    }
    const id = ++this.nextId;
    const effectiveTimeout = timeoutMs ?? this.callTimeoutMs;
    const promise = new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP call timeout after ${effectiveTimeout}ms: ${method}`));
      }, effectiveTimeout);
      this.pending.set(id, {
        method,
        resolve: resolve as (value: unknown) => void,
        reject,
        timer
      });
    });
    this.transport.send(JSON.stringify({ id, method, params: params ?? {} }));
    return promise;
  }

  isConnected(): boolean {
    return this.connected;
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    const transport = this.transport;
    this.onClosed();
    transport?.close();
  }

  private onMessage(data: string): void {
    let msg: { id?: number; method?: string; params?: unknown; result?: unknown; error?: { message?: string; code?: number } };
    try {
      msg = JSON.parse(data);
    } catch {
      logger.warn(`[CdpProxyClient] dropping unparseable frame (${data.length} bytes)`);
      return;
    }
    if (typeof msg.id === 'number') {
      const call = this.pending.get(msg.id);
      if (!call) {
        // late response for a timed-out call — drop silently
        return;
      }
      this.pending.delete(msg.id);
      clearTimeout(call.timer);
      if (msg.error) {
        call.reject(new Error(`${call.method}: ${msg.error.message ?? JSON.stringify(msg.error)}`));
      } else {
        call.resolve(msg.result);
      }
    } else if (typeof msg.method === 'string') {
      this.emit('cdp-event', msg.method, msg.params);
    }
  }

  private onClosed(err?: Error): void {
    const wasConnected = this.connected;
    this.connected = false;
    this.transport = null;
    const reason = err ? `CDP proxy connection error: ${err.message}` : 'CDP proxy connection closed';
    for (const [id, call] of this.pending) {
      this.pending.delete(id);
      clearTimeout(call.timer);
      call.reject(new Error(`${reason} (pending ${call.method})`));
    }
    if (wasConnected) {
      this.emit('closed');
    }
  }
}
