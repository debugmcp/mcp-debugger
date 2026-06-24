/**
 * Adapter spawn-failure detection for e2e smoke tests.
 *
 * A language adapter's debug binary (e.g. CodeLLDB's `codelldb.exe`, Delve's
 * `dlv`) is spawned by the proxy at `start_debugging` time. When that binary is
 * missing, not executable, or blocked by an OS policy, Node's `child_process`
 * surfaces an opaque error — most notably `spawn UNKNOWN` on Windows when
 * Smart App Control blocks an unsigned binary. These are ENVIRONMENTAL
 * conditions, not product bugs, so a smoke test should SKIP with a clear reason
 * rather than hard-fail with an inscrutable message.
 *
 * Observed real message (Windows SAC blocking the vendored CodeLLDB):
 *   "Critical initialization error: spawn UNKNOWN [Adapter command: ...
 *    codelldb.exe --port 60849 --liblldb ...liblldb.dll | adapter PID=none ...]"
 *
 * The signatures below are deliberately HIGH-SIGNAL: bare substrings like
 * "not found"/"unknown"/"blocked" are excluded because they also appear in
 * ordinary failures (e.g. "Session not found", "MCP error unknown") that must
 * NOT be silently skipped.
 */
export const SPAWN_BLOCKED_SIGNATURES = [
  'spawn unknown', // Windows Smart App Control blocking an unsigned binary
  'spawn enoent', // adapter binary not found on PATH / at resolved path
  'spawn eacces', // adapter binary present but not executable
  'enoent', // generic "no such file or directory"
  'eacces', // generic permission denied
  'application control', // SAC human-readable policy message
  'not executable',
  'permission denied'
] as const;

/**
 * Pull a lowercased message out of a parsed tool result, a thrown Error, or a
 * raw string, so detection works whether `start_debugging` returned a failure
 * object or the SDK call threw.
 */
export function extractSpawnMessage(source: unknown): string {
  if (!source) return '';
  if (typeof source === 'string') return source.toLowerCase();
  if (source instanceof Error) return source.message.toLowerCase();
  if (typeof source === 'object') {
    const record = source as { message?: unknown; error?: unknown };
    const text = record.message ?? record.error ?? '';
    return String(text).toLowerCase();
  }
  return '';
}

/**
 * True when `source` looks like the debug adapter binary failed to spawn for an
 * environmental reason (missing / not executable / OS-policy-blocked) rather
 * than a genuine product defect.
 */
export function isAdapterSpawnBlocked(source: unknown): boolean {
  const message = extractSpawnMessage(source);
  if (!message) return false;
  return SPAWN_BLOCKED_SIGNATURES.some((signature) => message.includes(signature));
}

/** Minimal structural shape of the Vitest test context's `skip`. */
export interface SkippableContext {
  // The string-note overload throws (returns `never`), aborting the test as skipped.
  skip: (note?: string) => never;
}

/**
 * If `source` indicates the adapter binary could not be spawned, skip the
 * current test with a clear diagnostic instead of letting it hard-fail with an
 * opaque error.
 *
 * `ctx` is the Vitest test context (the argument passed to the `it`/`test`
 * callback). Note: `ctx.skip(note)` THROWS to abort the test, so this function
 * does not return when it skips — never wrap the call in a try/catch.
 *
 * @returns `false` when not spawn-blocked (caller proceeds to its normal
 *          assertions / failure handling). Throws (skips) otherwise.
 */
export function skipIfSpawnBlocked(
  ctx: SkippableContext,
  source: unknown,
  adapterName: string
): boolean {
  if (!isAdapterSpawnBlocked(source)) {
    return false;
  }
  const detail = extractSpawnMessage(source);
  ctx.skip(
    `${adapterName} adapter could not be spawned (binary missing, not executable, ` +
      `or blocked by an OS policy such as Windows Smart App Control) — skipping. ` +
      `Detail: ${detail}`
  );
}
