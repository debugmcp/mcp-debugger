/**
 * How a boolean launch flag (`noDebug`, `stopOnEntry`) is read on every side
 * that decides on it: the launcher (issue #710) and the proxy worker (issue
 * #746) must reach the same answer, or a launch the launcher reports as
 * running with the debugger off waits in the worker for a configuration
 * phase that never opens. The string forms are read the way the proxy's
 * message parser coerces the top-level flags ('true'/'false' — the
 * string-typed-args transport quirk, which does not reach nested launch
 * config keys); anything else counts by truthiness, which is how the
 * adapters read it.
 */
export function coerceLaunchFlag(value: unknown): boolean {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return Boolean(value);
}
