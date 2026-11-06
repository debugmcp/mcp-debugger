/**
 * The policy every non-root connection of a worker runs (issues #501, #1082).
 *
 * A policy that adopts the program itself as a pending target (js-debug,
 * `supportsReverseStartDebugging`) must never do so again on the connections
 * it opens for that target, for a fork, or for a throwaway release: a nested
 * ChildSessionManager would route `pause`/`stackTrace` into a child that
 * never exists and adopt a grandchild in-session. So those connections run
 * the same policy with in-session adoption and child routing switched off,
 * and with every process the adapter reports on them read as a child report
 * of the session tree (`childAdoption.readChildReport`), handed to the worker
 * unanswered — a fork is reported on the program's connection, a grandchild
 * on the fork's (docs/javascript/spike-notes-forks.md).
 *
 * A policy without in-session adoption (debugpy) is returned as it is: its
 * connections already report through the contract.
 */
import type { AdapterPolicy, DapClientBehavior } from '@debugmcp/shared';

export function createChildSafePolicy(policy: AdapterPolicy): AdapterPolicy {
  if (!policy.supportsReverseStartDebugging) {
    return policy;
  }
  const contract = policy.childAdoption;

  return {
    ...policy,
    supportsReverseStartDebugging: false,
    childSessionStrategy: 'none',
    getDapClientBehavior: (): DapClientBehavior => {
      const baseBehavior = policy.getDapClientBehavior();
      const behavior: DapClientBehavior = {
        ...baseBehavior,
        childRoutedCommands: new Set<string>(),
        mirrorBreakpointsToChild: false,
        pauseAfterChildAttach: false,
        stackTraceRequiresChild: false,
        // Child/release connections talk to the real target directly — they
        // must never self-gate on child availability (issue #513)
        childRequiredCommands: new Set<string>()
      };

      const baseHandle = baseBehavior.handleReverseRequest;
      if (baseHandle || contract) {
        behavior.handleReverseRequest = async (request, context) => {
          // A process reported on this connection is a child of the session
          // the connection serves (issue #1082): held by the worker, never
          // adopted here and never answered here.
          const childReport = contract?.readChildReport(request);
          if (childReport) {
            return { handled: true, childReport };
          }
          if (!baseHandle) {
            return { handled: false };
          }
          const result = await baseHandle(request, context);
          if (!result.handled) {
            return result;
          }
          // Never adopt in-session on a non-root connection.
          return { handled: true };
        };
      }

      return behavior;
    }
  };
}
