/**
 * Types for `vendor-strategy.js`, so its TypeScript tests see a real API
 * instead of the import falling back to `any` (issue #562).
 */

/**
 * Coerce an env-var-like value to boolean: only the string `'true'`
 * (case-insensitive, trimmed) is true. Anything else — including numbers,
 * `null` and `undefined` — is false, which is why the parameter is `unknown`
 * rather than `string`.
 */
export function parseEnvBool(v: unknown): boolean;

/**
 * How js-debug will be obtained.
 *
 * `JS_DEBUG_FORCE_REBUILD` and the presence of existing artifacts are handled
 * by the calling script, not here.
 */
export type VendoringPlan =
  /** `JS_DEBUG_LOCAL_PATH` was set to a non-empty value. */
  | { mode: 'local'; localPath: string }
  /** `JS_DEBUG_BUILD_FROM_SOURCE=true`. */
  | { mode: 'prebuilt-then-source' }
  /** The default. */
  | { mode: 'prebuilt-only' };

/** Determine the vendoring plan from environment variables. Defaults to `process.env`. */
export function determineVendoringPlan(
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>
): VendoringPlan;
