/**
 * SafeFileTransport — a winston File transport that survives log-rotation failure.
 *
 * Why this exists (issue #121): winston's tailable rotation renames the *live*
 * base file (`_checkMaxFilesTailable` → fs.rename). On Windows that rename fails
 * with EPERM/EBUSY while any other process (or another transport in this
 * process) holds the file open. Winston's `stat()` discards the rotation error
 * and immediately retries:
 *
 *     stat() → _needsNewFile(size) → _incFile(() => this.stat(callback)) → ...
 *
 * Since the failed rename leaves the file oversize, this loops forever: a
 * busy-spin of stat/exists/rename on the libuv threadpool (~40-200% of a core),
 * unbounded memory growth from winston's buffered write queue, and zero log
 * output.
 *
 * The fix: intercept `_incFile`. If rotation fails, permanently disable
 * rotation for this transport by zeroing `maxsize` (winston's
 * `_needsNewFile()` is `this.maxsize && size >= this.maxsize`, so the latch is
 * complete) and swallow the error so `stat()` proceeds to reopen the base file
 * and keep appending. The buffered queue drains on the first failed rotation
 * pass, which bounds memory; logging continues past the size cap rather than
 * stopping dead.
 *
 * Known (accepted) edge case: per-process default log files are named
 * `debug-mcp-server-<pid>.log`, and tailable rotation appends a bare digit to
 * the basename (`debug-mcp-server-<pid>1.log`). A rotated file of pid N is
 * therefore spelled the same as the live file of pid N*10+1. Colliding
 * requires both pids to be assigned to mcp-debugger processes logging to the
 * same directory within the log-retention window; the consequence is at worst
 * a failed rename, which this latch degrades gracefully.
 *
 * NOTE: `_incFile` is a private winston internal, stable across winston 3.x
 * and pinned here by the `winston: ^3.19.0` dependency. The override looks the
 * parent method up lazily and defensively: if a future winston renames it,
 * this class behaves exactly like a stock File transport (no worse than
 * before). The unit tests in tests/unit/utils/safe-file-transport.test.ts
 * fail loudly if the seam changes shape.
 */
import * as winston from 'winston';
import path from 'path';

type IncFileCallback = (err?: Error | null) => void;

/** Narrow view of winston's private File-transport internals we rely on. */
interface FileTransportInternals {
  _incFile?: (callback: IncFileCallback) => void;
}

export class SafeFileTransport extends winston.transports.File {
  /** True once a rotation attempt has failed and rotation was latched off. */
  public rotationDisabled = false;

  public _incFile(callback: IncFileCallback): void {
    const parentIncFile = (winston.transports.File.prototype as unknown as FileTransportInternals)._incFile;
    if (typeof parentIncFile !== 'function') {
      // Winston internals changed shape (or are mocked); nothing to wrap.
      callback();
      return;
    }

    parentIncFile.call(this, (err?: Error | null) => {
      if (err && !this.rotationDisabled) {
        this.rotationDisabled = true;
        // Latch: _needsNewFile() checks `this.maxsize && size >= this.maxsize`,
        // so zeroing maxsize disables all future rotation for this transport.
        this.maxsize = 0;
        // Never write to stdout/stderr when console output is silenced — it
        // would corrupt stdio transports (same guard as src/utils/logger.ts).
        if (process.env.CONSOLE_OUTPUT_SILENCED !== '1') {
          // this.filename is only the basename; this.dirname carries the directory.
          console.error(
            `[Logger] Log rotation failed for ${path.join(this.dirname, this.filename)} ` +
            `(${err.message}). Disabling rotation for this process and continuing to append.`
          );
        }
      }
      // Swallow the error: we have handled it by latching rotation off, and
      // winston's callers (stat(), _rotateFile()) ignore it anyway. stat()
      // will re-check _needsNewFile(), now false, and reopen the base file so
      // buffered writes drain and logging resumes.
      callback();
    });
  }
}
