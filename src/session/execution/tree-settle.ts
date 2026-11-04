/**
 * Which session a tree-aware wait_for_stop answers for (the session tree,
 * issue #1081; docs/architecture/session-tree.md, "wait_for_stop is
 * tree-aware"). A pure read over the session and its descendants, given in
 * the rule-2 order (depth first, adoption order within a level):
 *
 *   1. the session itself when it is paused or in error;
 *   2. else the first descendant that is paused or in error;
 *   3. else the session itself when it has ended;
 *   4. else nothing: only descendants have ended and the session still runs,
 *      so the wait keeps waiting — an ended descendant alone never completes
 *      an ancestor's wait.
 *
 * Level-triggered like the single-session wait: nothing is consumed, so two
 * waiters read the same selection, and an errored descendant keeps being
 * selected until it is closed.
 */
import { SessionState, isTerminalSessionState } from '@debugmcp/shared';
import type { ManagedSession } from '../session-store.js';
import type { TreeAnswerFields } from '../session-manager-core.js';

/** The slice of a session the selection reads. */
export interface SettleCandidate {
  id: string;
  state: SessionState;
}

/**
 * The tree fields of an answer on `session`: its descendants (given depth
 * first in adoption order) with their states, and the run's count of
 * children released to run undebugged. Both absent when there is nothing to
 * say, so a session with no tree answers byte-for-byte as before.
 */
export function describeTreeAnswer(
  session: Pick<ManagedSession, 'releasedChildReports'>,
  descendants: readonly Pick<ManagedSession, 'id' | 'name' | 'state' | 'parentSessionId'>[]
): TreeAnswerFields {
  return {
    ...(descendants.length > 0
      ? {
          children: descendants.map((d) => ({
            sessionId: d.id,
            name: d.name,
            state: d.state,
            parentSessionId: d.parentSessionId ?? ''
          }))
        }
      : {}),
    ...(session.releasedChildReports ? { childrenReleased: session.releasedChildReports } : {})
  };
}

const isPausedOrErrored = (state: SessionState): boolean =>
  state === SessionState.PAUSED || state === SessionState.ERROR;

export function selectSettledInTree<T extends SettleCandidate>(session: T, descendants: readonly T[]): T | undefined {
  if (isPausedOrErrored(session.state)) {
    return session;
  }
  const settledDescendant = descendants.find((d) => isPausedOrErrored(d.state));
  if (settledDescendant) {
    return settledDescendant;
  }
  if (isTerminalSessionState(session.state)) {
    return session;
  }
  return undefined;
}
