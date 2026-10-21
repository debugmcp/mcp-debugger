/**
 * The one toolchain version probe the adapters' validate() paths share
 * (issue #969). Five adapters used to carry their own copy of "spawn, kill
 * after 10 s, read on close", and others read output on `exit` (a child can
 * exit before its stdout pipe drains) or spawned through a shell.
 *
 * The command is spawned directly (no shell; `windowsHide` per #215), stdout
 * and stderr are collected, and the result is read on `close`, after both
 * pipes have drained. A probe that outlives `timeoutMs` is killed and reported
 * with `timedOut: true`. A command that cannot be spawned at all (ENOENT)
 * resolves null.
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
}

export const VERSION_PROBE_TIMEOUT_MS = 10_000;

export function runVersionProbe(
  command: string,
  args: readonly string[],
  options: VersionProbeOptions = {}
): Promise<VersionProbeResult | null> {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (value: VersionProbeResult | null) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(value);
      }
    };

    let child: ReturnType<typeof spawn>;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      child = spawn(command, [...args], {
        windowsHide: true,
        ...(options.env ? { env: options.env } : {}),
        ...(options.cwd ? { cwd: options.cwd } : {})
      });
    } catch {
      settle(null);
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

    timer = setTimeout(() => {
      timedOut = true;
      try {
        child.kill('SIGKILL');
      } catch {
        // Already gone; close follows.
      }
    }, options.timeoutMs ?? VERSION_PROBE_TIMEOUT_MS);

    child.on('error', () => settle(null));
    child.on('close', (code: number | null) => settle({ code, stdout, stderr, timedOut }));
  });
}
