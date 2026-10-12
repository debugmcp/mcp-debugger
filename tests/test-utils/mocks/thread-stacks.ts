/**
 * A DAP request handler that answers `threads` with a fixed list and
 * `stackTrace` from a per-thread record — the shape every stop-anchor test
 * needs (issue #904). It fits both proxy doubles: `MockProxyManager.setDapRequestHandler`
 * and a `ProxyManagerMocks` `sendDapRequest.mockImplementation`.
 */
import type { DebugProtocol } from '@vscode/debugprotocol';

export interface ThreadStacksOptions {
  /**
   * Runs on every `threads` answer, before it is returned — the place a test
   * plants the stop that races the thread list (state + lastStop), the way an
   * attach observes it.
   */
  onThreads?: () => void;
  /** Thread ids whose `stackTrace` rejects, as a running or runtime thread's does. */
  rejecting?: number[];
}

export type ThreadStacks = Record<number, unknown[]>;

export function threadStacksHandler(
  stacks: ThreadStacks,
  threads: DebugProtocol.Thread[],
  options: ThreadStacksOptions = {}
): (command: string, args?: unknown) => Promise<unknown> {
  return async (command: string, args?: unknown) => {
    if (command === 'threads') {
      options.onThreads?.();
      return { success: true, body: { threads } };
    }
    if (command === 'stackTrace') {
      const { threadId } = (args ?? {}) as { threadId?: number };
      if (typeof threadId === 'number' && options.rejecting?.includes(threadId)) {
        throw new Error(`thread ${threadId} is running`);
      }
      return { success: true, body: { stackFrames: stacks[threadId ?? -1] ?? [] } };
    }
    return { success: true, body: {} };
  };
}
