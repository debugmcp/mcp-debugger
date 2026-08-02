/**
 * Unit tests for OutputRingBuffer (issue #218)
 */
import { describe, it, expect } from 'vitest';
import { OutputRingBuffer, OUTPUT_BUFFER_CAP, MAX_OUTPUT_ENTRY_CHARS } from '../../../../src/session/output-buffer.js';

describe('OutputRingBuffer', () => {
  it('assigns monotonic seq starting at 1 and preserves order', () => {
    const buffer = new OutputRingBuffer();
    buffer.push('stdout', 'one\n', 1000);
    buffer.push('stderr', 'two\n', 2000);
    buffer.push('console', 'three\n', 3000);

    const { entries, nextSince, hasMore, dropped } = buffer.read(0, 100);
    expect(entries.map(e => e.seq)).toEqual([1, 2, 3]);
    expect(entries.map(e => e.category)).toEqual(['stdout', 'stderr', 'console']);
    expect(entries.map(e => e.output)).toEqual(['one\n', 'two\n', 'three\n']);
    expect(entries.map(e => e.timestamp)).toEqual([1000, 2000, 3000]);
    expect(nextSince).toBe(3);
    expect(hasMore).toBe(false);
    expect(dropped).toBe(0);
  });

  it('evicts oldest entries past the cap, counting drops and keeping seq continuity', () => {
    const buffer = new OutputRingBuffer(5);
    for (let i = 0; i < 8; i++) {
      buffer.push('stdout', `line ${i}\n`);
    }

    const { entries, dropped } = buffer.read(0, 100);
    expect(entries).toHaveLength(5);
    expect(dropped).toBe(3);
    // Oldest 3 evicted: retained seqs are 4..8
    expect(entries.map(e => e.seq)).toEqual([4, 5, 6, 7, 8]);
    expect(entries[0].output).toBe('line 3\n');
  });

  it('truncates oversized entries and flags them', () => {
    const buffer = new OutputRingBuffer();
    buffer.push('stdout', 'x'.repeat(MAX_OUTPUT_ENTRY_CHARS + 100));
    buffer.push('stdout', 'small');

    const { entries } = buffer.read(0, 100);
    expect(entries[0].output).toHaveLength(MAX_OUTPUT_ENTRY_CHARS);
    expect(entries[0].truncated).toBe(true);
    expect(entries[1].truncated).toBeUndefined();
  });

  it('filters by since and pages by limit with hasMore/nextSince', () => {
    const buffer = new OutputRingBuffer();
    for (let i = 0; i < 10; i++) {
      buffer.push('stdout', `line ${i}\n`);
    }

    const page1 = buffer.read(0, 4);
    expect(page1.entries.map(e => e.seq)).toEqual([1, 2, 3, 4]);
    expect(page1.hasMore).toBe(true);
    expect(page1.nextSince).toBe(4);

    const page2 = buffer.read(page1.nextSince, 4);
    expect(page2.entries.map(e => e.seq)).toEqual([5, 6, 7, 8]);
    expect(page2.hasMore).toBe(true);

    const page3 = buffer.read(page2.nextSince, 4);
    expect(page3.entries.map(e => e.seq)).toEqual([9, 10]);
    expect(page3.hasMore).toBe(false);
    expect(page3.nextSince).toBe(10);
  });

  it('echoes since as nextSince when no new entries exist', () => {
    const buffer = new OutputRingBuffer();
    buffer.push('stdout', 'only\n');

    const drained = buffer.read(1, 100);
    expect(drained.entries).toEqual([]);
    expect(drained.nextSince).toBe(1);
    expect(drained.hasMore).toBe(false);
  });

  it('renders a verbatim interleaved transcript', () => {
    const buffer = new OutputRingBuffer();
    buffer.push('stdout', 'out 1\n');
    buffer.push('stderr', 'err 1\n');
    buffer.push('stdout', 'partial');
    buffer.push('stdout', ' line\n');

    expect(buffer.renderText()).toBe('out 1\nerr 1\npartial line\n');
  });

  it('uses the default cap of 1000', () => {
    const buffer = new OutputRingBuffer();
    for (let i = 0; i < OUTPUT_BUFFER_CAP + 10; i++) {
      buffer.push('stdout', `${i}\n`);
    }
    const { entries, dropped } = buffer.read(0, OUTPUT_BUFFER_CAP + 10);
    expect(entries).toHaveLength(OUTPUT_BUFFER_CAP);
    expect(dropped).toBe(10);
  });
});
