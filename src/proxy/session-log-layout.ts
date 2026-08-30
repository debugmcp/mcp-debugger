/**
 * The dependency-free naming contract for one debug session's logs.
 *
 * This module is bundled into the proxy worker, so it intentionally depends
 * only on `node:path`. Keeping every producer, reader, and cleanup predicate
 * here prevents a diagnostic path from drifting away from the file that was
 * actually written.
 */
import path from 'node:path';

const RUN_DIRECTORY_PATTERN = /^run-\d+$/;

/** Directory name for one launch attempt. */
export function sessionRunDirectoryName(startedAt: number): string {
  return `run-${startedAt}`;
}

/** Whether an entry is a managed launch-attempt directory. */
export function isSessionRunDirectoryName(name: string): boolean {
  return RUN_DIRECTORY_PATTERN.test(name);
}

/** Absolute directory for one launch attempt of a debug session. */
export function sessionRunDirectoryFor(
  sessionLogBase: string,
  sessionId: string,
  startedAt: number
): string {
  return path.join(sessionLogBase, sessionId, sessionRunDirectoryName(startedAt));
}

/** File name (no directory) of the proxy log for one debug session. */
export function proxyLogFileName(sessionId: string): string {
  return `proxy-${sessionId}.log`;
}

/** Absolute path to the proxy log for one launch attempt. */
export function proxyLogPathFor(runDirectory: string, sessionId: string): string {
  return path.join(runDirectory, proxyLogFileName(sessionId));
}

/** File name (no directory) of the debug adapter log for one session. */
export function adapterLogFileName(sessionId: string): string {
  return `${sessionId}.log`;
}

/** Absolute path to the debug adapter log for one launch attempt. */
export function adapterLogPathFor(runDirectory: string, sessionId: string): string {
  return path.join(runDirectory, adapterLogFileName(sessionId));
}

/** File name (no directory) of the opt-in DAP protocol trace. */
export function dapTraceFileName(sessionId: string): string {
  return `dap-trace-${sessionId}.ndjson`;
}

/** Absolute path to the opt-in DAP protocol trace for one launch attempt. */
export function dapTracePathFor(runDirectory: string, sessionId: string): string {
  return path.join(runDirectory, dapTraceFileName(sessionId));
}
