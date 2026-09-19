/**
 * DAP client to CodeLLDB, the engine behind the shim.
 *
 * Two kinds of requests travel on this socket: the client's, forwarded with a
 * fresh engine-side `seq` so they can never collide with the shim's own, and
 * the shim's (address evaluation, memory reads, the step loop's `next`s). A
 * `pending` map keyed by engine seq remembers which is which; a forwarded
 * response has its `request_seq` restored to the client's seq before it is
 * surfaced, a shim response settles its promise.
 *
 * Shim requests carry a timeout because a stuck engine must degrade one value
 * to `<unavailable: timeout>` — never stall the client's request behind it.
 * The client's own requests are never timed out here: their timing is the
 * client's business.
 */
import type { Socket } from 'node:net';
import type { DebugProtocol } from '@vscode/debugprotocol';
import { DapFrameDecoder, encodeDapMessage } from '@debugmcp/shared';
import type { ShimLogger } from './logger.js';

export const DEFAULT_ENGINE_TIMEOUT_MS = 5000;

export class EngineTimeoutError extends Error {
  constructor(command: string, timeoutMs: number) {
    super(`engine did not answer '${command}' within ${timeoutMs} ms`);
    this.name = 'EngineTimeoutError';
  }
}

export class EngineClosedError extends Error {
  constructor(command: string) {
    super(`engine connection closed before '${command}' was answered`);
    this.name = 'EngineClosedError';
  }
}

export type EngineInbound<TMeta> =
  | { kind: 'response'; response: DebugProtocol.Response; meta: TMeta }
  | { kind: 'event'; event: DebugProtocol.Event }
  | { kind: 'request'; request: DebugProtocol.Request };

export interface EngineClientHandlers<TMeta> {
  onMessage(message: EngineInbound<TMeta>): void;
  onClose(): void;
}

/** The narrow surface the handlers need: one request, one response. */
export interface EngineRequester {
  request(command: string, args?: unknown, timeoutMs?: number): Promise<DebugProtocol.Response>;
}

type Pending<TMeta> =
  | { kind: 'client'; clientSeq: number; command: string; meta: TMeta }
  | {
      kind: 'shim';
      command: string;
      resolve: (response: DebugProtocol.Response) => void;
      reject: (error: Error) => void;
      timer: NodeJS.Timeout;
    };

export class EngineClient<TMeta = unknown> implements EngineRequester {
  private readonly decoder: DapFrameDecoder;
  private readonly pending = new Map<number, Pending<TMeta>>();
  private seq = 0;
  private closed = false;

  constructor(
    private readonly socket: Socket,
    private readonly logger: ShimLogger,
    private readonly handlers: EngineClientHandlers<TMeta>,
    private readonly defaultTimeoutMs = DEFAULT_ENGINE_TIMEOUT_MS
  ) {
    this.decoder = new DapFrameDecoder({
      onError: (error, context) => this.logger.warn(`engine frame decode error (${context})`, error)
    });
    socket.on('data', (chunk: Buffer) => this.onData(chunk));
    socket.on('error', (error) => this.logger.warn('engine socket error', error));
    socket.on('close', () => this.onSocketClosed());
  }

  get isClosed(): boolean {
    return this.closed;
  }

  /** A shim-originated request; resolves with the engine's response (success or not), rejects on timeout/close. */
  request(command: string, args?: unknown, timeoutMs = this.defaultTimeoutMs): Promise<DebugProtocol.Response> {
    return new Promise((resolve, reject) => {
      if (this.closed) {
        reject(new EngineClosedError(command));
        return;
      }
      const seq = ++this.seq;
      const timer = setTimeout(() => {
        if (this.pending.delete(seq)) {
          this.logger.warn(`engine request timed out: ${command} (seq ${seq})`);
          reject(new EngineTimeoutError(command, timeoutMs));
        }
      }, timeoutMs);
      this.pending.set(seq, { kind: 'shim', command, resolve, reject, timer });
      const request: DebugProtocol.Request = { seq, type: 'request', command, arguments: args };
      this.write(request);
    });
  }

  /** Forward a client request under a fresh engine seq; `meta` comes back with the response. False when the engine is gone. */
  forward(request: DebugProtocol.Request, meta: TMeta): boolean {
    if (this.closed) {
      this.logger.warn(`dropping client request '${request.command}': engine connection closed`);
      return false;
    }
    const seq = ++this.seq;
    this.pending.set(seq, { kind: 'client', clientSeq: request.seq, command: request.command, meta });
    this.write({ ...request, seq });
    return true;
  }

  /** The client's answer to a reverse request; `request_seq` must already be the engine's seq. */
  sendResponse(response: DebugProtocol.Response): void {
    if (this.closed) {
      return;
    }
    this.write({ ...response, seq: ++this.seq });
  }

  close(): void {
    if (!this.closed) {
      this.socket.destroy();
    }
  }

  private write(message: DebugProtocol.ProtocolMessage): void {
    this.socket.write(encodeDapMessage(message));
  }

  private onData(chunk: Buffer): void {
    for (const message of this.decoder.push(chunk)) {
      this.dispatch(message);
    }
  }

  private dispatch(message: DebugProtocol.ProtocolMessage): void {
    switch (message.type) {
      case 'response':
        this.onResponse(message as DebugProtocol.Response);
        return;
      case 'event':
        this.handlers.onMessage({ kind: 'event', event: message as DebugProtocol.Event });
        return;
      case 'request':
        this.handlers.onMessage({ kind: 'request', request: message as DebugProtocol.Request });
        return;
      default:
        this.logger.warn('engine sent a message of unknown type', message);
    }
  }

  private onResponse(response: DebugProtocol.Response): void {
    const pending = this.pending.get(response.request_seq);
    if (!pending) {
      // A shim request that already timed out, or something the engine made up.
      this.logger.debug(`engine response without a pending request: ${response.command} (request_seq ${response.request_seq})`);
      return;
    }
    this.pending.delete(response.request_seq);
    if (pending.kind === 'shim') {
      clearTimeout(pending.timer);
      pending.resolve(response);
      return;
    }
    this.handlers.onMessage({
      kind: 'response',
      response: { ...response, request_seq: pending.clientSeq },
      meta: pending.meta
    });
  }

  private onSocketClosed(): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    for (const [seq, pending] of this.pending) {
      if (pending.kind === 'shim') {
        clearTimeout(pending.timer);
        pending.reject(new EngineClosedError(pending.command));
      } else {
        this.logger.warn(`client request '${pending.command}' (client seq ${pending.clientSeq}) lost: engine closed`);
      }
      this.pending.delete(seq);
    }
    this.handlers.onClose();
  }
}
