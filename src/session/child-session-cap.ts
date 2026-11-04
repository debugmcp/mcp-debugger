/**
 * The per-tree cap on live child sessions (the session tree, issue #1081):
 * beyond it a reported child is released to run undebugged, and `0` turns
 * adoption off. Read through the injected environment so tests drive it.
 * `0` is a legal value here, which is why this does not reuse the variable
 * caps' reader (it rejects zero).
 */
import type { IEnvironment } from '@debugmcp/shared';

export const MAX_CHILD_SESSIONS_ENV = 'DEBUG_MCP_MAX_CHILD_SESSIONS';
export const DEFAULT_MAX_CHILD_SESSIONS = 32;

export function maxChildSessions(environment: IEnvironment): number {
  const raw = environment.get(MAX_CHILD_SESSIONS_ENV);
  if (raw === undefined || raw.trim() === '') {
    return DEFAULT_MAX_CHILD_SESSIONS;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    return DEFAULT_MAX_CHILD_SESSIONS;
  }
  return value;
}
