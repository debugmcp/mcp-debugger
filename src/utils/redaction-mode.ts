/**
 * Secret-redaction opt-out flag (issue #237).
 *
 * Redaction of credential-shaped values in tool results is ON by default —
 * the server is a security boundary between the debuggee and the AI agent.
 * DEBUG_MCP_NO_REDACT=1 (or 'true') disables it for local debugging of
 * secrets themselves ("why is my token empty?" sessions). Read once at
 * server construction; changing it requires a server restart, same as
 * DEBUG_MCP_BP_ADDRESSING.
 */

export const REDACTION_ENV_KEY = 'DEBUG_MCP_NO_REDACT';

const DISABLE_VALUES: ReadonlySet<string> = new Set(['1', 'true']);

/**
 * True unless the environment explicitly opts out. Unset, empty, or
 * unrecognized values keep redaction enabled.
 */
export function isRedactionEnabled(environment: {
  get(key: string): string | undefined;
}): boolean {
  const raw = environment.get(REDACTION_ENV_KEY)?.trim().toLowerCase();
  return !(raw !== undefined && DISABLE_VALUES.has(raw));
}
