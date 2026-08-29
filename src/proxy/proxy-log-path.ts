/**
 * The single home for the per-session proxy log file name.
 *
 * `proxy-<sessionId>.log` was built by hand in three places — the production
 * logger factory, the worker's own `redirectProxyLoggers` target, and the
 * session layer's failure diagnostics — so the path the diagnostics point a
 * user at was only *coincidentally* the path the proxy writes. Renaming the
 * file in one place and not the others would have produced a `proxyLogPath`
 * that never exists, with no test able to notice.
 *
 * Kept dependency-free: the worker half of this module is bundled into
 * `proxy-bundle.cjs`, so it must not pull anything but `path` in behind it.
 */
import path from 'path';

/** File name (no directory) of the proxy log for one debug session. */
export function proxyLogFileName(sessionId: string): string {
  return `proxy-${sessionId}.log`;
}

/** Absolute path to the proxy log for one debug session's run directory. */
export function proxyLogPathFor(logDir: string, sessionId: string): string {
  return path.join(logDir, proxyLogFileName(sessionId));
}
