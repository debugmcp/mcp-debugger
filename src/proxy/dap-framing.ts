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

export type DapFrameDecoderErrorContext = 'header' | 'json';

export interface DapFrameDecoderOptions {
  /**
   * Invoked on malformed input. 'header' means an invalid/absent
   * Content-Length header was seen and the buffered payload was discarded;
   * 'json' means a complete frame failed to parse and was skipped.
   */
  onError?: (error: Error, context: DapFrameDecoderErrorContext) => void;
}

/**
 * Incremental Content-Length frame decoder. Feed it raw socket chunks via
 * push(); it returns every complete protocol message contained so far and
 * buffers any trailing partial frame for the next call.
 */
export class DapFrameDecoder {
  private rawData = Buffer.alloc(0);
  private contentLength = -1;
  private readonly onError?: DapFrameDecoderOptions['onError'];

  constructor(options?: DapFrameDecoderOptions) {
    this.onError = options?.onError;
  }

  push(data: Buffer): DebugProtocol.ProtocolMessage[] {
    this.rawData = Buffer.concat([this.rawData, data]);
    const messages: DebugProtocol.ProtocolMessage[] = [];

    while (true) {
      if (this.contentLength >= 0) {
        // We have a content length, check if we have the full message
        if (this.rawData.length >= this.contentLength) {
          const message = this.rawData.toString('utf8', 0, this.contentLength);
          this.rawData = this.rawData.slice(this.contentLength);
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
      }

      // Look for the header
      const idx = this.rawData.indexOf(TWO_CRLF);
      if (idx === -1) {
        // No complete header yet
        break;
      }

      const header = this.rawData.toString('utf8', 0, idx);
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

      // Remove header from buffer
      this.rawData = this.rawData.slice(idx + TWO_CRLF.length);

      if (parsedLength === null || parsedLength <= 0 || !Number.isFinite(parsedLength)) {
        this.onError?.(
          new Error('Invalid Content-Length header encountered; discarding payload'),
          'header'
        );
        this.contentLength = -1;
        this.rawData = Buffer.alloc(0);
        continue;
      }

      this.contentLength = parsedLength;
    }

    return messages;
  }

  reset(): void {
    this.rawData = Buffer.alloc(0);
    this.contentLength = -1;
  }
}
