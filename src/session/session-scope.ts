/**
 * The scope a tool call runs in (issue #1025, step 2): for a caller, a debug
 * session outside its owner scope does not exist.
 *
 * The dispatch does not answer for such a session itself — an answer of its
 * own would differ from each tool's real unknown-id answer, and the difference
 * is the leak. It runs the tool's handler inside this scope instead, and the
 * session store's read accessors report the named session absent for that
 * call's async chain only, so every tool gives its own not-found answer by
 * construction, argument checks and all. Calls by the session's owner, the
 * idle sweep and the event handlers run outside any scope and see it.
 */
import { AsyncLocalStorage } from 'node:async_hooks';

const hiddenSession = new AsyncLocalStorage<string>();

/** Run `work` with `sessionId` absent from every session lookup it makes. */
export function runWithSessionHidden<T>(sessionId: string, work: () => T): T {
  return hiddenSession.run(sessionId, work);
}

/** Whether the current call must not see this session. */
export function isSessionHidden(sessionId: string): boolean {
  return hiddenSession.getStore() === sessionId;
}
