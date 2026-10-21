/**
 * The one toolchain version probe the adapters' validate() paths share
 * (issue #969). Five adapters used to carry their own copy of "spawn, kill
 * after 10 s, read on close", and others read output on `exit` (a child can
 * exit before its stdout pipe drains) or spawned through a shell.
 *
 * The command is spawned directly (no shell; `windowsHide` per #215), stdout
 * and stderr are collected, and the result is read on `close`, after both
 * pipes have drained. A probe that outlives `timeoutMs` is killed and reported
 * with `timedOut: true`. A command that cannot be run at all (ENOENT, EACCES)
 * resolves with `code: null` and the spawn error's message in `error`, so a
 * caller can quote it.
 */
import { spawn } from 'child_process';

export interface VersionProbeOptions {
  /** Kill the probe after this long. Default 10 s. */
  timeoutMs?: number;
  env?: NodeJS.ProcessEnv;
  cwd?: string;
}

export interface VersionProbeResult {
  /** The exit code; null when the probe was killed by a signal. */
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  /** Why the command could not be run at all; absent when it ran. */
  error?: string;
}

export const VERSION_PROBE_TIMEOUT_MS = 10_000;
/**
 * How long a killed probe may take to report `close` before it is settled
 * anyway: the kill reaches only the direct child, and a descendant that
 * inherited its stdout would otherwise hold the pipe, and the probe, open.
 */
export const VERSION_PROBE_KILL_GRACE_MS = 1_000;

export function runVersionProbe(
  command: string,
  args: readonly string[],
  options: VersionProbeOptions = {}
): Promise<VersionProbeResult> {
  const notRun = (error: unknown): VersionProbeResult => ({
    code: null,
    stdout: '',
    stderr: '',
    timedOut: false,
    error: error instanceof Error ? error.message : String(error)
  });

  return new Promise((resolve) => {
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(command, [...args], {
        // stdin closed: a wrapper that reads it must not wait out the timeout
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
        ...(options.env ? { env: options.env } : {}),
        ...(options.cwd ? { cwd: options.cwd } : {})
      });
    } catch (error) {
      resolve(notRun(error));
      return;
    }

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    child.stdout?.on('data', (data: Buffer | string) => {
      stdout += data.toString();
    });
    child.stderr?.on('data', (data: Buffer | string) => {
      stderr += data.toString();
    });

    let graceTimer: ReturnType<typeof setTimeout> | undefined;
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        child.kill('SIGKILL');
      } catch {
        // Already gone; close follows.
      }
      graceTimer = setTimeout(() => {
        child.stdout?.destroy?.();
        child.stderr?.destroy?.();
        settle({ code: null, stdout, stderr, timedOut: true });
      }, VERSION_PROBE_KILL_GRACE_MS);
    }, options.timeoutMs ?? VERSION_PROBE_TIMEOUT_MS);

    let settled = false;
    const settle = (value: VersionProbeResult) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        clearTimeout(graceTimer);
        resolve(value);
      }
    };
    child.on('error', (error) => settle(notRun(error)));
    child.on('close', (code: number | null) => settle({ code, stdout, stderr, timedOut }));
  });
}
