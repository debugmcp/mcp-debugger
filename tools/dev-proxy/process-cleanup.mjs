import { setTimeout as delay } from 'node:timers/promises';
import { runCommand } from './command-runner.mjs';

/** Kill a lingering backend only after its existing grace and ownership recheck. */
export async function forceKillPid(pid, {
  platform = process.platform,
  runFile = runCommand,
  kill = process.kill.bind(process),
  stillOwned,
  wait = delay,
} = {}) {
  if (!pid) return;
  try {
    await wait(500);
    if (stillOwned && !stillOwned()) return;
    if (platform === 'win32') {
      await runFile('taskkill', ['/pid', String(pid), '/F']);
    } else {
      kill(pid, 0);
      kill(pid, 'SIGKILL');
    }
  } catch {
    // Already gone or unavailable: cleanup remains best-effort.
  }
}

/** Select a listener on this exact local port, including bracketed IPv6 endpoints. */
export function windowsListenerPid(output, port) {
  for (const line of output.split(/\r?\n/)) {
    const [protocol, local, , state, value] = line.trim().split(/\s+/);
    if (protocol !== 'TCP' || state !== 'LISTENING') continue;
    const localPort = local?.match(/:(\d+)$/)?.[1];
    if (Number(localPort) !== port || !/^\d+$/.test(value ?? '')) continue;
    const pid = Number(value);
    if (Number.isSafeInteger(pid) && pid > 0) return pid;
  }
  return null;
}

/** Reap the legacy node listener used by network backends, without blocking status. */
export async function ensurePortFree({
  port,
  platform = process.platform,
  runFile = runCommand,
  forceKill = pid => forceKillPid(pid, { platform, runFile }),
  log = () => {},
  wait = delay,
}) {
  try {
    let pid;
    if (platform === 'win32') {
      const { stdout } = await runFile('netstat', ['-ano']);
      pid = windowsListenerPid(stdout, port);
    } else {
      const { stdout } = await runFile('lsof', ['-ti', `tcp:${port}`, '-sTCP:LISTEN']);
      const value = stdout.trim().split(/\r?\n/)[0];
      pid = /^\d+$/.test(value) ? Number(value) : null;
    }

    if (!Number.isSafeInteger(pid) || pid <= 0) return;
    if (platform === 'win32') {
      try {
        const { stdout } = await runFile('tasklist', ['/fi', `PID eq ${pid}`, '/fo', 'csv', '/nh']);
        if (!stdout.toLowerCase().includes('node')) {
          log(`Port ${port} held by non-node PID ${pid} — skipping kill`);
          return;
        }
      } catch {
        // Preserve the existing fallback when tasklist is unavailable.
      }
    }

    log(`Port ${port} is held by PID ${pid} — killing orphan`);
    await forceKill(pid);
    await wait(500);
  } catch {
    // No listener or command unavailable: allow the subsequent startup to try.
  }
}
