/**
 * Orphan exit decision helper.
 */

/**
 * Decide if the proxy should exit as "orphaned".
 * In containers (PID namespaces), PPID=1 is expected and does not indicate orphaning.
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
