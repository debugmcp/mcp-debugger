/**
 * The facts of a run: how the program of a session tree was started
 * (issue #1214).
 *
 * A launch or an attach is called on one session, and what it decides is
 * written there: launch or attach, where an attach's target lives, what the
 * adapter's transform handed the engine, what the caller asked for, the run
 * directory the worker logs into. A child the adapter reports is adopted as a
 * session of its own (docs/architecture/session-tree.md) and is never
 * launched: it has none of those fields. They are not facts about one
 * process. They are facts about the run, the same for every session of the
 * tree, and a reader that asks the session it was handed gets "nothing was
 * launched" for a child. A worker of a test runner got a stale-build note
 * that way (the check took it for a session before its launch), a child of a
 * remote attach was read as local, and a child's proxy-log resource named a
 * file nobody writes.
 *
 * So outside the modules that write those fields, they are read here, off
 * the tree's root (`tests/unit/architecture/run-facts-seam.test.ts`).
 */
import { proxyLogPathFor } from '../proxy/session-log-layout.js';
import type { ManagedSession } from './session-store.js';

export interface RunFacts {
  /** The tree's root: the session the launch or attach was called on. */
  rootSessionId: string;
  /** True when the root attached to a program it did not start. */
  attached: boolean;
  /** Where an attach's target lives; undefined for a launch. */
  targetLocality: ManagedSession['attachLocality'];
  /**
   * What the launch ran, after the adapter's transform. Undefined before a
   * launch, and for an attach: it debugs some other process, whatever the
   * session launched before.
   */
  launch: ManagedSession['transformedLaunch'];
  /** The caller's launch request, the one a restart replays; undefined before a launch. */
  request: ManagedSession['lastLaunch'];
  /** The worker's log of this run: one per tree, named after the root. Undefined before a run directory exists. */
  proxyLogPath: string | undefined;
}

type TreeNode = Pick<ManagedSession, 'id' | 'parentSessionId'>;

/**
 * The launch or attach root of a session's tree: the top of its
 * `parentSessionId` chain, or the highest ancestor that still has a row. A
 * lookup that throws for an id reads as "no row".
 */
export function rootOfTree<T extends TreeNode>(session: T, get: (sessionId: string) => T | undefined): T {
  let current = session;
  const seen = new Set<string>([current.id]);
  while (current.parentSessionId) {
    let parent: T | undefined;
    try {
      parent = get(current.parentSessionId);
    } catch {
      parent = undefined;
    }
    if (!parent || seen.has(parent.id)) {
      break;
    }
    seen.add(parent.id);
    current = parent;
  }
  return current;
}

/** The facts of the run `session` belongs to, read off its tree's root. */
export function runFactsOf(session: ManagedSession, get: (sessionId: string) => ManagedSession | undefined): RunFacts {
  const root = rootOfTree(session, get);
  const attached = root.attachMode === true;
  return {
    rootSessionId: root.id,
    attached,
    targetLocality: root.attachLocality,
    launch: attached ? undefined : root.transformedLaunch,
    request: root.lastLaunch,
    proxyLogPath: root.logDir ? proxyLogPathFor(root.logDir, root.id) : undefined
  };
}
