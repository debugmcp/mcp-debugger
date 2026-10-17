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

  /**
   * A just-spawned process takes a moment to appear in the OS process table
   * (seconds on a cold CI runner), and a scan can come back empty when the
   * runner is too loaded for PowerShell + CIM to answer within the cap (PR
   * #945's Windows lane). Both are waited out; on failure the message says
   * which it was, from whether this worker's own pid — a node process that is
   * certainly running — was ever listed.
   */
  async function waitUntilListed(pid: number, image: string, timeoutMs: number): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    let sawSelf = false;
    let listed = await listPidsByImage(image);
    while (!listed.includes(pid) && Date.now() < deadline) {
      sawSelf ||= listed.includes(process.pid);
      await new Promise((resolve) => setTimeout(resolve, 250));
      listed = await listPidsByImage(image);
    }
    sawSelf ||= listed.includes(process.pid);
    expect(
      listed,
      sawSelf
        ? `the scanner lists this worker but never the child ${pid}`
        : `the scanner never listed even this worker (${process.pid}): PowerShell/CIM not answering on this runner`
    ).toContain(pid);
  }

  const LISTING_WAIT_MS = 45_000;
  const CASE_TIMEOUT_MS = 60_000;

  it('lists a live node child under its image and sees it alive', async () => {
    const proc = spawnIdleNode();
    expect(isProcessAlive(proc.pid!)).toBe(true);
    // Not asserted on the first scan: on windows-latest the child was alive
    // but not yet in the table when queried right after spawn (main CI on
    // 42651425), while a scan 300 ms later listed it.
    await waitUntilListed(proc.pid!, 'node', LISTING_WAIT_MS);
  }, CASE_TIMEOUT_MS);

  it('answers the pid as a survivor only while it is still a process of the named image', async () => {
    const proc = spawnIdleNode();
    // Same race as the case above (Flake Hunt 39027849623 on windows-latest,
    // seed 516586464): the pid is alive, so it survives the poll, and the
    // image filter then drops it because the table has not listed it yet.
    await waitUntilListed(proc.pid!, 'node', LISTING_WAIT_MS);

    expect(await waitForProcessesToExit([proc.pid!], { timeoutMs: 300, image: 'node' })).toEqual([proc.pid]);
    // Alive, but not what the caller is looking for: a reused pid must not
    // be reported (and later killed) as the caller's process.
    expect(await waitForProcessesToExit([proc.pid!], { timeoutMs: 300, image: 'no-such-image-885' })).toEqual([]);

    proc.kill('SIGKILL');
    expect(await waitForProcessesToExit([proc.pid!], { timeoutMs: 5000, image: 'node' })).toEqual([]);
  }, CASE_TIMEOUT_MS);
});
