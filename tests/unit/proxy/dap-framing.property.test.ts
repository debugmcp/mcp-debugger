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

  it('recovers a well-formed frame that follows a junk block in the same chunk (issue #470)', () => {
    // The rdbg direct-socket path intermittently delivers a non-DAP block
    // ahead of the initialize response. A dropped *response* is
    // unrecoverable at the DAP layer, so the decoder must resync at the
    // next header instead of discarding the response with the junk.
    const errors: Array<{ message: string; context: string }> = [];
    const decoder = new DapFrameDecoder({
      onError: (err, context) => errors.push({ message: err.message, context })
    });

    const response = { seq: 2, type: 'response', command: 'initialize', request_seq: 1, success: true };
    const junk = Buffer.from('DEBUGGER: unexpected preamble\r\n\r\n', 'utf8');
    const received = decoder.push(Buffer.concat([junk, frame(response)]));

    expect(received).toEqual([JSON.parse(JSON.stringify(response))]);
    expect(errors).toEqual([expect.objectContaining({ context: 'header' })]);

    // Later frames decode normally.
    const event = { seq: 3, type: 'event', event: 'initialized' };
    expect(decoder.push(frame(event))).toEqual([event]);
  });

  it('resyncs when the frame after the junk block is itself split across pushes', () => {
    const errors: string[] = [];
    const decoder = new DapFrameDecoder({
      onError: (_err, context) => errors.push(context)
    });

    const response = { seq: 2, type: 'response', command: 'initialize', request_seq: 1, success: true };
    const encoded = frame(response);
    const junk = Buffer.from('garbage line\r\n\r\n', 'utf8');
    const firstPush = Buffer.concat([junk, encoded.subarray(0, encoded.length - 10)]);

    expect(decoder.push(firstPush)).toEqual([]);
    expect(decoder.push(encoded.subarray(encoded.length - 10))).toEqual([
      JSON.parse(JSON.stringify(response))
    ]);
    expect(errors).toEqual(['header']);
  });

  it('junk preamble delivered in a single push never costs the frames behind it', () => {
    fc.assert(
      fc.property(
        messagesArb,
        fc.string({ unit: fc.constantFrom(...ALNUM.split('')), minLength: 1, maxLength: 64 }),
        (messages, junkText) => {
          const decoder = new DapFrameDecoder({ onError: () => { /* expected */ } });
          const stream = Buffer.concat([
            Buffer.from(`${junkText}\r\n\r\n`, 'utf8'),
            ...messages.map(m => encodeDapMessage(m as unknown as DebugProtocol.ProtocolMessage))
          ]);
          const received = decoder.push(stream);
          expect(received).toEqual(messages.map(m => JSON.parse(JSON.stringify(m))));
        }
      )
    );
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

  it('rejects a Content-Length above the cap with an overflow error and recovers (issue #402)', () => {
    const errors: string[] = [];
    const decoder = new DapFrameDecoder({
      onError: (_err, context) => errors.push(context),
      maxContentLength: 1024
    });

    // A hostile/buggy peer advertises a frame the decoder must never buffer
    const evil = Buffer.from('Content-Length: 999999999\r\n\r\npartial body...', 'utf8');
    expect(decoder.push(evil)).toEqual([]);
    expect(errors).toEqual(['overflow']);

    // The overflow discarded the buffer; a fresh valid frame decodes normally
    const msg = { seq: 4, type: 'event', event: 'output', body: { text: 'ok' } };
    expect(decoder.push(frame(msg))).toEqual([msg]);
  });

  it('accepts a frame exactly at the cap boundary (issue #402)', () => {
    const bodyText = '{"type":"event"}';
    const decoder = new DapFrameDecoder({
      maxContentLength: Buffer.byteLength(bodyText, 'utf8')
    });

    const exact = Buffer.from(
      `Content-Length: ${Buffer.byteLength(bodyText, 'utf8')}\r\n\r\n${bodyText}`,
      'utf8'
    );
    expect(decoder.push(exact)).toEqual([{ type: 'event' }]);
  });

  it('bounds header-search accumulation when no header separator ever arrives (issue #402)', () => {
    const errors: string[] = [];
    const decoder = new DapFrameDecoder({
      onError: (_err, context) => errors.push(context)
    });

    // A garbage stream with no \r\n\r\n used to buffer without bound
    const garbage = Buffer.alloc(20 * 1024, 0x78); // 20 KB of 'x'
    expect(decoder.push(garbage)).toEqual([]);
    expect(errors).toEqual(['overflow']);

    // Recovery after the discard
    const msg = { seq: 5, type: 'event', event: 'output', body: {} };
    expect(decoder.push(frame(msg))).toEqual([msg]);
  });

  it('reassembles a large frame delivered in many small chunks (issue #402)', () => {
    // The old implementation Buffer.concat'ed per chunk — O(N^2) on exactly
    // this shape. This pins correctness; the linear accumulation is the fix.
    const big = { seq: 6, type: 'event', event: 'output', body: { text: 'y'.repeat(256 * 1024) } };
    const encoded = frame(big);
    const decoder = new DapFrameDecoder();

    const received: unknown[] = [];
    const CHUNK = 1024;
    for (let offset = 0; offset < encoded.length; offset += CHUNK) {
      received.push(...decoder.push(encoded.subarray(offset, offset + CHUNK)));
    }

    expect(received).toEqual([big]);
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
