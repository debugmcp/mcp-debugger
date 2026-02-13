/**
 * Logger utility for the Debug MCP Server.
 */
import * as winston from 'winston';
import type { Logger as WinstonLoggerType } from 'winston';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

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
      projectRootDefaultLogPath = path.resolve(__dirname, '../../logs/debug-mcp-server.log');
    } else {
      // Fallback for test environments
      projectRootDefaultLogPath = path.resolve(process.cwd(), 'logs/debug-mcp-server.log');
    }
  } catch {
    // Fallback if import.meta.url fails
    projectRootDefaultLogPath = path.resolve(process.cwd(), 'logs/debug-mcp-server.log');
  }
  
  // In container runtime, centralize logs under /app/logs for easier collection
  if (process.env.MCP_CONTAINER === 'true') {
    projectRootDefaultLogPath = '/app/logs/debug-mcp-server.log';
  }
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

  try {
    transports.push(
      new winston.transports.File({
        filename: logFilePath,
        maxsize: 50 * 1024 * 1024,  // 50 MB per file
        maxFiles: 3,                 // Keep 3 rotated files (150 MB max)
        tailable: true,              // Newest logs always in base filename
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        )
      })
    );
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
