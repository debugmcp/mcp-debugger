/**
 * The worker-facing side of the shim: the one socket mcp-debugger's proxy
 * connects to. Decodes its frames, and writes everything that goes back to it
 * through an ordered output queue.
 *
 * Why a queue: some engine messages are forwarded verbatim the moment they
 * arrive, others are held while the shim rewrites them (a `stackTrace`
 * response waits for annotation, a `variables` reply for memory reads). Every
 * engine message therefore takes a slot on arrival and the writer drains slots
 * strictly in that order, so a `stopped` that arrives while an older reply is
 * still being transformed can never reach the client before it.
 *
 * The shim owns the `seq` of everything it writes to the client (restamped at
 * write time) — the engine's sequence numbers and the shim's own would collide
 * otherwise. Reverse requests (`runInTerminal`, `startDebugging`) record the
 * mapping shim-seq → engine-seq at write time so the client's response can be
 * routed back to the engine under the seq the engine used.
 */
import type { Socket } from 'node:net';
import type { DebugProtocol } from '@vscode/debugprotocol';
import { DapFrameDecoder, encodeDapMessage } from '@debugmcp/shared';
import type { ShimLogger } from './logger.js';

export interface OutputSlot {
  /** Emit `message` in this slot's position; `null` drops the slot (the message is swallowed). */
  resolve(message: DebugProtocol.ProtocolMessage | null): void;
}

export type ClientInbound =
  | { kind: 'request'; request: DebugProtocol.Request }
  | { kind: 'response'; response: DebugProtocol.Response; engineSeq: number | undefined }
  | { kind: 'event'; event: DebugProtocol.Event };

export interface ClientConnectionHandlers {
  onMessage(message: ClientInbound): void;
  onClose(): void;
}

interface QueueEntry {
  settled: boolean;
  message: DebugProtocol.ProtocolMessage | null;
}

export class ClientConnection {
  private readonly decoder: DapFrameDecoder;
  private readonly queue: QueueEntry[] = [];
  /** shim-seq of a reverse request written to the client → the engine's own seq for it. */
  private readonly reverseSeqs = new Map<number, number>();
  private outSeq = 0;
  private closed = false;

  constructor(
    private readonly socket: Socket,
    private readonly logger: ShimLogger,
    private readonly handlers: ClientConnectionHandlers
  ) {
    this.decoder = new DapFrameDecoder({
      onError: (error, context) => this.logger.warn(`client frame decode error (${context})`, error)
    });
    socket.on('data', (chunk: Buffer) => this.onData(chunk));
    socket.on('error', (error) => this.logger.warn('client socket error', error));
    socket.on('close', () => {
      this.closed = true;
      this.handlers.onClose();
    });
  }

  get isClosed(): boolean {
    return this.closed;
  }

  /** Reserve the next output position; resolve it when the message (or nothing) is ready. */
  reserve(): OutputSlot {
    const entry: QueueEntry = { settled: false, message: null };
    this.queue.push(entry);
    return {
      resolve: (message) => {
        if (entry.settled) {
          return;
        }
        entry.settled = true;
        entry.message = message;
        this.drain();
      }
    };
  }

  /** Reserve and resolve in one step: the message goes out behind everything already queued. */
  send(message: DebugProtocol.ProtocolMessage): void {
    this.reserve().resolve(message);
  }

  end(): void {
    if (!this.closed) {
      this.socket.end();
    }
  }

  destroy(): void {
    if (!this.closed) {
      this.socket.destroy();
    }
  }

  private drain(): void {
    while (this.queue.length > 0 && this.queue[0].settled) {
      const entry = this.queue.shift();
      if (entry?.message) {
        this.write(entry.message);
      }
    }
  }

  private write(message: DebugProtocol.ProtocolMessage): void {
    if (this.closed) {
      return;
    }
    const engineSeq = message.seq;
    message.seq = ++this.outSeq;
    if (message.type === 'request') {
      this.reverseSeqs.set(message.seq, engineSeq);
    }
    this.socket.write(encodeDapMessage(message));
  }

  private onData(chunk: Buffer): void {
    for (const message of this.decoder.push(chunk)) {
      this.dispatch(message);
    }
  }

  private dispatch(message: DebugProtocol.ProtocolMessage): void {
    switch (message.type) {
      case 'request':
        this.handlers.onMessage({ kind: 'request', request: message as DebugProtocol.Request });
        return;
      case 'response': {
        const response = message as DebugProtocol.Response;
        const engineSeq = this.reverseSeqs.get(response.request_seq);
        this.reverseSeqs.delete(response.request_seq);
        this.handlers.onMessage({ kind: 'response', response, engineSeq });
        return;
      }
      case 'event':
        this.handlers.onMessage({ kind: 'event', event: message as DebugProtocol.Event });
        return;
      default:
        this.logger.warn('client sent a message of unknown type', message);
    }
  }
}
