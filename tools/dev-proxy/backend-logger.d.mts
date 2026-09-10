/**
 * Types for `backend-logger.mjs`, so its TypeScript tests see a real API
 * instead of `@ts-ignore`-ing the import into `any` (issue #562).
 */

/**
 * False when `@debugmcp/shared`'s dist was unavailable at import time and the
 * line-buffering-without-redaction fallbacks are active. Written once during
 * module evaluation, hence `let` rather than `const`.
 */
export let sharedUtilsLoaded: boolean;

/**
 * Re-export of `@debugmcp/shared`'s `sanitizeStderrTail`: redacts secret-looking
 * lines, then keeps the last `maxLines` lines and at most `maxChars` characters.
 *
 * On an unbuilt checkout this is a fallback that honours only `maxChars`; the
 * option bag is typed after the shared implementation, which is what runs in
 * every built tree.
 */
export function sanitizeStderrTail(
  text: string,
  opts?: { maxLines?: number; maxChars?: number }
): string;

/**
 * Whether the stable proxy process explicitly opted out of display redaction
 * via `DEBUG_MCP_NO_REDACT`. Defaults to reading `process.env`.
 */
export function isProxyRedactionDisabled(
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>
): boolean;

/** How a status response's environment overrides were masked. */
export interface BackendEnvRedaction {
  enabled: boolean;
  /** Names whose displayed value differs from the real one, sorted. */
  redactedVariables: string[];
  /**
   * `disabled` — opted out; `fail-closed` — shared sanitizer unavailable, every
   * value masked; `shared` — masked by `@debugmcp/shared`.
   */
  mode: 'disabled' | 'fail-closed' | 'shared';
}

/** Display-safe backend environment overrides, as returned by `dev_server_status`. */
export interface SanitizedBackendEnv {
  /** The same keys as the input, with display-safe values. */
  values: Record<string, string>;
  redaction: BackendEnvRedaction;
}

/**
 * Make backend environment overrides safe to return from `dev_server_status`.
 * The input map is never mutated.
 */
export function sanitizeBackendEnvOverrides(
  env: Record<string, string>,
  opts?: {
    redactionDisabled?: boolean;
    /** Injectable for bootstrap tests; defaults to {@link sharedUtilsLoaded}. */
    sharedAvailable?: boolean;
  }
): SanitizedBackendEnv;

/** One backend stream's line-buffering, sanitizing sink. */
export interface BackendLogger {
  /** Attach to the stream's `data` event. */
  onData(data: Buffer | string): void;
  /**
   * Emit any held partial line. Call on the stream's own `end`/`close`, not on
   * process exit. Idempotent.
   */
  flush(): void;
}

/**
 * Create a logger for one backend output stream. Each logger owns its own line
 * buffer — never share one across stdout and stderr.
 *
 * @param write sink for prefixed, sanitized lines (each already newline-terminated)
 * @param prefix defaults to `[backend]`
 */
export function createBackendLogger(
  write: (text: string) => void,
  prefix?: string
): BackendLogger;
