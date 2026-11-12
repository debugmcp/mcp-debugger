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
import type { ChildReleaseCause, ManagedSession } from '../session-store.js';
import type { TreeAnswerFields } from '../session-manager-core.js';
import { MAX_CHILD_SESSIONS_ENV } from '../child-session-cap.js';

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

/** The causes in the order a sentence lists them. */
const RELEASE_CAUSES: readonly ChildReleaseCause[] = ['adoption-off', 'cap', 'unsupported', 'adoption-failed'];

function describeReleaseCause(cause: ChildReleaseCause, cap: number | undefined): string {
  switch (cause) {
    case 'adoption-off':
      return `child sessions are off: ${MAX_CHILD_SESSIONS_ENV}=0`;
    case 'cap':
      // Worded as a limit, not as `NAME=32`: 32 is the default, and nobody set it.
      return `the tree is at its child-session cap${cap !== undefined ? ` of ${cap}` : ''}, which ${MAX_CHILD_SESSIONS_ENV} raises`;
    case 'unsupported':
      return 'this session cannot host child sessions';
    case 'adoption-failed':
      return "its adoption failed; the server log has the adapter's error";
  }
}

/**
 * What `childrenReleased` means, in one sentence (issue #1137): how many
 * child processes the run released, that they run undebugged, why — the
 * setting by name when one decided it — and what follows for the caller: a
 * breakpoint only such a child reaches will not hit, whatever a pending
 * answer says is armed. Built from the same record as the number, so the two
 * cannot disagree. Undefined when the run released none.
 */
export function describeReleasedChildren(
  session: Pick<ManagedSession, 'releasedChildReports' | 'releasedChildCauses' | 'releasedChildCap'>
): string | undefined {
  const count = session.releasedChildReports ?? 0;
  if (count <= 0) {
    return undefined;
  }
  const causes = RELEASE_CAUSES.filter((cause) => (session.releasedChildCauses?.[cause] ?? 0) > 0);
  const why = causes
    .map((cause) => {
      const text = describeReleaseCause(cause, session.releasedChildCap);
      return causes.length > 1 ? `${session.releasedChildCauses![cause]}: ${text}` : text;
    })
    .join('; ');
  const one = count === 1;
  return (
    `${count} child process${one ? ' was' : 'es were'} released to run undebugged${why ? ` (${why})` : ''}: ` +
    `a breakpoint only ${one ? 'it reaches' : 'they reach'} will not hit.`
  );
}

/** `message` with the released-children sentence after it, when there is one. */
export function withReleasedChildren(message: string, note: string | undefined): string {
  if (!note) {
    return message;
  }
  return `${message}${/[.!?]$/.test(message) ? '' : '.'} ${note}`;
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
