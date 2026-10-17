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

/**
 * Cap on one process-table query. The scanner's own default (5 s) suits the
 * startup reapers, but a timed-out query answers nothing, which reads here as
 * "not listed": on a loaded windows-latest runner (the unit project under
 * coverage) PowerShell + CIM took longer than 5 s and a live child was
 * reported absent (PR #945's Windows lane). An assertion can afford to wait.
 */
const SCAN_TIMEOUT_MS = 20_000;

/** Live processes whose image is `<image>` (`<image>.exe` on Windows), with their argv. */
export async function listProcessesByImage(image: string): Promise<ScannedProcess[]> {
  if (process.platform === 'win32') {
    return scanProcessArgs({ windowsProcessNames: [`${image}.exe`], timeoutMs: SCAN_TIMEOUT_MS });
  }
  const all = await scanProcessArgs({ windowsProcessNames: [], timeoutMs: SCAN_TIMEOUT_MS });
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

/**
 * Poll until every pid is gone or the timeout expires; answers the survivors.
 * With `image`, a survivor is only a pid that is still a process of that
 * image: a pid is reused within seconds (Windows especially), so liveness
 * alone can name a stranger — and a caller that goes on to kill survivors
 * must pass the image. The image check presumes the process has been
 * running long enough to be in the table: a query right after `spawn()` is
 * a race (seconds on a cold Windows runner), and a live-but-unlisted pid is
 * answered as not ours. The e2e callers query seconds after the app started.
 */
export async function waitForProcessesToExit(
  pids: readonly number[],
  { timeoutMs = 5000, intervalMs = 250, image }: { timeoutMs?: number; intervalMs?: number; image?: string } = {}
): Promise<number[]> {
  const deadline = Date.now() + timeoutMs;
  let survivors = pids.filter(isProcessAlive);
  while (survivors.length > 0 && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    survivors = survivors.filter(isProcessAlive);
  }
  if (image !== undefined && survivors.length > 0) {
    const stillOurs = new Set(await listPidsByImage(image));
    survivors = survivors.filter((pid) => stillOurs.has(pid));
  }
  return survivors;
}

/**
 * Last resort after a failed assertion, so a leftover never locks the next
 * case's build output. Never part of the assertion itself, and only ever on
 * survivors `waitForProcessesToExit` verified by image.
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
