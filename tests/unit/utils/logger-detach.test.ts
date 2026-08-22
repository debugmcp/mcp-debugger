/**
 * Leak regression tests for issue #404: every per-session DebugMcpServer's
 * logger pipes into the process-lifetime shared file transport and nothing
 * ever unpiped, so the transport accumulated one listener set + retained
 * logger per HTTP session forever.
 *
 * Uses REAL winston (no module mock): the leak lives in winston's pipe
 * mechanics, and the fix must neutralize winston-transport's close-on-unpipe
 * behavior (transport.parent is the FIRST logger that piped it; a plain
 * logger.remove() from that logger closes the shared transport for everyone).
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createLogger, detachSharedFileTransport } from '../../../src/utils/logger.js';

let tmpDir: string;
let logFile: string;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'logger-detach-test-'));
  logFile = path.join(tmpDir, 'shared.log');
});

afterAll(() => {
  // The shared transport deliberately stays open for the process lifetime;
  // best-effort cleanup only.
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    // Windows may hold the handle — fine, it's a temp dir.
  }
});

function fileTransportOf(logger: ReturnType<typeof createLogger>) {
  const t = logger.transports.find((tr) => (tr as { filename?: string }).filename !== undefined);
  expect(t).toBeDefined();
  return t!;
}

describe('detachSharedFileTransport (issue #404)', () => {
  it('detaches a later logger without growing or closing the shared transport', () => {
    const first = createLogger('detach-test-first', { file: logFile });
    const shared = fileTransportOf(first);

    const baselineUnpipe = shared.listenerCount('unpipe');
    const baselineError = shared.listenerCount('error');

    // N churning sessions attach and detach
    for (let i = 0; i < 5; i++) {
      const session = createLogger(`detach-test-session-${i}`, { file: logFile });
      expect(fileTransportOf(session)).toBe(shared); // cache: one transport per path
      detachSharedFileTransport(session);
      expect(session.transports).not.toContain(shared);
    }

    // No listener growth on the shared transport after the churn
    expect(shared.listenerCount('unpipe')).toBeLessThanOrEqual(baselineUnpipe);
    expect(shared.listenerCount('error')).toBeLessThanOrEqual(baselineError);
  });

  it('does not close the shared transport even when the FIRST attacher detaches', () => {
    const file = path.join(tmpDir, 'first-attacher.log');
    const first = createLogger('detach-test-owner', { file });
    const shared = fileTransportOf(first);
    const closeSpy = vi.spyOn(shared as unknown as { close: () => void }, 'close');

    const second = createLogger('detach-test-tenant', { file });
    expect(fileTransportOf(second)).toBe(shared);

    // winston-transport's close-on-unpipe fires when transport.parent (the
    // first attacher) unpipes — the detach must neutralize it.
    detachSharedFileTransport(first);

    expect(closeSpy).not.toHaveBeenCalled();
    // The surviving logger still carries the open shared transport
    expect(second.transports).toContain(shared);
    expect(() => second.info('still alive')).not.toThrow();
    closeSpy.mockRestore();
  });

  it('is a no-op for a logger with no shared file transport', () => {
    const bare = createLogger('detach-test-bare');
    expect(() => detachSharedFileTransport(bare)).not.toThrow();
  });
});
