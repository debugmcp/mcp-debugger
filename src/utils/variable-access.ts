/**
 * Least-privilege variable access mode (issue #237).
 *
 * DEBUG_MCP_VARIABLE_ACCESS gates how variables may be retrieved:
 *   - 'open':     bulk scope dumps allowed (the default)
 *   - 'explicit': get_variables / get_local_variables require a names filter —
 *                 the agent must ask for specific variables instead of
 *                 sweeping every value in scope into its context
 * Mode-style (rather than boolean) mirrors DEBUG_MCP_BP_ADDRESSING and leaves
 * room for a future stricter tier without a second flag. The mode guards
 * against indiscriminate bulk exposure, not against a determined agent:
 * evaluate_expression stays available (already explicit-by-name, per-request,
 * and audit-logged), and redaction still applies to all results.
 */

export type VariableAccessMode = 'open' | 'explicit';

export const VARIABLE_ACCESS_ENV_KEY = 'DEBUG_MCP_VARIABLE_ACCESS';

export const DEFAULT_VARIABLE_ACCESS: VariableAccessMode = 'open';

const VALID_MODES: ReadonlySet<string> = new Set(['open', 'explicit']);

/**
 * Read the access mode from the environment. Unset, empty, or invalid values
 * fall back to the shipped default ('open').
 */
export function getVariableAccessMode(environment: {
  get(key: string): string | undefined;
}): VariableAccessMode {
  const raw = environment.get(VARIABLE_ACCESS_ENV_KEY)?.trim().toLowerCase();
  if (raw && VALID_MODES.has(raw)) {
    return raw as VariableAccessMode;
  }
  return DEFAULT_VARIABLE_ACCESS;
}

export function requiresExplicitNames(mode: VariableAccessMode): boolean {
  return mode === 'explicit';
}
