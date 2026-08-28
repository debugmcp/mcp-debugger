function setOwnProperty(target, key, value) {
  Object.defineProperty(target, key, {
    value,
    enumerable: true,
    writable: true,
    configurable: true,
  });
}

function copyStringMap(source) {
  const copy = {};
  for (const [key, value] of Object.entries(source)) {
    setOwnProperty(copy, key, value);
  }
  return copy;
}

/**
 * Replace backend overrides only when a tool call explicitly supplies `env`.
 * Omission preserves the prior map; an empty object clears it.
 *
 * @param {Record<string, string>} current
 * @param {Record<string, unknown> | null | undefined} args
 */
export function updateBackendEnvOverrides(current, args) {
  if (!Object.prototype.hasOwnProperty.call(args ?? {}, 'env')) return current;
  return copyStringMap(/** @type {{ env: Record<string, string> }} */ (args).env);
}

/**
 * Merge persistent overrides over the proxy's inherited environment. Forced
 * supervisor variables are applied last and therefore cannot be overridden.
 *
 * @param {Record<string, string | undefined>} inherited
 * @param {Record<string, string>} overrides
 * @param {Record<string, string>} [forced]
 */
export function buildBackendEnvironment(inherited, overrides, forced = {}) {
  return { ...inherited, ...overrides, ...forced };
}
