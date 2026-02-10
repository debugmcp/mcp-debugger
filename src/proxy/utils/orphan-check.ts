/**
 * Orphan exit decision helper.
 * Correctly handles container environments where PPID=1 is expected.
 */

/**
 * Decide if the proxy should exit as "orphaned".
 * Returns true only when the parent PID is 1 (indicating an orphaned process)
 * AND we are NOT running inside a container (where PPID=1 is normal).
 */
export function shouldExitAsOrphan(ppid: number, inContainer: boolean): boolean {
  // Fixed behavior: in containers (PID namespaces), PPID=1 is expected; do not exit
  return !inContainer && ppid === 1;
}

/**
 * Convenience helper that reads the container flag from env.
 */
export function shouldExitAsOrphanFromEnv(
  ppid: number,
  env: NodeJS.ProcessEnv = process.env
): boolean {
  const inContainer = env.MCP_CONTAINER === 'true';
  return shouldExitAsOrphan(ppid, inContainer);
}
