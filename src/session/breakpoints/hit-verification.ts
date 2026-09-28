/**
 * Breakpoint binding bookkeeping shared by every writer of a breakpoint's
 * verified state and bound location (issue #673): the DAP `breakpoint` event
 * handler, the setBreakpoints response merge, the per-launch reset, and the
 * "hit implies bound" upgrade driven by `stopped.hitBreakpointIds`.
 *
 * One rule for locations, applied everywhere: `file`/`line` keep describing
 * the request; when the adapter binds the breakpoint in a *different* file —
 * a source-mapped `src/x.ts` request js-debug verifies under its generated
 * `dist/x.js` — the bound location is reported beside it as
 * `boundFile`/`boundLine` and `line` is left alone. A same-file answer moves
 * `line` in place (the adapter snapped to the next statement) and clears the
 * pair.
 *
 * One rule for provenance: a stop that names a breakpoint's id proves it is
 * bound whatever the adapter said, or never said, about it. Such a record
 * carries `verifiedBy: 'hit'`, and an adapter answer of "unbound" for it is
 * not evidence it stopped firing — js-debug answers exactly that on every
 * replace-all for a `node_modules` location it cannot map to a UI location,
 * while the CDP breakpoint underneath keeps firing.
 */
import type { Breakpoint, FunctionBreakpoint } from '@debugmcp/shared';
import { isProvisionalBreakpointMessage, normalizeBreakpointMessage } from '../../utils/breakpoint-message.js';
import type { ManagedSession } from '../session-store.js';

const windowsPathish = /^[a-z]:[\\/]/i;

/**
 * Whether two breakpoint paths name the same file. Windows-style paths
 * compare case-insensitively with separators folded: adapters canonicalize
 * differently (js-debug lowercases the drive letter and emits backslashes)
 * and a caller may well have asked with forward slashes (#236, #673).
 */
export function samePath(a: string, b: string): boolean {
  if (a === b) {
    return true;
  }
  if (!windowsPathish.test(a) || !windowsPathish.test(b)) {
    return false;
  }
  const fold = (p: string) => p.toLowerCase().replace(/\\/g, '/');
  return fold(a) === fold(b);
}

/**
 * Record where the adapter bound a line breakpoint. `sourcePath` and `line`
 * are whatever the adapter's response entry or event carried (either may be
 * absent — js-debug's unbind event carries neither).
 */
export function applyBoundLocation(
  record: Breakpoint,
  sourcePath: string | undefined,
  line: number | undefined
): void {
  if (sourcePath !== undefined && !samePath(record.file, sourcePath)) {
    record.boundFile = sourcePath;
    if (typeof line === 'number') {
      record.boundLine = line;
    }
    return;
  }
  if (typeof line === 'number') {
    record.line = line;
  }
  if (sourcePath !== undefined) {
    // Bound in the requested file: the pair would only restate `line`.
    record.boundFile = undefined;
    record.boundLine = undefined;
  }
}

/** A new adapter instance has verified nothing yet: forget every binding fact. */
export function resetBinding(record: Breakpoint | FunctionBreakpoint): void {
  record.verified = false;
  record.verifiedBy = undefined;
  record.message = undefined;
  record.messageOrigin = undefined;
  record.adapterId = undefined;
  record.boundFile = undefined;
  record.boundLine = undefined;
}

/**
 * The hit-proven rule (issue #673): a stop already proved this record bound,
 * so an adapter answer of "unbound" for it is not evidence it stopped firing
 * — js-debug answers that on every replace-all for a location it cannot map
 * to a source while the breakpoint underneath keeps firing. The id is kept
 * current when the answer's id space is the record's (`acceptId`, default
 * true) and nothing else changes. Returns true when the answer was absorbed
 * this way; the caller then skips its usual stamping.
 */
export function keepHitProven(
  record: Breakpoint | FunctionBreakpoint,
  answer: { verified?: boolean; id?: number },
  options: { acceptId?: boolean } = {}
): boolean {
  if (answer.verified !== false || record.verifiedBy !== 'hit') {
    return false;
  }
  if (typeof answer.id === 'number' && options.acceptId !== false) {
    record.adapterId = answer.id;
  }
  return true;
}

/**
 * Store the adapter's own verdict on the record, normalized for its current
 * `verified` state (issue #471): it displaces whatever note was there,
 * a stamped refusal included (#754).
 */
export function setAdapterMessage(
  record: Breakpoint | FunctionBreakpoint,
  message: string | undefined,
  verified: boolean
): void {
  record.message = normalizeBreakpointMessage(message, verified);
  record.messageOrigin = undefined;
}

/**
 * Re-settle the stored note after `verified` changed without a fresh adapter
 * message: a provisional "unbound" note or a stamped refusal cannot outlive
 * the verification that contradicts it (issues #471, #754); any other note —
 * capability drift, a re-resolved anchor — passes through.
 */
export function settleStoredMessage(record: Breakpoint | FunctionBreakpoint): void {
  if (record.verified && record.messageOrigin === 'refusal') {
    record.message = undefined;
    record.messageOrigin = undefined;
    return;
  }
  record.message = normalizeBreakpointMessage(record.message, record.verified);
}

/**
 * Stamp the adapter's refusal of a re-send onto an unverified record (issue
 * #754) where it displaces nothing curated: an absent note, a provisional
 * one, an earlier refusal — marked, or the same words the pre-launch echo
 * (#750) stamped unmarked. A curated note (capability drift, a re-resolved
 * anchor) stays; the refusal still reaches the caller through the warning.
 */
export function stampRefusalMessage(record: Breakpoint | FunctionBreakpoint, refusal: string): void {
  const current = record.message;
  const replaceable =
    current === undefined ||
    isProvisionalBreakpointMessage(current) ||
    record.messageOrigin === 'refusal' ||
    current === refusal;
  if (!replaceable) {
    return;
  }
  record.message = normalizeBreakpointMessage(refusal, false);
  record.messageOrigin = 'refusal';
}

export interface HitUpgrade {
  kind: 'line' | 'function';
  breakpoint: Breakpoint | FunctionBreakpoint;
  adapterId: number;
}

/**
 * Upgrade every unverified line or function breakpoint a stop's
 * `hitBreakpointIds` resolves to (by `adapterId`; the child's provisional ids
 * are stamped there as soon as its replay answers). A provisional "unbound"
 * message cannot outlive the hit that disproves it; any other note (a stale
 * content anchor reported at restart) is kept. Upgrade-only: verified records
 * are untouched, unknown or non-numeric ids are ignored.
 */
export function applyHitBreakpointIds(
  session: Pick<ManagedSession, 'breakpoints' | 'functionBreakpoints'>,
  hitBreakpointIds: readonly unknown[]
): HitUpgrade[] {
  const upgraded: HitUpgrade[] = [];
  const lineBreakpoints = Array.from(session.breakpoints.values());
  const functionBreakpoints = Array.from(session.functionBreakpoints?.values() ?? []);
  for (const id of hitBreakpointIds) {
    if (typeof id !== 'number') {
      continue;
    }
    const line = lineBreakpoints.find(bp => bp.adapterId === id);
    if (line) {
      if (!line.verified) {
        line.verified = true;
        line.verifiedBy = 'hit';
        settleStoredMessage(line);
        upgraded.push({ kind: 'line', breakpoint: line, adapterId: id });
      }
      continue;
    }
    const fn = functionBreakpoints.find(bp => bp.adapterId === id);
    if (fn && !fn.verified) {
      fn.verified = true;
      fn.verifiedBy = 'hit';
      settleStoredMessage(fn);
      upgraded.push({ kind: 'function', breakpoint: fn, adapterId: id });
    }
  }
  return upgraded;
}
