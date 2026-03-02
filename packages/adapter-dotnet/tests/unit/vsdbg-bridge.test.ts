import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  DapFrameParser,
  signHandshake
} from '../../src/utils/vsdbg-bridge.js';

// ===== DapFrameParser =====

describe('DapFrameParser', () => {
  let parser: DapFrameParser;

  beforeEach(() => {
    parser = new DapFrameParser();
  });

  it('parses a single complete DAP frame', () => {
    const body = '{"type":"request","command":"handshake"}';
    const frame = Buffer.from(`Content-Length: ${body.length}\r\n\r\n${body}`);

    const results = parser.feed(frame);

    expect(results).toHaveLength(1);
    expect(results[0].toString('utf8')).toBe(body);
  });

  it('parses multiple complete DAP frames in one chunk', () => {
    const body1 = '{"type":"event","event":"initialized"}';
    const body2 = '{"type":"response","command":"initialize"}';
    const data = Buffer.from(
      `Content-Length: ${body1.length}\r\n\r\n${body1}` +
      `Content-Length: ${body2.length}\r\n\r\n${body2}`
    );

    const results = parser.feed(data);

    expect(results).toHaveLength(2);
    expect(results[0].toString('utf8')).toBe(body1);
    expect(results[1].toString('utf8')).toBe(body2);
  });

  it('handles frames split across multiple chunks', () => {
    const body = '{"type":"request","command":"handshake","arguments":{"value":"abc123"}}';
    const full = `Content-Length: ${body.length}\r\n\r\n${body}`;
    const splitPoint = Math.floor(full.length / 2);

    const chunk1 = Buffer.from(full.slice(0, splitPoint));
    const chunk2 = Buffer.from(full.slice(splitPoint));

    const results1 = parser.feed(chunk1);
    expect(results1).toHaveLength(0);

    const results2 = parser.feed(chunk2);
    expect(results2).toHaveLength(1);
    expect(results2[0].toString('utf8')).toBe(body);
  });

  it('buffers incomplete frames and returns nothing', () => {
    const body = '{"type":"request"}';
    const partial = Buffer.from(`Content-Length: ${body.length}\r\n\r\n${body.slice(0, 5)}`);

    const results = parser.feed(partial);
    expect(results).toHaveLength(0);
    expect(parser.hasData()).toBe(true);
  });

  it('returns remainder of unparsed data', () => {
    const body = '{"type":"event"}';
    const full = `Content-Length: ${body.length}\r\n\r\n${body}`;
    const extra = 'Content-Len';
    const data = Buffer.from(full + extra);

    const results = parser.feed(data);
    expect(results).toHaveLength(1);

    const remainder = parser.getRemainder();
    expect(remainder.toString('utf8')).toBe(extra);
  });

  it('starts with no data', () => {
    expect(parser.hasData()).toBe(false);
    expect(parser.getRemainder().length).toBe(0);
  });

  it('handles frame split in the middle of Content-Length header', () => {
    const body = '{"seq":1}';
    const full = `Content-Length: ${body.length}\r\n\r\n${body}`;

    // Split in the middle of "Content-Length"
    const results1 = parser.feed(Buffer.from('Content-Le'));
    expect(results1).toHaveLength(0);

    const results2 = parser.feed(Buffer.from(full.slice('Content-Le'.length)));
    expect(results2).toHaveLength(1);
    expect(results2[0].toString('utf8')).toBe(body);
  });
});

// ===== signHandshake =====

describe('signHandshake', () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stderrSpy.mockRestore();
  });

  it('returns empty string when vsdaPath is null', () => {
    const result = signHandshake('challenge123', null);

    expect(result).toBe('');
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining('WARNING: vsda.node path not provided')
    );
  });

  it('returns empty string when vsda.node cannot be loaded', () => {
    // Use a path that will definitely fail to load
    const result = signHandshake('challenge123', '/nonexistent/vsda.node');

    expect(result).toBe('');
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining('WARNING: Failed to sign handshake')
    );
  });
});

