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
let sanitizeEnvForLogging;
let redactSecretsInString;

/** False when @debugmcp/shared dist was unavailable and fallbacks are active. */
export let sharedUtilsLoaded = true;

try {
  ({
    LineBuffer,
    sanitizeStderr,
    sanitizeStderrTail,
    sanitizeEnvForLogging,
    redactSecretsInString,
  } = await import('@debugmcp/shared'));
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

function setOwnProperty(target, key, value) {
  Object.defineProperty(target, key, {
    value,
    enumerable: true,
    writable: true,
    configurable: true,
  });
}

/**
 * Whether the stable proxy process explicitly opted out of display redaction.
 * Backend overrides are intentionally not consulted: allowing a restarted
 * child to disable supervisor-side masking would expose secrets in status.
 *
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} env
 */
export function isProxyRedactionDisabled(env = process.env) {
  const value = env.DEBUG_MCP_NO_REDACT?.trim().toLowerCase();
  return value === '1' || value === 'true';
}

/**
 * Make backend environment overrides safe to return from dev_server_status.
 * The real override map is never mutated. On an unbuilt checkout, where the
 * shared sanitizer cannot be loaded, fail closed by masking every value.
 *
 * @param {Record<string, string>} env
 * @param {object} [opts]
 * @param {boolean} [opts.redactionDisabled]
 * @param {boolean} [opts.sharedAvailable] Injectable for bootstrap tests.
 */
export function sanitizeBackendEnvOverrides(env, opts = {}) {
  const {
    redactionDisabled = isProxyRedactionDisabled(),
    sharedAvailable = sharedUtilsLoaded,
  } = opts;
  const values = {};
  const redactedVariables = [];

  if (redactionDisabled) {
    for (const [key, value] of Object.entries(env)) {
      setOwnProperty(values, key, value);
    }
    return {
      values,
      redaction: { enabled: false, redactedVariables, mode: 'disabled' },
    };
  }

  if (!sharedAvailable) {
    for (const key of Object.keys(env)) {
      setOwnProperty(values, key, '[REDACTED]');
      redactedVariables.push(key);
    }
    redactedVariables.sort();
    return {
      values,
      redaction: { enabled: true, redactedVariables, mode: 'fail-closed' },
    };
  }

  const nameSanitized = sanitizeEnvForLogging(env);
  for (const [key, originalValue] of Object.entries(env)) {
    const valueAfterNamePass = nameSanitized[key];
    const displayValue =
      valueAfterNamePass === originalValue
        ? redactSecretsInString(originalValue).value
        : valueAfterNamePass;
    setOwnProperty(values, key, displayValue);
    if (displayValue !== originalValue) redactedVariables.push(key);
  }
  redactedVariables.sort();

  return {
    values,
    redaction: { enabled: true, redactedVariables, mode: 'shared' },
  };
}

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
