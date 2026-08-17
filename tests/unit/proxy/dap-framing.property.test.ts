/**
 * Property-based tests (fast-check) for the shared DAP wire codec
 * (DapFrameDecoder / encodeDapMessage), plus explicit cases for the two
 * malformed-input recovery paths. The decoder is the extracted body of
 * MinimalDapClient.handleData; these properties pin its behavior directly,
 * independent of the client that hosts it.
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { DapFrameDecoder, encodeDapMessage } from '../../../src/proxy/dap-framing.js';
import type { DebugProtocol } from '@vscode/debugprotocol';

const ALNUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

interface DapEventMessage {
  seq: number;
  type: 'event';
  event: string;
  body: unknown;
}

/** Cut a buffer into contiguous chunks at arbitrary byte positions (mod length). */
function chunkBuffer(buffer: Buffer, cuts: number[]): Buffer[] {
  const points = [...new Set(cuts.map(c => c % (buffer.length + 1)))].sort((a, b) => a - b);
  const chunks: Buffer[] = [];
  let previous = 0;
  for (const point of points) {
    chunks.push(buffer.subarray(previous, point));
    previous = point;
  }
  chunks.push(buffer.subarray(previous));
  return chunks;
}

// 'grapheme' strings include multi-byte UTF-8, so byte-level cuts can land
// mid-character. Content-Length counts bytes (not characters), so the framing
// parser must handle splits at arbitrary byte positions, including mid-codepoint.
const leaf = fc.oneof(
  fc.string({ unit: 'grapheme', maxLength: 15 }),
  fc.integer(),
  fc.boolean(),
  fc.constant(null)
);

const body = fc.dictionary(
  fc.string({ unit: fc.constantFrom(...ALNUM.split('')), minLength: 1, maxLength: 8 }),
  fc.oneof(leaf, fc.array(leaf, { maxLength: 4 })),
  { maxKeys: 5 }
);

const eventName = fc.constantFrom('output', 'stopped', 'continued', 'loadedSource', 'custom-event');

const messagesArb = fc
  .array(fc.tuple(eventName, body), { minLength: 1, maxLength: 8 })
  .map(list =>
    list.map(([event, eventBody], index): DapEventMessage => ({
      seq: index + 1,
      type: 'event',
      event,
      body: eventBody
    }))
  );

describe('DapFrameDecoder properties', () => {
  it('reassembles any chunking of encoded DAP traffic into the original message sequence', () => {
    fc.assert(
      fc.property(
        messagesArb,
        fc.array(fc.nat(1_000_000), { maxLength: 25 }),
        (messages, cuts) => {
          const decoder = new DapFrameDecoder();
          const received: DebugProtocol.ProtocolMessage[] = [];

          const stream = Buffer.concat(
            messages.map(m => encodeDapMessage(m as unknown as DebugProtocol.ProtocolMessage))
          );
          for (const chunk of chunkBuffer(stream, cuts)) {
            received.push(...decoder.push(chunk));
          }

          // JSON-normalize the expectation: the decoder necessarily returns
          // what survives a JSON round-trip (e.g. -0 becomes 0).
          const expected = messages.map(m => JSON.parse(JSON.stringify(m)));
          expect(received).toEqual(expected);
        }
      )
    );
  });

  it('delivers identical results for any two chunkings of the same stream', () => {
    fc.assert(
      fc.property(
        messagesArb,
        fc.array(fc.nat(1_000_000), { maxLength: 25 }),
        fc.array(fc.nat(1_000_000), { maxLength: 25 }),
        (messages, cutsA, cutsB) => {
          const stream = Buffer.concat(
            messages.map(m => encodeDapMessage(m as unknown as DebugProtocol.ProtocolMessage))
          );

          const run = (cuts: number[]): string => {
            const decoder = new DapFrameDecoder();
            const received: DebugProtocol.ProtocolMessage[] = [];
            for (const chunk of chunkBuffer(stream, cuts)) {
              received.push(...decoder.push(chunk));
            }
            return JSON.stringify(received);
          };

          expect(run(cutsA)).toBe(run(cutsB));
        }
      )
    );
  });
});

describe('DapFrameDecoder malformed-input recovery', () => {
  const frame = (msg: object): Buffer =>
    encodeDapMessage(msg as unknown as DebugProtocol.ProtocolMessage);

  it('discards the buffered payload on an invalid Content-Length header and reports it', () => {
    const errors: Array<{ message: string; context: string }> = [];
    const decoder = new DapFrameDecoder({
      onError: (err, context) => errors.push({ message: err.message, context })
    });

    const bad = Buffer.from('Content-Length: nonsense\r\n\r\n{"type":"event"}', 'utf8');
    expect(decoder.push(bad)).toEqual([]);
    expect(errors).toEqual([
      expect.objectContaining({ context: 'header' })
    ]);

    // The decoder recovers: a fresh, valid frame afterwards decodes normally.
    const msg = { seq: 1, type: 'event', event: 'output', body: { text: 'hi' } };
    expect(decoder.push(frame(msg))).toEqual([msg]);
  });

  it('skips a frame whose body is not valid JSON and continues with the next frame', () => {
    const errors: string[] = [];
    const decoder = new DapFrameDecoder({
      onError: (_err, context) => errors.push(context)
    });

    const badBody = 'not json at all';
    const badFrame = Buffer.from(
      `Content-Length: ${Buffer.byteLength(badBody, 'utf8')}\r\n\r\n${badBody}`,
      'utf8'
    );
    const msg = { seq: 2, type: 'event', event: 'stopped', body: {} };

    const received = decoder.push(Buffer.concat([badFrame, frame(msg)]));
    expect(received).toEqual([msg]);
    expect(errors).toEqual(['json']);
  });

  it('reset() drops any partial frame in progress', () => {
    const decoder = new DapFrameDecoder();
    const msg = { seq: 3, type: 'event', event: 'continued', body: {} };
    const encoded = frame(msg);

    // Push only half a frame, then reset — the partial data must not corrupt
    // the next, complete frame.
    expect(decoder.push(encoded.subarray(0, Math.floor(encoded.length / 2)))).toEqual([]);
    decoder.reset();
    expect(decoder.push(encoded)).toEqual([msg]);
  });
});
