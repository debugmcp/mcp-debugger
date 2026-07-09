/**
 * Property-based tests (fast-check) for LineBuffer.
 *
 * LineBuffer guards the stderr sanitization path: secret redaction only
 * works when filters see whole lines, no matter how the OS chunks the
 * stream (issue #151). These properties assert chunking invariance — any
 * split of any input produces the same lines as splitting the whole input
 * at once — and the memory bound on the held partial line.
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { LineBuffer } from '../../src/utils/line-buffer.js';

/** Reference model: what splitting the whole input at once would produce. */
function referenceSplit(input: string): { lines: string[]; flushed: string[] } {
  const parts = input.split('\n');
  const pending = parts.pop() ?? '';
  const lines = parts.map(line => (line.endsWith('\r') ? line.slice(0, -1) : line));
  return { lines, flushed: pending === '' ? [] : [pending] };
}

/** Cut a string into contiguous chunks at arbitrary positions (mod length). */
function chunkAt(input: string, cuts: number[]): string[] {
  const points = [...new Set(cuts.map(c => c % (input.length + 1)))].sort((a, b) => a - b);
  const chunks: string[] = [];
  let previous = 0;
  for (const point of points) {
    chunks.push(input.slice(previous, point));
    previous = point;
  }
  chunks.push(input.slice(previous));
  return chunks;
}

/** Text mixing ordinary runs with every newline convention. */
const textWithNewlines = fc
  .array(fc.oneof(fc.string({ maxLength: 12 }), fc.constantFrom('\n', '\r\n', '\r')), { maxLength: 40 })
  .map(pieces => pieces.join(''));

describe('LineBuffer properties', () => {
  it('any chunking of any input yields the same lines as the whole input', () => {
    fc.assert(
      fc.property(textWithNewlines, fc.array(fc.nat(1_000_000), { maxLength: 20 }), (input, cuts) => {
        const buffer = new LineBuffer();
        const emitted: string[] = [];
        for (const chunk of chunkAt(input, cuts)) {
          emitted.push(...buffer.append(chunk));
        }
        const flushed = buffer.flush();

        const expected = referenceSplit(input);
        expect(emitted).toEqual(expected.lines);
        expect(flushed).toEqual(expected.flushed);
      })
    );
  });

  it('flush after flush is empty and append streams can be reused afterwards', () => {
    fc.assert(
      fc.property(textWithNewlines, (input) => {
        const buffer = new LineBuffer();
        buffer.append(input);
        buffer.flush();
        expect(buffer.flush()).toEqual([]);

        // The buffer is stateless after a flush: a fresh input behaves like a fresh buffer.
        const reused = [...buffer.append(input), ...buffer.flush()];
        const fresh = new LineBuffer();
        const expected = [...fresh.append(input), ...fresh.flush()];
        expect(reused).toEqual(expected);
      })
    );
  });

  it('newline-free streams lose no data and never hold more than maxPendingLength', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ maxLength: 30 }).map(s => s.replace(/\n/g, ' ')), { maxLength: 30 }),
        fc.integer({ min: 1, max: 16 }),
        (chunks, maxPendingLength) => {
          const buffer = new LineBuffer(maxPendingLength);
          const emitted: string[] = [];
          for (const chunk of chunks) {
            emitted.push(...buffer.append(chunk));
            const pending = (buffer as unknown as { pending: string }).pending;
            expect(pending.length).toBeLessThanOrEqual(maxPendingLength);
          }
          emitted.push(...buffer.flush());
          expect(emitted.join('')).toBe(chunks.join(''));
        }
      )
    );
  });
});
