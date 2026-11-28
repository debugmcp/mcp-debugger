/**
 * The facts of a run: how the program of a session tree was started
 * (issue #1214).
 *
 * A launch or an attach is called on one session, the root: launch or
 * attach, where an attach's target lives, what the adapter's transform handed
 * the engine, what the caller asked for. A child the adapter reports is
 * adopted as a session of its own (docs/architecture/session-tree.md) and is
 * never launched. Those are not facts about one process. They are facts
 * about the run, the same for every session of the tree, and they live in
 * one record the tree shares (`Run`, `session.run`). When they were fields of
 * the session, written on the root and empty on a child, a reader that asked
 * the session it was handed got "nothing was launched" for a child: a worker
 * of a test runner got a stale-build note that way, a child of a remote
 * attach was read as local, and a child's proxy-log resource named a file
 * nobody writes.
 *
 * This is the server layer's view of that record, with the two things that
 * belong to the root's row and not to the record: the root's id and the run
 * directory the tree's one worker logs into.
 */
import { proxyLogPathFor } from '../proxy/session-log-layout.js';
import type { ManagedSession, Run } from './session-store.js';

/** What the view reads off a session's row. */
export type RunFactsSource = Pick<ManagedSession, 'id' | 'parentSessionId' | 'logDir' | 'run'>;

export interface RunFacts {
  /** The tree's root: the session the launch or attach was called on. */
  rootSessionId: string;
  /** True when the root attached to a program it did not start. */
  attached: boolean;
  /** The run's recorded reason child debugging was off, not inferred from language. */
  childDebuggingOptedOut?: Run['childDebuggingOptedOut'];
  breakpointStopOccurred?: boolean;
  /** Where an attach's target lives; undefined for a launch. */
  targetLocality: Run['attachLocality'];
  /**
   * What the launch ran, after the adapter's transform. Undefined before a
   * launch, and for an attach: it debugs some other process, whatever the
   * session launched before.
   */
  launch: Run['transformedLaunch'];
  /**
   * The caller's launch request, the one a restart replays; undefined before a
   * launch, and for an attach.
   */
  request: Run['lastLaunch'];
  /**
   * The worker's log of this run: one per tree, named after the root.
   * Undefined before a run directory exists, and when the tree's root can
   * no longer be reached from this session.
   */
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

/**
 * Detect whether child-process adoption was turned off on an adapter that
 * otherwise supports it (issue #1150): either explicitly by the caller
 * (`subProcess: false` on Python launch, `autoAttachChildProcesses: false` on
 * JavaScript launch/attach) or by the JavaScript adapter's own default-off on
 * an attach (`'adapter-default'`). Python attach is excluded because
 * debugpy's subprocess tracing on attach is governed by how the target process
 * invoked `debugpy.listen`, not reliably by the attach request alone.
 */
export function detectChildDebuggingOptOut(
  language: string,
  isAttach: boolean,
  transformedConfig: Readonly<Record<string, unknown>> | undefined,
  callerConfig?: Readonly<Record<string, unknown>>
): Run['childDebuggingOptedOut'] {
  if (language === 'python' && !isAttach) {
    if (callerConfig?.subProcess === false || transformedConfig?.subProcess === false) {
      return 'subProcess: false';
    }
  }
  if (language === 'javascript') {
    if (callerConfig?.autoAttachChildProcesses === false) {
      return 'autoAttachChildProcesses: false';
    }
    if (transformedConfig?.autoAttachChildProcesses === false) {
      return isAttach ? 'adapter-default' : 'autoAttachChildProcesses: false';
    }
  }
  return undefined;
}

/** The facts of the run `session` belongs to, read off its tree's root. */
export function runFactsOf(session: RunFactsSource, get: (sessionId: string) => RunFactsSource | undefined): RunFacts {
  const root = rootOfTree(session, get);
  // The walk can end below the root: a parent's row is gone, or the chain
  // loops. What it ended on is then some child, and a log named after a
  // child is a file no worker writes (issue #1222): no path is better
  // than that one.
  const reachedRoot = root.parentSessionId === undefined;
  // The record is the tree's: the session's own reference is the root's
  // (adoption shares it), so the facts need no walk. Only the root's id
  // and its run directory still come from the root's row.
  const run = session.run;
  const attached = run.attachMode === true;
  return {
    rootSessionId: root.id,
    attached,
    ...(run.childDebuggingOptedOut ? { childDebuggingOptedOut: run.childDebuggingOptedOut } : {}),
    ...(run.breakpointStopOccurred ? { breakpointStopOccurred: true } : {}),
    targetLocality: run.attachLocality,
    launch: attached ? undefined : run.transformedLaunch,
    request: attached ? undefined : run.lastLaunch,
    proxyLogPath: reachedRoot && root.logDir ? proxyLogPathFor(root.logDir, root.id) : undefined
  };
}
