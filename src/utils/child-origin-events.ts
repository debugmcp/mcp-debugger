/**
 * Child-origin tagging for DAP events (issues #500/#495).
 *
 * Child-mirroring adapters (js-debug) run two DAP sessions whose breakpoint
 * ids share one integer space: the parent session answers with pessimistic
 * provisional stubs while the child session owns the runtime and the real
 * verification. Once both emit `breakpoint` events, the SessionManager cannot
 * tell them apart — a late parent stub that happens to carry the same integer
 * id as a stored child id matches by id and silently downgrades a verified
 * record (issue #495).
 *
 * These helpers stamp a private marker on event bodies at the single point
 * where child events re-enter the parent client's event stream, and strip it
 * where the SessionManager consumes the event. The dunder-key style follows
 * the existing internal markers (`__attachMode`, `__pendingTargetId`); the
 * marker rides the body through worker→ProxyManager IPC untouched and never
 * reaches stored breakpoint records.
 */

const CHILD_ORIGIN_KEY = '__mcpChildOrigin';

/** Mark an event body as originating from a child DAP session. No-op for non-objects. */
export function markChildOrigin(body: unknown): void {
  if (body !== null && typeof body === 'object') {
    (body as Record<string, unknown>)[CHILD_ORIGIN_KEY] = true;
  }
}

/**
 * Read and remove the child-origin marker from an event body.
 * Returns true when the body was marked by {@link markChildOrigin}.
 */
export function consumeChildOrigin(body: unknown): boolean {
  return consumeKey(body, CHILD_ORIGIN_KEY);
}

const CHILD_SOURCED_KEY = '__mcpChildSourced';

/**
 * Mark a DAP response as carrying the child session's authoritative body
 * (a mirrored setBreakpoints answered by the attached child, issue #500).
 * No-op for non-objects.
 */
export function markChildSourced(response: unknown): void {
  if (response !== null && typeof response === 'object') {
    (response as Record<string, unknown>)[CHILD_SOURCED_KEY] = true;
  }
}

/**
 * Read and remove the child-sourced marker from a DAP response.
 * Returns true when the response was marked by {@link markChildSourced}.
 */
export function consumeChildSourced(response: unknown): boolean {
  return consumeKey(response, CHILD_SOURCED_KEY);
}

function consumeKey(value: unknown, key: string): boolean {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  const marked = record[key] === true;
  if (key in record) {
    delete record[key];
  }
  return marked;
}
