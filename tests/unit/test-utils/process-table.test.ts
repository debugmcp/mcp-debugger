/**
 * The process-table helper the close e2e assertions stand on (issue #885):
 * driven against a real child process, because its whole point is what the
 * OS says. The image check is what makes a "survivor" safe to kill — a pid
 * is reused within seconds, so without it the kill-on-failure path could hit
 * a stranger.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { spawn, type ChildProcess } from 'child_process';
import {
  isProcessAlive,
  listPidsByImage,
  waitForProcessesToExit
} from '../../test-utils/helpers/process-table.js';

describe('process-table helper (issue #885)', () => {
  let child: ChildProcess | undefined;

  afterEach(async () => {
    if (child && child.exitCode === null && !child.killed) {
      child.kill('SIGKILL');
      await new Promise((resolve) => child!.once('exit', resolve));
    }
    child = undefined;
  });

  function spawnIdleNode(): ChildProcess {
    const proc = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore', windowsHide: true });
    child = proc;
    return proc;
  }

  /** A just-spawned process takes a moment to appear in the OS process table (seconds on a cold CI runner). */
  async function waitUntilListed(pid: number, image: string, timeoutMs: number): Promise<number[]> {
    const deadline = Date.now() + timeoutMs;
    let listed = await listPidsByImage(image);
    while (!listed.includes(pid) && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      listed = await listPidsByImage(image);
    }
    return listed;
  }

  it('lists a live node child under its image and sees it alive', async () => {
    const proc = spawnIdleNode();
    expect(isProcessAlive(proc.pid!)).toBe(true);
    // Not asserted on the first scan: on windows-latest the child was alive
    // but not yet in the table when queried right after spawn (main CI on
    // 42651425), while a scan 300 ms later listed it.
    expect(await waitUntilListed(proc.pid!, 'node', 15_000)).toContain(proc.pid);
  }, 30_000);

  it('answers the pid as a survivor only while it is still a process of the named image', async () => {
    const proc = spawnIdleNode();

    expect(await waitForProcessesToExit([proc.pid!], { timeoutMs: 300, image: 'node' })).toEqual([proc.pid]);
    // Alive, but not what the caller is looking for: a reused pid must not
    // be reported (and later killed) as the caller's process.
    expect(await waitForProcessesToExit([proc.pid!], { timeoutMs: 300, image: 'no-such-image-885' })).toEqual([]);

    proc.kill('SIGKILL');
    expect(await waitForProcessesToExit([proc.pid!], { timeoutMs: 5000, image: 'node' })).toEqual([]);
  });
});
