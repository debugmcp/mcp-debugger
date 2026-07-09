/**
 * Property-based tests (fast-check) for MinimalDapClient's DAP wire framing.
 *
 * TCP delivers the adapter's Content-Length-framed stream in arbitrary
 * chunks — a boundary can fall inside a header, inside a JSON body, or even
 * inside a multi-byte UTF-8 character. handleData must reassemble the exact
 * message sequence regardless. These properties feed generated DAP event
 * streams through every possible kind of split and assert lossless,
 * in-order delivery.
 */
import { describe, it, expect, vi } from 'vitest';
import fc from 'fast-check';
import { MinimalDapClient } from '../../../src/proxy/minimal-dap.js';

vi.mock('../../../src/utils/logger.js', () => ({
  createLogger: vi.fn(() => ({ info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }))
}));

const ALNUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

interface DapEventMessage {
  seq: number;
  type: 'event';
  event: string;
  body: unknown;
}

function frame(message: DapEventMessage): Buffer {
  const json = JSON.stringify(message);
  return Buffer.from(`Content-Length: ${Buffer.byteLength(json, 'utf8')}\r\n\r\n${json}`, 'utf8');
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
// mid-character — the case Content-Length (bytes) exists to make safe.
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

// Note: 'error' is deliberately excluded — as an EventEmitter event name it
// has throw-on-unhandled semantics unrelated to DAP framing.
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

describe('MinimalDapClient framing properties', () => {
  it('reassembles any chunking of framed DAP traffic into the original message sequence', async () => {
    await fc.assert(
      fc.asyncProperty(
        messagesArb,
        fc.array(fc.nat(1_000_000), { maxLength: 25 }),
        async (messages, cuts) => {
          const client = new MinimalDapClient('localhost', 0);
          const received: unknown[] = [];
          client.on('event', evt => received.push(evt));

          const stream = Buffer.concat(messages.map(frame));
          for (const chunk of chunkBuffer(stream, cuts)) {
            (client as unknown as { handleData(data: Buffer): void }).handleData(chunk);
          }
          await new Promise(resolve => setImmediate(resolve));

          // JSON-normalize the expectation: the client necessarily returns
          // what survives a JSON round-trip (e.g. -0 becomes 0).
          const expected = messages.map(m => JSON.parse(JSON.stringify(m)));
          expect(received).toEqual(expected);
        }
      )
    );
  });

  it('delivers byte-identical results for any two chunkings of the same stream', async () => {
    await fc.assert(
      fc.asyncProperty(
        messagesArb,
        fc.array(fc.nat(1_000_000), { maxLength: 25 }),
        fc.array(fc.nat(1_000_000), { maxLength: 25 }),
        async (messages, cutsA, cutsB) => {
          const stream = Buffer.concat(messages.map(frame));

          const run = async (cuts: number[]): Promise<string> => {
            const client = new MinimalDapClient('localhost', 0);
            const received: unknown[] = [];
            client.on('event', evt => received.push(evt));
            for (const chunk of chunkBuffer(stream, cuts)) {
              (client as unknown as { handleData(data: Buffer): void }).handleData(chunk);
            }
            await new Promise(resolve => setImmediate(resolve));
            return JSON.stringify(received);
          };

          expect(await run(cutsA)).toBe(await run(cutsB));
        }
      )
    );
  });
});
