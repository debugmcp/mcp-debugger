/**
 * Append-only file logger for the COBOL DAP shim.
 *
 * The shim's stdout/stderr are not its own: CodeLLDB inherits them and the
 * debuggee's DISPLAY output arrives there on Windows (mcp-debugger forwards the
 * adapter process's stdio as debuggee output). One stray `console.log` would be
 * shown to the user as program output, so the shim logs to the `--log` file or
 * nowhere at all. Writes are synchronous so the last lines before an exit are
 * on disk; volume is low (decisions, not frames).
 */
import { appendFileSync } from 'node:fs';

export type ShimLogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface ShimLogger {
  debug(message: string, data?: unknown): void;
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, data?: unknown): void;
}

function renderData(data: unknown): string {
  if (data === undefined) {
    return '';
  }
  if (data instanceof Error) {
    return ` ${data.message}`;
  }
  try {
    return ` ${JSON.stringify(data)}`;
  } catch {
    return ` ${String(data)}`;
  }
}

/** Every method is a no-op; used when no `--log` was given. */
export const NOOP_LOGGER: ShimLogger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined
};

export function createFileLogger(file: string | undefined): ShimLogger {
  if (!file) {
    return NOOP_LOGGER;
  }
  let broken = false;
  const write = (level: ShimLogLevel, message: string, data?: unknown): void => {
    if (broken) {
      return;
    }
    try {
      appendFileSync(file, `${new Date().toISOString()} [${level}] ${message}${renderData(data)}\n`);
    } catch {
      // A log file that cannot be written must never take the session down;
      // stop trying rather than retrying on every line.
      broken = true;
    }
  };
  return {
    debug: (message, data) => write('debug', message, data),
    info: (message, data) => write('info', message, data),
    warn: (message, data) => write('warn', message, data),
    error: (message, data) => write('error', message, data)
  };
}
