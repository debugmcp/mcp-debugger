import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/** Bound lifecycle probes so an unavailable OS tool cannot hold a restart forever. */
export const COMMAND_TIMEOUT_MS = 5000;

/** Run an executable without a shell, leaving the supervisor's event loop available. */
export function runCommand(command, args, options = {}) {
  return execFileAsync(command, args, {
    encoding: 'utf8',
    windowsHide: true,
    timeout: COMMAND_TIMEOUT_MS,
    killSignal: 'SIGKILL',
    ...options,
  });
}
