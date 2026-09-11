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
 * The backend port from DEV_PROXY_PORT (issue #689): unset or empty means
 * 3001; otherwise only an integer in 1-65535 is accepted. parseInt turned
 * `3001x` into 3001 and `abc` into NaN, after which the proxy polled
 * `http://127.0.0.1:NaN/health` for 30s without ever naming the variable.
 * 0 is refused as well: the proxy has to know the port to dial the backend.
 *
 * @param {string | undefined} raw
 * @returns {number}
 */
export function resolveBackendPort(raw) {
  if (raw === undefined || raw === '') return 3001;
  const port = /^\d+$/.test(raw) ? Number(raw) : NaN;
  if (!(port >= 1 && port <= 65535)) {
    throw new Error(`DEV_PROXY_PORT value '${raw}' is not a port number; give an integer 1-65535`);
  }
  return port;
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
