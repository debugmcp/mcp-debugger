/**
 * Promise tracking utility for debugging leaked promises in tests
 */

interface TrackedPromise {
  promiseId: string;
  sessionId: string;
  testName: string;
  created: number;
  stack: string;
  resolved: boolean;
}

// Global map of active promises
const activePromises = new Map<string, TrackedPromise>();

// Track promise creation/resolution by session
const sessionPromises = new Map<string, Set<string>>();

/**
 * Track a new promise creation
 */
export function trackPromise(promiseId: string, sessionId: string, testName: string): void {
  const tracked: TrackedPromise = {
    promiseId,
    sessionId,
    testName,
    created: Date.now(),
    stack: new Error().stack || '',
    resolved: false
  };

  activePromises.set(promiseId, tracked);

  // Track by session
  if (!sessionPromises.has(sessionId)) {
    sessionPromises.set(sessionId, new Set());
  }
  sessionPromises.get(sessionId)!.add(promiseId);

  if (process.env.DEBUG_PROMISE_LEAKS) {
    console.log(`[PROMISE-TRACK] Created: ${promiseId} for test "${testName}" (session: ${sessionId})`);
  }
}

/**
 * Mark a promise as resolved/rejected
 */
export function resolvePromise(promiseId: string): void {
  const tracked = activePromises.get(promiseId);
  if (tracked) {
    tracked.resolved = true;

    if (process.env.DEBUG_PROMISE_LEAKS) {
      console.log(`[PROMISE-TRACK] Resolved: ${promiseId} from test "${tracked.testName}"`);
    }
  }
}

/**
 * Remove a promise from tracking (cleanup completed)
 */
export function untrackPromise(promiseId: string): void {
  const tracked = activePromises.get(promiseId);
  if (tracked) {
    activePromises.delete(promiseId);

    // Remove from session tracking
    const sessionSet = sessionPromises.get(tracked.sessionId);
    if (sessionSet) {
      sessionSet.delete(promiseId);
      if (sessionSet.size === 0) {
        sessionPromises.delete(tracked.sessionId);
      }
    }

    if (process.env.DEBUG_PROMISE_LEAKS) {
      console.log(`[PROMISE-TRACK] Cleaned up: ${promiseId} from test "${tracked.testName}"`);
    }
  }
}

/**
 * Clean up all promises for a session
 */
export function cleanupSession(sessionId: string): void {
  const promiseIds = sessionPromises.get(sessionId);
  if (promiseIds) {
    for (const promiseId of promiseIds) {
      untrackPromise(promiseId);
    }
  }
}

/**
 * Report any leaked promises (unresolved or not cleaned up)
 */
export function reportLeakedPromises(): string[] {
  const leaks: string[] = [];
  const now = Date.now();

  for (const [promiseId, tracked] of activePromises.entries()) {
    const age = now - tracked.created;
    const status = tracked.resolved ? 'resolved but not cleaned' : 'UNRESOLVED';

    const leak = `Promise leak detected:
  ID: ${promiseId}
  Test: ${tracked.testName}
  Session: ${tracked.sessionId}
  Status: ${status}
  Age: ${age}ms
  Stack trace:
${tracked.stack}`;

    leaks.push(leak);

    if (process.env.DEBUG_PROMISE_LEAKS) {
      console.error(`[PROMISE-LEAK] ${leak}`);
    }
  }

  return leaks;
}

/**
 * Clear all tracking (for test cleanup)
 */
export function clearAllTracking(): void {
  activePromises.clear();
  sessionPromises.clear();
}

/**
 * Get statistics about tracked promises
 */
export function getPromiseStats(): {
  total: number;
  resolved: number;
  unresolved: number;
  byTest: Map<string, number>;
} {
  let resolved = 0;
  let unresolved = 0;
  const byTest = new Map<string, number>();

  for (const tracked of activePromises.values()) {
    if (tracked.resolved) {
      resolved++;
    } else {
      unresolved++;
    }

    const count = byTest.get(tracked.testName) || 0;
    byTest.set(tracked.testName, count + 1);
  }

  return {
    total: activePromises.size,
    resolved,
    unresolved,
    byTest
  };
}