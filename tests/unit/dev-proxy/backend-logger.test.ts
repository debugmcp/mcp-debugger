/**
 * Unit tests for the dev-proxy backend output logger (issue #154).
 *
 * The helper lives in tools/dev-proxy/backend-logger.mjs (separate from
 * dev-proxy.mjs, which runs main() at module top level and therefore cannot
 * be imported safely).
 *
 * These tests verify that backend stdout/stderr chunks are line-buffered
 * before sanitization — a secret assignment split across two chunks must be
 * reassembled and redacted as a single line (the defect class fixed for the
 * server in #151), not emitted as two partial lines that slip past the
 * redaction patterns.
 */
import { describe, it, expect } from 'vitest';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore -- plain-JS module without type declarations
import { createBackendLogger, sanitizeStderrTail } from '../../../tools/dev-proxy/backend-logger.mjs';

const REDACTED = '[REDACTED — line contained sensitive data]';

function makeLogger(prefix?: string) {
  const writes: string[] = [];
  const write = (s: string) => writes.push(s);
  const logger = prefix === undefined ? createBackendLogger(write) : createBackendLogger(write, prefix);
  return { writes, logger };
}

describe('dev-proxy createBackendLogger', () => {
  it('emits complete lines with the [backend] prefix', () => {
    const { writes, logger } = makeLogger();
    logger.onData('hello\nworld\n');
    expect(writes).toEqual(['[backend] hello\n', '[backend] world\n']);
  });

  it('reassembles a line straddling two chunks into a single line', () => {
    const { writes, logger } = makeLogger();
    logger.onData('Server star');
    logger.onData('ted on port 3001\n');
    expect(writes).toEqual(['[backend] Server started on port 3001\n']);
  });

  it('redacts a secret assignment split across two chunks as one line', () => {
    const { writes, logger } = makeLogger();
    logger.onData('GITHUB_P');
    logger.onData(`AT=ghp_${'a'.repeat(30)}\n`);
    expect(writes).toEqual([`[backend] ${REDACTED}\n`]);
  });

  it('redacts a complete secret line but passes benign lines through', () => {
    const { writes, logger } = makeLogger();
    logger.onData(`GITHUB_PAT=ghp_${'a'.repeat(30)}\nPATH=/usr/bin\n`);
    expect(writes).toEqual([`[backend] ${REDACTED}\n`, '[backend] PATH=/usr/bin\n']);
  });

  it('drops blank and whitespace-only lines', () => {
    const { writes, logger } = makeLogger();
    logger.onData('\n\n  \nfoo\n');
    expect(writes).toEqual(['[backend] foo\n']);
  });

  it('strips trailing CR from CRLF line endings', () => {
    const { writes, logger } = makeLogger();
    logger.onData('windows line\r\n');
    expect(writes).toEqual(['[backend] windows line\n']);
  });

  it('accepts Buffer chunks (stream data events)', () => {
    const { writes, logger } = makeLogger();
    logger.onData(Buffer.from('from a buffer\n'));
    expect(writes).toEqual(['[backend] from a buffer\n']);
  });

  it('flush() emits a held partial line once, then nothing', () => {
    const { writes, logger } = makeLogger();
    logger.onData('trailing partial');
    expect(writes).toEqual([]);
    logger.flush();
    expect(writes).toEqual(['[backend] trailing partial\n']);
    logger.flush();
    expect(writes).toEqual(['[backend] trailing partial\n']);
  });

  it('sanitizes a partial secret line emitted via flush()', () => {
    const { writes, logger } = makeLogger();
    logger.onData(`API_KEY=sk-${'b'.repeat(30)}`);
    logger.flush();
    expect(writes).toEqual([`[backend] ${REDACTED}\n`]);
  });

  it('keeps buffer state independent across logger instances', () => {
    const a = makeLogger();
    const b = makeLogger();
    a.logger.onData('stdout par');
    b.logger.onData('stderr line\n');
    expect(a.writes).toEqual([]);
    expect(b.writes).toEqual(['[backend] stderr line\n']);
    a.logger.onData('tial\n');
    expect(a.writes).toEqual(['[backend] stdout partial\n']);
  });

  it('supports a custom prefix', () => {
    const { writes, logger } = makeLogger('[build]');
    logger.onData('done\n');
    expect(writes).toEqual(['[build] done\n']);
  });
});

describe('dev-proxy sanitizeStderrTail re-export', () => {
  it('redacts secret-looking lines and keeps benign ones', () => {
    const out = sanitizeStderrTail(`compiling...\nGITHUB_PAT=ghp_${'c'.repeat(30)}\ndone\n`);
    expect(out).toContain('compiling...');
    expect(out).toContain(REDACTED);
    expect(out).toContain('done');
    expect(out).not.toContain('ghp_');
  });

  it('caps output to the last maxLines lines', () => {
    const text = Array.from({ length: 30 }, (_, i) => `line ${i}`).join('\n');
    const out = sanitizeStderrTail(text, { maxLines: 5, maxChars: 2000 });
    expect(out).toContain('line 29');
    expect(out).not.toContain('line 0\n');
    expect(out).toContain('(last 5 of 30 lines)');
  });
});
