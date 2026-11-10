function setOwnProperty(target, key, value) {
  Object.defineProperty(target, key, {
    value,
    enumerable: true,
    writable: true,
    configurable: true,
  });
}

function copyStringMap(source) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    throw new Error('env must be an object whose values are strings');
  }
  const copy = {};
  for (const [key, value] of Object.entries(source)) {
    if (typeof value !== 'string') throw new Error('env must be an object whose values are strings');
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
 * The backend transport from DEV_PROXY_BACKEND_TRANSPORT: unset or empty
 * means `http`; only `http` and `stdio` are accepted. Anything else throws
 * an Error naming the variable and the value — the proxy used to fall
 * through to the since-removed legacy transport's client for any
 * unrecognised value, so a typo connected over the wrong transport
 * without a word.
 *
 * @param {string | undefined} raw
 * @returns {'http' | 'stdio'}
 */
export function resolveBackendTransport(raw) {
  if (raw === undefined || raw === '') return 'http';
  if (raw === 'http' || raw === 'stdio') return raw;
  throw new Error(
    `DEV_PROXY_BACKEND_TRANSPORT value '${raw}' is not a backend transport; give 'http' (default) or 'stdio'`
  );
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

/**
 * The proxy's defaults for its backend, under the inherited environment so the
 * user's own setting always wins (issue #1025, step 2): one client, and the
 * proxy's lifetime is the backend's, so the per-debug-session idle policy
 * (30 min on http) is off unless the environment says otherwise — it would
 * close a developer's paused session under them.
 *
 * @param {Record<string, string | undefined>} inherited
 * @returns {Record<string, string | undefined>}
 */
export function withBackendDefaults(inherited) {
  return { MCP_DEBUG_SESSION_IDLE_MS: '0', ...inherited };
}
