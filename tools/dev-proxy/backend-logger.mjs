/**
 * Backend output logging for dev-proxy — line-buffer and sanitize before forwarding.
 *
 * Why this exists (issue #154): stream 'data' events are chunked at arbitrary
 * byte boundaries, so splitting each chunk on '\n' emits a line that straddles
 * two chunks as two partial lines — and a secret assignment split that way
 * slips past redaction patterns (the defect class fixed for the server in
 * #151). Backend stdout/stderr must be reassembled into whole lines and run
 * through the shared stderr sanitizer before being written to the proxy's
 * stderr or embedded in a tool response.
 *
 * The sanitization utilities live in @debugmcp/shared, which the plain-.mjs
 * proxy resolves through the workspace link to packages/shared/dist. That
 * dist only exists after a build — and the proxy must keep its dev tools
 * available on an unbuilt tree so dev_rebuild_and_restart can fix it. Hence
 * the dynamic import with minimal fallbacks instead of a static import that
 * would crash the proxy at startup.
 *
 * Kept in its own module so unit tests can import it without executing the
 * dev-proxy entry point (dev-proxy.mjs runs main() at module top level).
 */

let LineBuffer;
let sanitizeStderr;
let sanitizeStderrTail;

/** False when @debugmcp/shared dist was unavailable and fallbacks are active. */
export let sharedUtilsLoaded = true;

try {
  ({ LineBuffer, sanitizeStderr, sanitizeStderrTail } = await import('@debugmcp/shared'));
} catch {
  // Shared dist not built yet — degrade to line buffering without redaction
  // so the proxy can still bootstrap. dev-proxy.mjs logs a warning when it
  // sees sharedUtilsLoaded === false.
  sharedUtilsLoaded = false;

  LineBuffer = class {
    pending = '';

    /** @param {string} chunk @returns {string[]} complete lines (CR stripped) */
    append(chunk) {
      this.pending += chunk;
      const parts = this.pending.split('\n');
      this.pending = parts.pop() ?? '';
      const lines = parts.map((line) => (line.endsWith('\r') ? line.slice(0, -1) : line));
      if (this.pending.length > 8192) {
        lines.push(this.pending);
        this.pending = '';
      }
      return lines;
    }

    /** @returns {string[]} the held partial line, if any */
    flush() {
      if (this.pending === '') return [];
      const line = this.pending;
      this.pending = '';
      return [line];
    }
  };

  sanitizeStderr = (lines) => lines;

  sanitizeStderrTail = (text, { maxChars = 2000 } = {}) =>
    text.length > maxChars ? '…' + text.slice(-maxChars) : text;
}

export { sanitizeStderrTail };

/**
 * Create a logger for one backend output stream. Each logger owns its own
 * line buffer — never share one across stdout and stderr, or partial lines
 * from the two streams would interleave.
 *
 * @param {(text: string) => void} write Sink for prefixed, sanitized lines.
 * @param {string} [prefix]
 * @returns {{ onData: (data: Buffer | string) => void, flush: () => void }}
 *   Attach onData to the stream's 'data' event; call flush on the stream's
 *   own 'end'/'close' (not process exit — the pipe can still deliver the rest
 *   of a split line after exit). flush is idempotent.
 */
export function createBackendLogger(write, prefix = '[backend]') {
  const buffer = new LineBuffer();
  const emit = (lines) => {
    for (const line of sanitizeStderr(lines.filter((l) => l.trim().length > 0))) {
      write(`${prefix} ${line}\n`);
    }
  };
  return {
    onData: (data) => emit(buffer.append(data.toString())),
    flush: () => emit(buffer.flush()),
  };
}
