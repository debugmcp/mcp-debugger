/**
 * Shutdown wiring for dev-proxy — exit when the MCP client (Claude Code) goes away.
 *
 * Why this exists (issue #122): on Windows, a dying parent process never delivers
 * SIGINT/SIGTERM to its children, and the MCP SDK's StdioServerTransport only
 * attaches 'data'/'error' listeners to stdin — it never notices EOF, and its
 * onclose fires only on programmatic close(). So a dev-proxy whose client died
 * kept the event loop alive forever, and its backend child along with it.
 *
 * The reliable cross-platform signal is the proxy's own stdin: when the client
 * process dies, the OS closes the pipe and stdin emits 'end' (or 'error' for a
 * broken pipe) followed by 'close'. Any of those — plus protocol-level server
 * close and SIGINT/SIGTERM — means "client is gone": stop the backend child,
 * then exit.
 *
 * Kept in its own module so unit tests can import it without executing the
 * dev-proxy entry point (dev-proxy.mjs runs main() at module top level).
 */

import { execFileSync } from 'child_process';

/** Max time to wait for backend.stop() before exiting anyway. */
export const STOP_TIMEOUT_MS = 8000;

/** Hard-exit backstop in case the shutdown sequence itself stalls. */
export const FORCE_EXIT_DELAY_MS = 10000;

/** Max time to wait for a graceful backend exit before force-killing it. */
export const KILL_GRACE_MS = 5000;

/** After a force-kill, max time to wait for the 'exit' event before giving up. */
export const FORCE_KILL_BAIL_MS = 2000;

/**
 * Install handlers that shut the proxy down when the MCP client disconnects.
 *
 * @param {object} deps
 * @param {NodeJS.ReadableStream} deps.stdin
 *   The proxy's inbound stdin from the MCP client. Safe to listen on: the SDK's
 *   StdioServerTransport only attaches 'data'/'error' listeners, and its 'data'
 *   listener keeps the stream flowing so 'end' fires at EOF.
 * @param {{ stop(): Promise<void> }} deps.backend
 *   Backend manager to stop before exit. stop() handles all three transport
 *   modes (http/sse/stdio) including a backend that is still starting.
 * @param {{ onclose?: (() => void) | undefined }} [deps.server]
 *   MCP Server whose onclose is chained (not replaced). Note: hook the SERVER,
 *   never transport.onclose — Protocol.connect() owns transport.onclose and
 *   overwriting it breaks the SDK's close chain.
 * @param {(msg: string) => void} [deps.log]
 * @param {Pick<NodeJS.Process, 'on' | 'exit'>} [deps.proc] Injectable for tests.
 * @param {number} [deps.stopTimeoutMs]
 * @param {number} [deps.forceExitDelayMs]
 * @returns {(reason: string) => Promise<void>} The idempotent shutdown function.
 */
export function installShutdownHandlers({
  stdin,
  backend,
  server,
  log = () => {},
  proc = process,
  stopTimeoutMs = STOP_TIMEOUT_MS,
  forceExitDelayMs = FORCE_EXIT_DELAY_MS,
}) {
  let shuttingDown = false;

  const shutdown = async (reason) => {
    if (shuttingDown) return;
    shuttingDown = true;
    log(`Shutting down: ${reason}`);

    // Backstop: never let a hung stop sequence keep an orphaned supervisor alive.
    const forceExitTimer = setTimeout(() => {
      log(`Shutdown did not complete within ${forceExitDelayMs}ms — forcing exit`);
      proc.exit(1);
    }, forceExitDelayMs);
    forceExitTimer.unref?.();

    let stopTimer;
    try {
      await Promise.race([
        backend.stop(),
        new Promise((resolve) => {
          stopTimer = setTimeout(resolve, stopTimeoutMs);
          stopTimer.unref?.();
        }),
      ]);
    } catch (err) {
      log(`Ignoring backend stop error during shutdown: ${err?.message ?? err}`);
    } finally {
      clearTimeout(stopTimer);
    }

    clearTimeout(forceExitTimer);
    log('Shutdown complete');
    proc.exit(0);
  };

  // Primary trigger: client death closes our stdin pipe.
  stdin.on('end', () => void shutdown('stdin ended (MCP client disconnected)'));
  stdin.on('close', () => void shutdown('stdin closed (MCP client disconnected)'));
  stdin.on('error', (err) =>
    void shutdown(`stdin error (${err?.message ?? err}) — treating as client disconnect`)
  );

  // Secondary trigger: protocol-level close (client sent a proper shutdown).
  if (server) {
    const previousOnClose = server.onclose;
    server.onclose = () => {
      try {
        previousOnClose?.();
      } catch (err) {
        log(`Ignoring server onclose handler error: ${err?.message ?? err}`);
      }
      void shutdown('MCP server connection closed');
    };
  }

  // Signals route through the same idempotent path (parity with prior behavior).
  proc.on('SIGINT', () => void shutdown('SIGINT received'));
  proc.on('SIGTERM', () => void shutdown('SIGTERM received'));

  return shutdown;
}

/**
 * Kill a backend child gracefully, then by force.
 *
 * Graceful channel per platform:
 * - win32: there is no SIGTERM equivalent for console processes, so the
 *   backend is spawned with a stdin pipe and MCP_EXIT_ON_STDIN_CLOSE=1;
 *   closing that pipe asks it to run its graceful shutdown
 *   (closeAllSessions() etc., issue #122).
 * - elsewhere: SIGTERM (the backend's gracefulShutdown is signal-wired).
 *
 * If the child has not exited within killTimeoutMs, it is force-killed
 * (taskkill /F on Windows, SIGKILL elsewhere). Children that ignore the
 * graceful request (e.g. a `docker run` CLI without -i) simply fall through
 * to the force path.
 *
 * @param {import('child_process').ChildProcess | null} child
 * @param {object} [opts]
 * @param {(msg: string) => void} [opts.log]
 * @param {number} [opts.killTimeoutMs]
 * @param {number} [opts.bailMs] Post-force-kill wait before giving up.
 * @param {NodeJS.Platform} [opts.platform] Injectable for tests.
 * @param {(pid: number) => void} [opts.forceKill] Injectable for tests.
 * @returns {Promise<void>} Resolves once the child exited (or force-kill was
 *   attempted and no exit surfaced within bailMs).
 */
export function killChildGracefully(child, opts = {}) {
  const {
    log = () => {},
    killTimeoutMs = KILL_GRACE_MS,
    bailMs = FORCE_KILL_BAIL_MS,
    platform = process.platform,
    forceKill,
  } = opts;

  if (!child || child.exitCode !== null) {
    return Promise.resolve();
  }

  const doForceKill =
    forceKill ??
    ((pid) => {
      if (platform === 'win32') {
        // execFileSync (no shell) — pid is numeric, but avoid shell interpolation on principle
        execFileSync('taskkill', ['/pid', String(pid), '/F'], { stdio: 'ignore' });
      } else {
        child.kill('SIGKILL');
      }
    });

  return new Promise((resolve) => {
    let settled = false;
    let forceTimer;

    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(forceTimer);
      resolve();
    };
    child.once('exit', finish);

    const force = (why) => {
      clearTimeout(forceTimer);
      log(`Force-killing backend PID ${child.pid} (${why})`);
      try {
        doForceKill(child.pid);
      } catch {
        // Already dead
      }
      // If even the force-kill surfaces no 'exit' event, don't hang the caller
      const bail = setTimeout(finish, bailMs);
      bail.unref?.();
    };

    forceTimer = setTimeout(
      () => force(`did not exit within ${killTimeoutMs}ms of graceful request`),
      killTimeoutMs
    );
    forceTimer.unref?.();

    // Graceful attempt first, so the backend can close its debug sessions
    try {
      if (platform === 'win32') {
        if (child.stdin && !child.stdin.destroyed) {
          child.stdin.end();
        } else {
          force('no stdin pipe available for graceful shutdown');
        }
      } else {
        child.kill('SIGTERM');
      }
    } catch (err) {
      force(`graceful request failed: ${err?.message ?? err}`);
    }
  });
}
