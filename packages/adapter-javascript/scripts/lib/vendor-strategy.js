/**
 * Vendoring strategy helpers (ESM, side-effect free)
 *
 * Exposes:
 *  - parseEnvBool(v): boolean
 *  - determineVendoringPlan(env=process.env):
 *      { mode: 'local', localPath: string }                when JS_DEBUG_LOCAL_PATH is set
 *      { mode: 'prebuilt-then-source' }                    when JS_DEBUG_BUILD_FROM_SOURCE === 'true'
 *      { mode: 'prebuilt-only' }                           otherwise
 */

/**
 * Coerces an env var-like value to boolean, accepting string 'true' (case-insensitive).
 * Any other value is treated as false.
 * @param {unknown} v
 * @returns {boolean}
 */
export function parseEnvBool(v) {
  return String(v || '').trim().toLowerCase() === 'true';
}

/**
 * Determines the vendoring plan based on environment variables.
 * - JS_DEBUG_LOCAL_PATH: if non-empty => local mode
 * - JS_DEBUG_BUILD_FROM_SOURCE=true => prebuilt-then-source
 * - default => prebuilt-only
 *
 * Note: FORCE handling (JS_DEBUG_FORCE_REBUILD) and presence of existing artifacts
 * are enforced in the calling script to retain deterministic behavior.
 *
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} env
 * @returns {{ mode: 'local', localPath: string } | { mode: 'prebuilt-then-source' } | { mode: 'prebuilt-only' }}
 */
export function determineVendoringPlan(env = /** @type {any} */ (typeof process !== 'undefined' ? process.env : {})) {
  const localPath = String(env.JS_DEBUG_LOCAL_PATH || '').trim();
  if (localPath) {
    return { mode: 'local', localPath };
  }
  if (parseEnvBool(env.JS_DEBUG_BUILD_FROM_SOURCE)) {
    return { mode: 'prebuilt-then-source' };
  }
  return { mode: 'prebuilt-only' };
}
