/**
 * Share one bounded discovery wait across requests, including ones arriving
 * before backend.start() is called. Timing out does not cancel startup; later
 * requests can discover the backend once it becomes healthy.
 * @param {number} timeoutMs
 */
export function createInitialStartupGate(timeoutMs) {
  let complete = () => {};
  const ready = new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), timeoutMs);
    timer.unref?.();
    complete = () => {
      clearTimeout(timer);
      resolve(true);
    };
  });
  return { ready, complete };
}
