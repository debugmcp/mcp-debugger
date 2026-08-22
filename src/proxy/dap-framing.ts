/**
 * DAP wire-format codec: Content-Length framing shared by every place that
 * reads or writes raw Debug Adapter Protocol streams (MinimalDapClient on the
 * adapter side, DapMirrorServer on the IDE-facing side).
 *
 * The decode algorithm is the one vscode's ProtocolServer uses, extracted
 * verbatim from MinimalDapClient.handleData so the property-test guarantees
 * (arbitrary chunk splits, mid-UTF-8 boundaries) keep describing reality.
 */

import { DebugProtocol } from '@vscode/debugprotocol';

const TWO_CRLF = '\r\n\r\n';

/**
 * Encode a protocol message with Content-Length framing.
 */
export function encodeDapMessage(message: DebugProtocol.ProtocolMessage): Buffer {
  const json = JSON.stringify(message);
  return Buffer.from(`Content-Length: ${Buffer.byteLength(json, 'utf8')}${TWO_CRLF}${json}`, 'utf8');
}

export type DapFrameDecoderErrorContext = 'header' | 'json' | 'overflow';

/**
 * Default frame-body cap (issue #402). Generous — real DAP messages are KBs;
 * the largest legitimate payloads (huge variable dumps, base64 blobs) stay
 * far under this. Matches the repo's 64MB maxBuffer precedent. Override per
 * decoder via options.maxContentLength or globally via DAP_MAX_FRAME_BYTES.
 */
const DEFAULT_MAX_CONTENT_LENGTH = 64 * 1024 * 1024;

/** Headers are a handful of short lines; anything past this with no separator is garbage. */
const MAX_HEADER_BYTES = 16 * 1024;

export interface DapFrameDecoderOptions {
  /**
   * Invoked on malformed input. 'header' means an invalid/absent
   * Content-Length header was seen and the buffered payload was discarded;
   * 'json' means a complete frame failed to parse and was skipped;
   * 'overflow' means the peer advertised a frame above maxContentLength (or
   * streamed header bytes past the header allowance) and the buffer was
   * discarded — same recovery contract as 'header'.
   */
  onError?: (error: Error, context: DapFrameDecoderErrorContext) => void;
  /** Upper bound for a single frame body (issue #402); default 64 MB or DAP_MAX_FRAME_BYTES. */
  maxContentLength?: number;
}

function defaultMaxContentLength(): number {
  const env = Number(process.env.DAP_MAX_FRAME_BYTES);
  return Number.isFinite(env) && env > 0 ? env : DEFAULT_MAX_CONTENT_LENGTH;
}

/**
 * Incremental Content-Length frame decoder. Feed it raw socket chunks via
 * push(); it returns every complete protocol message contained so far and
 * buffers any trailing partial frame for the next call.
 *
 * Accumulation is linear (issue #402): header bytes live in a small bounded
 * buffer, body bytes in a chunk list concatenated once per completed frame —
 * never a per-chunk Buffer.concat of the whole backlog.
 */
export class DapFrameDecoder {
  /** Bytes in the header-search phase; bounded by MAX_HEADER_BYTES + one chunk. */
  private headerData: Buffer = Buffer.alloc(0);
  /** Body bytes of the frame in progress, concatenated once when complete. */
  private bodyChunks: Buffer[] = [];
  private bodyBytes = 0;
  private contentLength = -1;
  private readonly onError?: DapFrameDecoderOptions['onError'];
  private readonly maxContentLength: number;

  constructor(options?: DapFrameDecoderOptions) {
    this.onError = options?.onError;
    this.maxContentLength = options?.maxContentLength ?? defaultMaxContentLength();
  }

  push(data: Buffer): DebugProtocol.ProtocolMessage[] {
    const messages: DebugProtocol.ProtocolMessage[] = [];
    let input: Buffer | null = data;

    while (true) {
      if (this.contentLength >= 0) {
        // Body phase: collect chunks until the advertised length is buffered
        if (input && input.length > 0) {
          this.bodyChunks.push(input);
          this.bodyBytes += input.length;
        }
        input = null;
        if (this.bodyBytes < this.contentLength) {
          break;
        }
        const full = this.bodyChunks.length === 1
          ? this.bodyChunks[0]
          : Buffer.concat(this.bodyChunks, this.bodyBytes);
        const message = full.toString('utf8', 0, this.contentLength);
        // Bytes past the frame belong to the next header
        input = full.subarray(this.contentLength);
        this.bodyChunks = [];
        this.bodyBytes = 0;
        this.contentLength = -1;

        if (message.length > 0) {
          try {
            messages.push(JSON.parse(message) as DebugProtocol.ProtocolMessage);
          } catch (e) {
            this.onError?.(e instanceof Error ? e : new Error(String(e)), 'json');
          }
        }
        continue;
      }

      // Header phase
      if (input && input.length > 0) {
        this.headerData = this.headerData.length === 0 ? input : Buffer.concat([this.headerData, input]);
      }
      input = null;

      const idx = this.headerData.indexOf(TWO_CRLF);
      if (idx === -1) {
        if (this.headerData.length > MAX_HEADER_BYTES) {
          this.onError?.(
            new Error(`No header separator within ${MAX_HEADER_BYTES} bytes; discarding payload`),
            'overflow'
          );
          this.reset();
        }
        // No complete header yet
        break;
      }

      const header = this.headerData.toString('utf8', 0, idx);
      const lines = header.split('\r\n');
      let parsedLength: number | null = null;

      for (const line of lines) {
        if (line.toLowerCase().startsWith('content-length')) {
          const value = line.split(':')[1]?.trim();
          const candidate = Number.parseInt(value ?? '', 10);
          if (!Number.isNaN(candidate)) {
            parsedLength = candidate;
          }
          break;
        }
      }

      // Remove header from buffer; the remainder starts the body (or next header)
      const remainder = this.headerData.subarray(idx + TWO_CRLF.length);
      this.headerData = Buffer.alloc(0);

      if (parsedLength === null || parsedLength <= 0 || !Number.isFinite(parsedLength)) {
        this.onError?.(
          new Error('Invalid Content-Length header encountered; discarding payload'),
          'header'
        );
        this.reset();
        continue;
      }

      if (parsedLength > this.maxContentLength) {
        this.onError?.(
          new Error(`Content-Length ${parsedLength} exceeds cap ${this.maxContentLength}; discarding payload`),
          'overflow'
        );
        this.reset();
        continue;
      }

      this.contentLength = parsedLength;
      input = remainder;
    }

    return messages;
  }

  reset(): void {
    this.headerData = Buffer.alloc(0);
    this.bodyChunks = [];
    this.bodyBytes = 0;
    this.contentLength = -1;
  }
}
