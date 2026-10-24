/**
 * Stop-snapshot opt-out flag (issue #982).
 *
 * Every PAUSED tool answer carries a bounded `snapshot` (exception, top
 * frames, locals) by default — the point is that reading crash state costs
 * zero extra tool calls. DEBUG_MCP_NO_SNAPSHOT=1 (or 'true') turns the
 * snapshot off for clients that want minimal answers. Read once at server
 * construction; changing it requires a server restart, same as
 * DEBUG_MCP_NO_REDACT.
 */

export const SNAPSHOT_ENV_KEY = 'DEBUG_MCP_NO_SNAPSHOT';

const DISABLE_VALUES: ReadonlySet<string> = new Set(['1', 'true']);

/**
 * True unless the environment explicitly opts out. Unset, empty, or
 * unrecognized values keep the snapshot enabled.
 */
export function isSnapshotEnabled(environment: {
  get(key: string): string | undefined;
}): boolean {
  const raw = environment.get(SNAPSHOT_ENV_KEY)?.trim().toLowerCase();
  return !(raw !== undefined && DISABLE_VALUES.has(raw));
}
