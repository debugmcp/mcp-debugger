/**
 * Provisional adapter-id bookkeeping and "hit implies bound" (issue #673).
 *
 * Child-mirroring adapters (js-debug) answer a stored breakpoint first with a
 * provisional stub — `verified: false`, a child-space integer id — and only
 * later, if ever, with a `breakpoint` event that verifies it. Two things go
 * wrong on the launch path without this table:
 *
 * - A source-mapped request (`src/x.ts:349`) is verified by an event whose
 *   `source.path`/`line` are the *generated* location (`dist/x.js:277`), so
 *   neither the adapterId lookup (never stamped for a provisional stub, #495)
 *   nor the (file,line) fallback can find the record, and the verification
 *   is dropped.
 * - A breakpoint the child never sends an event for at all (observed for a
 *   `node_modules` file) is only ever proven bound by the `stopped` event
 *   that names its id in `hitBreakpointIds`.
 *
 * The table maps the child's provisional id to the store uuid so those two
 * signals can be applied. It is written only from child-origin sources — the
 * parent session's ids share the same integer space and collide (#495) — and
 * read only to *upgrade* a record; downgrades still require a trusted
 * `adapterId`. Entries whose record has since been removed are dropped on
 * lookup, so removal paths need no bookkeeping of their own.
 *
 * The table is populated by the child's replay of the stored breakpoints
 * (`ChildSessionManager.emitBreakpointResults` synthesizes one child-origin
 * event per echoed entry) and by a child-sourced `setBreakpoints` response.
 * A replay the child answers with js-debug's empty no-change echo leaves the
 * table empty — then the hit-upgrade is the only path, and it needs no table
 * when the record already carries an `adapterId`.
 */
import type { Breakpoint, FunctionBreakpoint } from '@debugmcp/shared';
import type { ManagedSession } from '../session-store.js';

type ProvisionalIdSession = Pick<ManagedSession, 'breakpoints' | 'provisionalAdapterIds'>;
type HitSession = Pick<ManagedSession, 'breakpoints' | 'functionBreakpoints' | 'provisionalAdapterIds'>;

export function recordProvisionalAdapterId(
  session: ProvisionalIdSession,
  adapterId: number,
  storeId: string
): void {
  (session.provisionalAdapterIds ??= new Map()).set(adapterId, storeId);
}

/**
 * The stored breakpoint a provisional id was recorded for, or undefined. A
 * mapping whose record no longer exists (removed since) is forgotten here.
 */
export function resolveProvisionalAdapterId(
  session: ProvisionalIdSession,
  adapterId: number
): Breakpoint | undefined {
  const storeId = session.provisionalAdapterIds?.get(adapterId);
  if (storeId === undefined) {
    return undefined;
  }
  const breakpoint = session.breakpoints.get(storeId);
  if (!breakpoint) {
    session.provisionalAdapterIds?.delete(adapterId);
  }
  return breakpoint;
}

/** A new adapter instance has verified nothing yet: its ids mean nothing here. */
export function clearProvisionalAdapterIds(session: ProvisionalIdSession): void {
  session.provisionalAdapterIds = undefined;
}

export interface HitUpgrade {
  kind: 'line' | 'function';
  breakpoint: Breakpoint | FunctionBreakpoint;
  adapterId: number;
}

/**
 * A stop that names a breakpoint id proves the breakpoint is bound, whatever
 * the adapter said (or never said) before. Upgrade every unverified record the
 * ids resolve to — by `adapterId` for any adapter, or through the provisional
 * table for child ids — and drop the now-obsolete "unbound"/"pending" message.
 * Upgrade-only: verified records are untouched, unknown ids are ignored.
 */
export function applyHitBreakpointIds(
  session: HitSession,
  hitBreakpointIds: readonly unknown[]
): HitUpgrade[] {
  const upgraded: HitUpgrade[] = [];
  const lineBreakpoints = Array.from(session.breakpoints.values());
  const functionBreakpoints = Array.from(session.functionBreakpoints?.values() ?? []);
  for (const id of hitBreakpointIds) {
    if (typeof id !== 'number') {
      continue;
    }
    const line =
      lineBreakpoints.find(bp => bp.adapterId === id) ??
      resolveProvisionalAdapterId(session, id);
    if (line) {
      if (!line.verified) {
        line.verified = true;
        line.adapterId = id;
        line.message = undefined;
        upgraded.push({ kind: 'line', breakpoint: line, adapterId: id });
      }
      continue;
    }
    const fn = functionBreakpoints.find(bp => bp.adapterId === id);
    if (fn && !fn.verified) {
      fn.verified = true;
      fn.message = undefined;
      upgraded.push({ kind: 'function', breakpoint: fn, adapterId: id });
    }
  }
  return upgraded;
}
