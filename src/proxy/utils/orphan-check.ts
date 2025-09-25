/**
 * Orphan exit decision helper.
 * NOTE: This intentionally mirrors the current buggy behavior in proxy-bootstrap
 * so that the unit test will FAIL and catch the regression when running `pnpm test`.
 * We will fix this implementation after confirming the failing test.
 */

/**
 * Decide if the proxy should exit as "orphaned".
 * Current buggy behavior: exit when PPID is 1 regardless of container environment.
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
