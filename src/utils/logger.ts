/**
 * Logger utility for the Debug MCP Server.
 */
import * as winston from 'winston';
import type { Logger as WinstonLoggerType } from 'winston'; // Import WinstonLogger type
import path from 'path'; // Added for path resolution
import fs from 'fs'; // Added for directory creation
import { fileURLToPath } from 'url'; // Added for __dirname in ESM

/**
 * Logger configuration options.
 */
export interface LoggerOptions {
  /** The log level to use (error, warn, info, debug) */
  level?: string;
  /** Optional file path to log to */
  file?: string;
}

/**
 * Create a winston logger with the given namespace.
 * 
 * @param namespace - The logger namespace
 * @param options - Logger configuration options
 * @returns A configured winston logger instance
 */
export function createLogger(namespace: string, options: LoggerOptions = {}): WinstonLoggerType {
  // Default to 'info' unless overridden by options.level
  // REMOVED TEST ENVIRONMENT ANTI-PATTERN: Logger should behave the same in all environments
  const level = options.level || 'info';
  
  // Set up transports
  const transports: winston.transport[] = [
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
  ];
  
  // Add file transport if specified, OR default to a common log file relative to project root
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  // Assuming logger.ts is in src/utils, so ../../logs points to <project_root>/logs
  const projectRootDefaultLogPath = path.resolve(__dirname, '../../logs/debug-mcp-server.log');
  
  const logFilePath = options.file || projectRootDefaultLogPath;

  // Ensure the directory for the log file exists
  try {
    const logDir = path.dirname(logFilePath);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  } catch (e) {
    // Fallback to console if directory creation fails, to avoid crashing the logger itself
    console.error(`[Logger Init Error] Failed to ensure log directory for ${logFilePath}:`, e);
  }

  try {
    transports.push(
      new winston.transports.File({
        filename: logFilePath, // Always log to a file
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json() // Ensures structured logging in the file
        )
      })
    );
  } catch (fileTransportError) {
    console.error(`[Logger Init Error] Failed to create file transport for ${logFilePath}:`, fileTransportError);
    // Proceed without file transport if it fails
  }
  
  // Create and return the logger
  const logger = winston.createLogger({
    level,
    transports,
    defaultMeta: { namespace },
    exitOnError: false // Explicitly set to false
  });

  // Add an error handler to the logger itself to catch issues with transports
  logger.on('error', (error: Error) => {
    console.error('[Winston Logger Internal Error] Failed to write to a transport:', error);
    // Potentially, one could try to remove the failing transport or take other recovery actions here,
    // but for now, just logging to console is a good first step.
  });

  return logger;
}
