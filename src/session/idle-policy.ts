/**
 * The per-debug-session idle policy's knobs (issue #1025, step 2).
 *
 * The 2026-07-28 protocol has no session to end a debug session with, and a
 * sessionless client gives the server no sign of life between its calls. So
 * nothing expires by default, on any transport: a debug session lives until it
 * is closed, its program ends, or the server exits — a timer that guesses
 * wrong kills a live program, while a leaked session is visible in
 * list_debug_sessions and closable by anyone. An operator who runs a shared or
 * long-lived server opts in with MCP_DEBUG_SESSION_IDLE_MS: a tree whose root
 * has seen no tool call for that window is then closed by the core's sweep
 * (SessionManagerCore.sweepIdle; `0` or unset = off). The sweep cadence is
 * MCP_DEBUG_SESSION_IDLE_SWEEP_MS. Invalid values warn and keep the default,
 * the way the HTTP reaper's knobs do.
 */
import type { IEnvironment } from '@debugmcp/shared';

export const DEBUG_SESSION_IDLE_ENV = 'MCP_DEBUG_SESSION_IDLE_MS';
export const DEBUG_SESSION_IDLE_SWEEP_ENV = 'MCP_DEBUG_SESSION_IDLE_SWEEP_MS';
/** Off: an operator turns the policy on; no transport does. */
export const DEFAULT_DEBUG_SESSION_IDLE_MS = 0;
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
    // Name the rejected setting without copying untrusted environment contents into logs.
    warn(`Ignoring invalid ${name}; using default ${fallback}ms.`);
    return fallback;
  }
  return parsed;
}

export function resolveIdlePolicy(
  environment: Pick<IEnvironment, 'get'>,
  warn: (message: string) => void
): IdlePolicy {
  return {
    idleMs: parseMs(DEBUG_SESSION_IDLE_ENV, environment.get(DEBUG_SESSION_IDLE_ENV), DEFAULT_DEBUG_SESSION_IDLE_MS, warn, 0),
    sweepMs: parseMs(DEBUG_SESSION_IDLE_SWEEP_ENV, environment.get(DEBUG_SESSION_IDLE_SWEEP_ENV), DEFAULT_DEBUG_SESSION_IDLE_SWEEP_MS, warn, 1)
  };
}

/**
 * What an expiry leaves behind for the agent that comes back (issue #1025):
 * one record per session the sweep closed, the root's descendants included.
 */
export interface IdleExpiryRecord {
  readonly sessionId: string;
  /** The root whose clock ran out; the session itself when it was the root. */
  readonly rootId: string;
  /** The owner scope the session was in; absent = the shared anonymous scope. */
  readonly ownerKey?: string;
  readonly closedAt: number;
  /** How long the tree had gone without a tool call when it was closed. */
  readonly idleMs: number;
  readonly windowMs: number;
  /**
   * What the close did to the program: a launched one is `ended`, an attached
   * one `released`. `closed` when there was none to act on — the session never
   * launched, or its program was already over when the policy came for it.
   */
  readonly outcome: 'ended' | 'released' | 'closed';
}

const OUTCOME_SENTENCE: Record<IdleExpiryRecord['outcome'], string> = {
  ended: 'Its program was ended.',
  released: 'The process it was attached to was released and keeps running.',
  closed: 'It had no running program by then.'
};

/** How many expiry records the core keeps; the oldest go first. */
export const IDLE_EXPIRY_RECORD_LIMIT = 200;

/** The sentence a tool call naming an expired session answers with. */
export function describeIdleExpiry(record: IdleExpiryRecord): string {
  const who = record.sessionId === record.rootId
    ? `Session ${record.sessionId}`
    : `Session ${record.sessionId} (in the tree of ${record.rootId})`;
  // The idle time in the unit the window is stated in, so the two read together.
  const idle = record.windowMs % 60_000 === 0
    ? `${Math.floor(record.idleMs / 60_000)} min`
    : `${Math.round(record.idleMs / 1000)} s`;
  return `${who} was closed by the idle policy at ${new Date(record.closedAt).toISOString()}: ` +
    `no tool call named it or its tree for ${idle} ` +
    `(the window is ${describeIdleWindow(record.windowMs)}, ${DEBUG_SESSION_IDLE_ENV}=${record.windowMs}). ` +
    `${OUTCOME_SENTENCE[record.outcome]} Create a new session to continue.`;
}

/** How long a window is, in the unit a reader thinks in. */
export function describeIdleWindow(ms: number): string {
  if (ms <= 0) return 'off';
  return ms % 60_000 === 0 ? `${ms / 60_000} min` : `${Math.round(ms / 1000)} s`;
}
