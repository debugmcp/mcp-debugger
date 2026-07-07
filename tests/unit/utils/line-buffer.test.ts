import { describe, it, expect } from 'vitest';
import { LineBuffer } from '../../../src/utils/line-buffer.js';

describe('LineBuffer', () => {
  it('returns complete lines and holds the trailing partial', () => {
    const buf = new LineBuffer();
    expect(buf.append('one\ntwo\npart')).toEqual(['one', 'two']);
    expect(buf.append('ial\n')).toEqual(['partial']);
  });

  it('joins content split across appends (issue #151 straddle case)', () => {
    const buf = new LineBuffer();
    expect(buf.append('GITHUB_PAT=ghp_abc')).toEqual([]);
    expect(buf.append('def123\n')).toEqual(['GITHUB_PAT=ghp_abcdef123']);
  });

  it('strips trailing carriage returns from CRLF input', () => {
    const buf = new LineBuffer();
    expect(buf.append('one\r\ntwo\r\n')).toEqual(['one', 'two']);
  });

  it('returns multiple lines from a single append', () => {
    const buf = new LineBuffer();
    expect(buf.append('a\nb\nc\n')).toEqual(['a', 'b', 'c']);
  });

  it('flush returns the pending partial line and clears it', () => {
    const buf = new LineBuffer();
    buf.append('no newline yet');
    expect(buf.flush()).toEqual(['no newline yet']);
    expect(buf.flush()).toEqual([]);
  });

  it('flush on an empty buffer returns nothing', () => {
    expect(new LineBuffer().flush()).toEqual([]);
  });

  it('force-emits an oversized pending line to bound memory', () => {
    const buf = new LineBuffer(16);
    expect(buf.append('x'.repeat(20))).toEqual(['x'.repeat(20)]);
    expect(buf.flush()).toEqual([]);
  });

  it('does not force-emit when a newline drains the pending data', () => {
    const buf = new LineBuffer(16);
    expect(buf.append('short line\nnext')).toEqual(['short line']);
    expect(buf.flush()).toEqual(['next']);
  });
});
