/**
 * Logger utility for the Debug MCP Server.
 */
import * as winston from 'winston';
import type { Logger as WinstonLoggerType } from 'winston';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { SafeFileTransport } from './safe-file-transport.js';

/**
 * Logger configuration options.
 */
export interface LoggerOptions {
  /** The log level to use (error, warn, info, debug) */
  level?: string;
  /** Optional file path to log to */
  file?: string;
}

let defaultLogger: WinstonLoggerType | null = null;

/**
 * Default log files are per-process (issue #121): multiple server processes
 * sharing one rotating winston file is unsupported by winston and busy-spins
 * forever on Windows, where renaming a file another process holds open fails.
 * Container mode keeps the fixed `/app/logs/debug-mcp-server.log` name — a
 * container runs a single server process and log-collection tooling depends
 * on that exact path.
 */
const DEFAULT_LOG_BASENAME = `debug-mcp-server-${process.pid}.log`;

/** Matches per-pid default log files (including their rotated `<name>N.log` siblings). */
const PID_LOG_PATTERN = /^debug-mcp-server-(\d+)\.log$/;

/** Delete leftover per-pid logs from dead processes after this long. */
const STALE_LOG_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * One shared File transport per resolved log path. Several loggers are created
 * per process (CLI, DI container, module-level fallbacks); without sharing,
 * each would hold its own file handle and its own rotation byte-counter on the
 * same file — the cap is then never enforced correctly, and on Windows the
 * extra open handles make rotation renames fail (issue #121).
 * Note: winston supports attaching one transport to many loggers; per-logger
 * levels still filter before the transport. Nothing in src/ calls
 * logger.close(), which would close the shared transport for all loggers.
 */
const fileTransportCache = new Map<string, winston.transport>();

let staleLogCleanupDone = false;

/** Sends a signal to a pid; injectable so tests never spy the global process.kill (issue #183). */
type SignalFn = (pid: number, signal: NodeJS.Signals | number) => void;

const defaultSignal: SignalFn = (pid, signal) => process.kill(pid, signal);

/**
 * Best-effort check whether a pid belongs to a live process.
 * EPERM means "alive but not ours" — treat as alive.
 */
function isProcessAlive(pid: number, signal: SignalFn = defaultSignal): boolean {
  try {
    signal(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
}

/**
 * Delete per-pid default log files left behind by dead processes.
 *
 * Guard rails:
 * - Only files matching the per-pid naming pattern are considered; the legacy
 *   fixed `debug-mcp-server.log` and `proxy-<sessionId>.log` files are never touched.
 * - Files belonging to this process or any live pid are skipped, even when
 *   old: an idle-but-alive server can have a stale mtime, and on POSIX
 *   unlinking its open file would silently discard all future writes.
 * - Everything is best-effort; failures are ignored.
 */
export function cleanupStaleLogFiles(
  logDir: string,
  opts: { maxAgeMs?: number; now?: number; signal?: SignalFn } = {}
): void {
  const maxAgeMs = opts.maxAgeMs ?? STALE_LOG_MAX_AGE_MS;
  const now = opts.now ?? Date.now();
  const signal = opts.signal ?? defaultSignal;

  let entries: string[];
  try {
    entries = fs.readdirSync(logDir);
  } catch {
    return;
  }

  for (const name of entries) {
    const match = PID_LOG_PATTERN.exec(name);
    if (!match) {
      continue;
    }
    const pid = Number(match[1]);
    if (pid === process.pid || isProcessAlive(pid, signal)) {
      continue;
    }
    const fullPath = path.join(logDir, name);
    try {
      const stat = fs.statSync(fullPath);
      if (now - stat.mtimeMs >= maxAgeMs) {
        fs.unlinkSync(fullPath);
      }
    } catch {
      // Best-effort cleanup; never let it interfere with logger creation.
    }
  }
}

/**
 * Create a winston logger with the given namespace.
 * 
 * @param namespace - The logger namespace
 * @param options - Logger configuration options
 * @returns A configured winston logger instance
 */
export function createLogger(namespace: string, options: LoggerOptions = {}): WinstonLoggerType {
  // Check for global log level from environment or options
  const level = options.level || process.env.DEBUG_MCP_LOG_LEVEL || 'info';
  
  const transports: winston.transport[] = [];
  
  // When console output is silenced we MUST NOT write to stdout as it corrupts transports
  const isConsoleSilenced = process.env.CONSOLE_OUTPUT_SILENCED === '1';
  
  if (!isConsoleSilenced) {
    // Only add console transport when NOT silencing console output
    transports.push(
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.timestamp(),
          winston.format.printf(({ timestamp, level, message, ...rest }) => {
            return `${timestamp} [${level}] [${namespace}]: ${message} ${
              Object.keys(rest).length ? JSON.stringify(rest, null, 2) : ''
            }`;
          })
        )
      })
    );
  }
  
  // Handle cases where import.meta.url might be undefined (e.g., in test environments)
  let projectRootDefaultLogPath: string;
  try {
    if (import.meta.url) {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      projectRootDefaultLogPath = path.resolve(__dirname, '../../logs', DEFAULT_LOG_BASENAME);
    } else {
      // Fallback for test environments
      projectRootDefaultLogPath = path.resolve(process.cwd(), 'logs', DEFAULT_LOG_BASENAME);
    }
  } catch {
    // Fallback if import.meta.url fails
    projectRootDefaultLogPath = path.resolve(process.cwd(), 'logs', DEFAULT_LOG_BASENAME);
  }

  // In container runtime, centralize logs under /app/logs for easier collection.
  // Single process per container, so the fixed (non-pid) name is safe there.
  if (process.env.MCP_CONTAINER === 'true') {
    projectRootDefaultLogPath = '/app/logs/debug-mcp-server.log';
  }
  const usingDefaultHostPath = !options.file && process.env.MCP_CONTAINER !== 'true';
  const logFilePath = options.file || projectRootDefaultLogPath;

  try {
    const logDir = path.dirname(logFilePath);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  } catch (e) {
    // When console output is silenced we must not write to console as it corrupts transports
    if (!isConsoleSilenced) {
      console.error(`[Logger Init Error] Failed to ensure log directory for ${logFilePath}:`, e);
    }
  }

  if (usingDefaultHostPath && !staleLogCleanupDone) {
    staleLogCleanupDone = true;
    cleanupStaleLogFiles(path.dirname(logFilePath));
  }

  try {
    const cacheKey = path.resolve(logFilePath);
    let fileTransport = fileTransportCache.get(cacheKey);
    if (!fileTransport) {
      fileTransport = new SafeFileTransport({
        filename: logFilePath,
        maxsize: 50 * 1024 * 1024,  // 50 MB per file
        maxFiles: 3,                 // Keep 3 rotated files (150 MB max)
        tailable: true,              // Newest logs always in base filename
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        )
      });
      fileTransportCache.set(cacheKey, fileTransport);
    }
    transports.push(fileTransport);
  } catch (fileTransportError) {
    // When console output is silenced we must not write to console as it corrupts transports
    if (!isConsoleSilenced) {
      console.error(`[Logger Init Error] Failed to create file transport for ${logFilePath}:`, fileTransportError);
    }
  }
  
  const logger = winston.createLogger({
    level,
    transports,
    defaultMeta: { namespace },
    exitOnError: false
  });

  logger.on('error', (error: Error) => {
    // When console output is silenced we must not write to console as it corrupts transports
    if (!isConsoleSilenced) {
      console.error('[Winston Logger Internal Error] Failed to write to a transport:', error);
    }
  });

  // If this is the root logger, set it as the default
  if (namespace === 'debug-mcp') {
    defaultLogger = logger;
  }

  return logger;
}

/**
 * Get the default logger instance. If no root logger has been created, a fallback logger is created.
 * @returns The default logger instance.
 */
export function getLogger(): WinstonLoggerType {
  if (!defaultLogger) {
    defaultLogger = createLogger('debug-mcp:default-fallback', { level: 'info' });
    defaultLogger.warn('[Logger] getLogger() called before root logger was initialized. Using fallback logger.');
  }
  return defaultLogger;
}
