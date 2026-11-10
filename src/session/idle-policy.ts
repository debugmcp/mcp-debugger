/**
 * The per-debug-session idle policy's knobs (issue #1025, step 2).
 *
 * The 2026-07-28 protocol has no session to end a debug session with, so a
 * tree whose root has seen no tool call for the window is closed by the core's
 * sweep (SessionManagerCore.sweepIdle). The window defaults per transport —
 * thirty minutes in `http`, off in `stdio`, where the pipe is the lifetime —
 * and MCP_DEBUG_SESSION_IDLE_MS overrides either (`0` disables). The sweep
 * cadence is MCP_DEBUG_SESSION_IDLE_SWEEP_MS. Invalid values warn and keep
 * the default, the way the HTTP reaper's knobs do.
 */
import type { IEnvironment } from '@debugmcp/shared';

export const DEBUG_SESSION_IDLE_ENV = 'MCP_DEBUG_SESSION_IDLE_MS';
export const DEBUG_SESSION_IDLE_SWEEP_ENV = 'MCP_DEBUG_SESSION_IDLE_SWEEP_MS';
export const DEFAULT_DEBUG_SESSION_IDLE_SWEEP_MS = 60_000;

export interface IdlePolicy {
  /** The idle window in ms; 0 = the policy is off. */
  readonly idleMs: number;
  /** How often the sweep runs, in ms; always > 0. */
  readonly sweepMs: number;
}

function parseMs(
  name: string,
  raw: string | undefined,
  fallback: number,
  warn: (message: string) => void,
  minimum: number
): number {
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < minimum) {
    warn(`Ignoring invalid ${name} value "${raw}"; using default ${fallback}ms.`);
    return fallback;
  }
  return parsed;
}

export function resolveIdlePolicy(
  environment: Pick<IEnvironment, 'get'>,
  defaults: { idleMs: number },
  warn: (message: string) => void
): IdlePolicy {
  return {
    idleMs: parseMs(DEBUG_SESSION_IDLE_ENV, environment.get(DEBUG_SESSION_IDLE_ENV), defaults.idleMs, warn, 0),
    sweepMs: parseMs(DEBUG_SESSION_IDLE_SWEEP_ENV, environment.get(DEBUG_SESSION_IDLE_SWEEP_ENV), DEFAULT_DEBUG_SESSION_IDLE_SWEEP_MS, warn, 1)
  };
}

/** How long a window is, in the unit a reader thinks in. */
export function describeIdleWindow(ms: number): string {
  if (ms <= 0) return 'off';
  return ms % 60_000 === 0 ? `${ms / 60_000} min` : `${Math.round(ms / 1000)} s`;
}
