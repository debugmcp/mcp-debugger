/**
 * Process-table helpers for e2e assertions that a close really ended the
 * debuggee (issue #885). A session's answer says what the adapter reported;
 * these say what the OS has. Language-neutral: the Flutter desktop app, the
 * Dart VM running a script and an `rdbg -c` grandchild are all looked up the
 * same way.
 */
import { execFile } from 'child_process';
import path from 'path';
import { promisify } from 'util';
import { scanProcessArgs, type ScannedProcess } from '../../../src/utils/process-scan.js';

const execFileAsync = promisify(execFile);

/** Live processes whose image is `<image>` (`<image>.exe` on Windows), with their argv. */
export async function listProcessesByImage(image: string): Promise<ScannedProcess[]> {
  if (process.platform === 'win32') {
    return scanProcessArgs({ windowsProcessNames: [`${image}.exe`] });
  }
  const all = await scanProcessArgs({ windowsProcessNames: [] });
  return all.filter((proc) => path.basename(proc.args[0] ?? '') === image);
}

export async function listPidsByImage(image: string): Promise<number[]> {
  return (await listProcessesByImage(image)).map((proc) => proc.pid);
}

/** Existence only (`kill(pid, 0)`); EPERM means it exists but is not ours. */
export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

/** Poll until every pid is gone or the timeout expires; answers the survivors. */
export async function waitForProcessesToExit(
  pids: readonly number[],
  timeoutMs = 5000,
  intervalMs = 250
): Promise<number[]> {
  const deadline = Date.now() + timeoutMs;
  let survivors = pids.filter(isProcessAlive);
  while (survivors.length > 0 && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    survivors = survivors.filter(isProcessAlive);
  }
  return survivors;
}

/**
 * Last resort after a failed assertion, so a leftover never locks the next
 * case's build output. Never part of the assertion itself.
 */
export async function killProcesses(pids: readonly number[]): Promise<void> {
  for (const pid of pids) {
    try {
      if (process.platform === 'win32') {
        await execFileAsync('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true });
      } else {
        process.kill(pid, 'SIGKILL');
      }
    } catch {
      // already gone
    }
  }
}
