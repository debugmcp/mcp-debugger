import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import { sanitizeStderrTail } from './backend-logger.mjs';

const execFileAsync = promisify(execFile);
const MAX_BUFFER_BYTES = 64 * 1024 * 1024;

/**
 * Terminate only a build we spawned: its dedicated process group on POSIX,
 * or its tree on Windows. Killing the shell alone strands its children (#757).
 * Even if the shell exits on SIGTERM, descendants may need the SIGKILL pass.
 */
export async function terminateBuildTree(pid, {
  platform = process.platform,
  kill = process.kill.bind(process),
  runFile = execFileAsync,
  graceMs = 250,
} = {}) {
  if (!pid) return;
  if (platform === 'win32') {
    try {
      // Sweep while the parent is still alive: taskkill discovers its children
      // through that parent, and cannot reconstruct the tree after it exits.
      await runFile('taskkill', ['/PID', String(pid), '/T', '/F'], {
        windowsHide: true, timeout: 1000, killSignal: 'SIGKILL',
      });
    } catch (err) {
      if (err.code !== 128 && err.code !== 'ESRCH') throw err;
    }
    return;
  }
  const signalGroup = (signal) => {
    try {
      kill(-pid, signal);
      return true;
    } catch (err) {
      if (err.code !== 'ESRCH') throw err;
      return false;
    }
  };
  if (signalGroup('SIGTERM')) {
    await delay(graceMs);
    signalGroup('SIGKILL');
  }
}

/**
 * Run a shell build without blocking the supervisor. Output is bounded before
 * buffering, then sanitized as a whole so chunk boundaries cannot split secrets.
 * An abort cancels the owned process tree; it never merely abandons the promise.
 */
export function runBuild({
  command,
  cwd,
  env = process.env,
  timeoutMs,
  maxBufferBytes = MAX_BUFFER_BYTES,
  signal,
  platform = process.platform,
  spawnProcess = spawn,
  terminateTree = terminateBuildTree,
}) {
  if (signal?.aborted) return Promise.reject(new Error('Build cancelled: supervisor is shutting down'));

  return new Promise((resolve, reject) => {
    let child;
    let deadline;
    let closeDeadline;
    let settled = false;
    let closed = false;
    let terminating = false;
    let failure;
    let failureKind;
    let cleanupFailure;
    let bytes = 0;
    const stdout = [];
    const stderr = [];

    const finish = () => {
      if (settled || !closed || terminating) return;
      settled = true;
      clearTimeout(deadline);
      clearTimeout(closeDeadline);
      signal?.removeEventListener('abort', onAbort);
      const out = Buffer.concat(stdout).toString('utf8');
      const err = Buffer.concat(stderr).toString('utf8');
      if (!failure) {
        resolve(sanitizeStderrTail(out, { maxLines: 50, maxChars: 2000 }));
        return;
      }
      const output = [out, err].filter(Boolean).join('\n') || failure.message;
      const tail = sanitizeStderrTail(output, { maxLines: 20, maxChars: 2000 });
      let message = failureKind === 'timeout'
        ? `Build timed out after ${Math.floor(timeoutMs / 1000)}s — the build may still have succeeded, re-run manually to confirm. Output before the timeout:\n${tail}`
        : failureKind === 'abort'
          ? 'Build cancelled: supervisor is shutting down'
          : `Build failed: ${failureKind === 'overflow' ? `${failure.message}\n` : ''}${tail}`;
      if (cleanupFailure) {
        message += `\nBuild process cleanup failed: ${sanitizeStderrTail(cleanupFailure.message)}`;
      }
      reject(new Error(message, { cause: failure }));
    };

    const cancel = (error, kind) => {
      if (settled || failure) return;
      failure = error;
      failureKind = kind;
      clearTimeout(deadline);
      terminating = true;
      // Own the termination promise even if the child closes before it does.
      // Otherwise a shell's early close would release the lifecycle queue
      // while a grandchild that ignored SIGTERM was still running.
      Promise.resolve().then(() => terminateTree(child?.pid, { platform })).catch((err) => {
        cleanupFailure = err;
      }).finally(() => {
        terminating = false;
        if (!closed) {
          // A broken pipe/escaped descendant must not outlive shutdown's bound.
          closeDeadline = setTimeout(() => {
            child?.stdout?.destroy();
            child?.stderr?.destroy();
            closed = true;
            finish();
          }, 1000);
        }
        finish();
      });
    };
    const onAbort = () => cancel(new Error('Supervisor is shutting down'), 'abort');
    const collect = (chunks, chunk) => {
      if (settled || failure) return;
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      const remaining = Math.max(0, maxBufferBytes - bytes);
      chunks.push(buffer.subarray(0, remaining));
      bytes += buffer.length;
      if (bytes > maxBufferBytes) {
        cancel(new Error(`Build output exceeded ${maxBufferBytes} bytes`), 'overflow');
      }
    };

    try {
      child = spawnProcess(command, {
        cwd, env, shell: true, windowsHide: true,
        detached: platform !== 'win32',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (err) {
      failure = err;
      closed = true;
      finish();
      return;
    }
    child.stdout?.on('data', (chunk) => collect(stdout, chunk));
    child.stderr?.on('data', (chunk) => collect(stderr, chunk));
    child.on('error', (err) => cancel(err, 'spawn'));
    child.on('close', (code, exitSignal) => {
      closed = true;
      if (!failure && (code !== 0 || exitSignal)) {
        failure = new Error(`Command exited with ${exitSignal || `code ${code}`}`);
      }
      finish();
    });
    deadline = setTimeout(() => cancel(new Error('Build deadline elapsed'), 'timeout'), timeoutMs);
    signal?.addEventListener('abort', onAbort, { once: true });
    if (signal?.aborted) onAbort();
  });
}
