/**
 * Tests for SafeFileTransport (issue #121).
 *
 * Uses REAL winston (no module mock): the whole point is to exercise the
 * private `_incFile` seam these tests pin down. If a winston upgrade renames
 * or reshapes that internal, `vi.spyOn(prototype, '_incFile')` throws and this
 * suite fails loudly — by design.
 *
 * Rotation failure is injected at the seam (parent `_incFile` yields EPERM),
 * so the tests are deterministic and platform-independent; no OS-level file
 * locking is needed.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as winston from 'winston';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { SafeFileTransport } from '../../../src/utils/safe-file-transport.js';

type IncFileCallback = (err?: Error | null) => void;
interface FileTransportInternals {
  _incFile(callback: IncFileCallback): void;
}

const MAXSIZE = 1024;

function makeEpermError(): NodeJS.ErrnoException {
  const err = new Error(
    'EPERM: operation not permitted, rename'
  ) as NodeJS.ErrnoException;
  err.code = 'EPERM';
  return err;
}

/** Spy on winston's private rotation step and make it fail like Windows does. */
function injectRotationFailure() {
  return vi
    .spyOn(
      winston.transports.File.prototype as unknown as FileTransportInternals,
      '_incFile'
    )
    .mockImplementation(function (callback: IncFileCallback) {
      callback(makeEpermError());
    });
}

describe('SafeFileTransport', () => {
  let tmpDir: string;
  let filename: string;
  const transports: SafeFileTransport[] = [];

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'safe-file-transport-'));
    filename = path.join(tmpDir, 'test.log');
  });

  afterEach(async () => {
    // Close transports so Windows releases the file handles before rmSync.
    await Promise.all(
      transports.splice(0).map(
        (t) =>
          new Promise<void>((resolve) => {
            t.once('closed', () => resolve());
            try {
              t.close();
            } catch {
              resolve();
            }
            // Don't hang teardown if 'closed' never fires.
            setTimeout(resolve, 1000).unref?.();
          })
      )
    );
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Windows may briefly hold handles; leaked tmp dirs are harmless.
    }
  });

  function makeTransport(): SafeFileTransport {
    const transport = new SafeFileTransport({
      filename,
      maxsize: MAXSIZE,
      maxFiles: 3,
      tailable: true
    });
    transports.push(transport);
    return transport;
  }

  it('latches rotation off after a rotation failure and keeps appending (no busy-spin)', async () => {
    // Base file already over maxsize: winston rotates at open().
    fs.writeFileSync(filename, 'x'.repeat(2 * MAXSIZE));
    const incFileSpy = injectRotationFailure();
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const transport = makeTransport();
    const logger = winston.createLogger({ transports: [transport] });
    logger.info('hello after failed rotation');

    // Without the latch, winston loops stat -> _incFile -> stat forever and
    // this line never reaches the file.
    await vi.waitFor(
      () => {
        expect(fs.readFileSync(filename, 'utf8')).toContain(
          'hello after failed rotation'
        );
      },
      { timeout: 5000 }
    );

    // Exactly one rotation attempt: the latch prevents the retry loop.
    expect(incFileSpy).toHaveBeenCalledTimes(1);
    expect(transport.rotationDisabled).toBe(true);
    expect(transport.maxsize).toBe(0);
    // Appending continued past the old cap instead of buffering in memory.
    expect(fs.statSync(filename).size).toBeGreaterThan(MAXSIZE);
  });

  it('does not interfere with successful rotation', async () => {
    fs.writeFileSync(filename, 'x'.repeat(2 * MAXSIZE));
    const rotated = path.join(tmpDir, 'test1.log');

    const transport = makeTransport();
    const logger = winston.createLogger({ transports: [transport] });
    logger.info('fresh file after rotation');

    await vi.waitFor(
      () => {
        expect(fs.existsSync(rotated)).toBe(true);
        expect(fs.readFileSync(filename, 'utf8')).toContain(
          'fresh file after rotation'
        );
      },
      { timeout: 5000 }
    );

    expect(transport.rotationDisabled).toBe(false);
    expect(transport.maxsize).toBe(MAXSIZE);
    // The oversize content moved to the rotated file; base was recreated.
    expect(fs.statSync(rotated).size).toBeGreaterThanOrEqual(2 * MAXSIZE);
  });

  it('warns exactly once, and only when console output is not silenced', async () => {
    fs.writeFileSync(filename, 'x'.repeat(2 * MAXSIZE));
    injectRotationFailure();
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const transport = makeTransport();
    await vi.waitFor(() => expect(transport.rotationDisabled).toBe(true), {
      timeout: 5000
    });

    const rotationWarnings = () =>
      consoleErrorSpy.mock.calls.filter((args) =>
        String(args[0]).includes('Log rotation failed')
      );
    expect(rotationWarnings()).toHaveLength(1);
    expect(String(rotationWarnings()[0][0])).toContain('test.log');

    // A second failure (e.g. a stray manual rotation attempt) must not spam.
    (transport as unknown as FileTransportInternals)._incFile(() => {});
    expect(rotationWarnings()).toHaveLength(1);
  });

  it('stays silent on rotation failure when console output is silenced', async () => {
    vi.stubEnv('CONSOLE_OUTPUT_SILENCED', '1');
    fs.writeFileSync(filename, 'x'.repeat(2 * MAXSIZE));
    injectRotationFailure();
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const transport = makeTransport();
    await vi.waitFor(() => expect(transport.rotationDisabled).toBe(true), {
      timeout: 5000
    });

    expect(
      consoleErrorSpy.mock.calls.filter((args) =>
        String(args[0]).includes('Log rotation failed')
      )
    ).toHaveLength(0);
  });
});
