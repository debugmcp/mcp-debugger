/**
 * Opt-in orphan self-defense for network-mode servers (issue #122).
 *
 * When a supervisor (e.g. tools/dev-proxy) spawns this server with a stdin
 * pipe and MCP_EXIT_ON_STDIN_CLOSE=1, the supervisor's death closes the pipe
 * and stdin emits 'end'/'close' (or 'error' for a broken pipe). Watching for
 * that gives the backend a parent-death signal that works on Windows, where
 * a dying parent never delivers SIGINT/SIGTERM to its children.
 *
 * Strictly opt-in via env: a standalone server (TTY stdin, or spawned
 * detached with a closed stdin, e.g. `nohup ... < /dev/null`) must NOT exit
 * just because stdin is closed.
 */

export const STDIN_CLOSE_ENV_VAR = 'MCP_EXIT_ON_STDIN_CLOSE';

const DEFAULT_BACKSTOP_MS = 5000;

export interface StdinWatchdogOptions {
  /** Only .on() and .resume() are used, so any readable stream (incl. test fakes) works. */
  stdin: NodeJS.ReadableStream;
  logger: { warn: (msg: string) => void };
  /** Graceful shutdown to initiate; expected to eventually exit the process. */
  shutdown: () => void | Promise<void>;
  /** Exit fallback in case the graceful shutdown stalls. */
  exitProcess: (code: number) => void;
  /** How long to wait for graceful shutdown before force-exiting. */
  backstopMs?: number;
  env?: NodeJS.ProcessEnv;
}

/**
 * Watch stdin for EOF/close/error and trigger a graceful shutdown when the
 * MCP_EXIT_ON_STDIN_CLOSE env var is '1' or 'true'.
 *
 * @returns true when the watchdog was installed, false when the env gate is off.
 */
export function watchStdinForParentExit(options: StdinWatchdogOptions): boolean {
  const {
    stdin,
    logger,
    shutdown,
    exitProcess,
    backstopMs = DEFAULT_BACKSTOP_MS,
    env = process.env,
  } = options;

  const flag = env[STDIN_CLOSE_ENV_VAR];
  if (flag !== '1' && flag !== 'true') {
    return false;
  }

  let triggered = false;
  const onStdinGone = (reason: string): void => {
    if (triggered) return;
    triggered = true;
    logger.warn(
      `[MCP] ${reason} with ${STDIN_CLOSE_ENV_VAR} set — parent is gone, shutting down.`
    );
    // Backstop: if graceful shutdown stalls (e.g. sockets delaying
    // server.close), exit anyway. unref'd so the timer itself never keeps
    // the process alive.
    const backstop = setTimeout(() => exitProcess(0), backstopMs);
    backstop.unref?.();
    void Promise.resolve()
      .then(() => shutdown())
      .catch((err: unknown) => {
        logger.warn(
          `[MCP] Graceful shutdown failed after stdin close: ${err instanceof Error ? err.message : String(err)}`
        );
        // The backstop timer will force the exit.
      });
  };

  stdin.on('end', () => onStdinGone('Stdin ended'));
  stdin.on('close', () => onStdinGone('Stdin closed'));
  stdin.on('error', (err: Error) => onStdinGone(`Stdin error (${err.message})`));
  // Without a 'data' listener the stream stays paused and never reports EOF.
  stdin.resume();

  return true;
}
