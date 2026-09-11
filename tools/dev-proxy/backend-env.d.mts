/**
 * Types for `backend-env.mjs`, so its TypeScript tests see a real API instead
 * of `@ts-ignore`-ing the import into `any` (issue #562).
 */

/**
 * Replace backend overrides only when a tool call explicitly supplies `env`.
 * Omission returns `current` unchanged (by identity); an empty `env` clears it.
 *
 * @param current the override map held by the proxy
 * @param args raw tool-call arguments, inspected only for an own `env` property
 */
export function updateBackendEnvOverrides(
  current: Record<string, string>,
  args: Record<string, unknown> | null | undefined
): Record<string, string>;

/**
 * Merge persistent overrides over the proxy's inherited environment. Forced
 * supervisor variables are applied last and therefore cannot be overridden.
 *
 * Neither input is mutated.
 */
export function buildBackendEnvironment(
  inherited: Record<string, string | undefined>,
  overrides: Record<string, string>,
  forced?: Record<string, string>
): Record<string, string | undefined>;
