import type { Logger as WinstonLoggerType } from 'winston';
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
export declare function createLogger(namespace: string, options?: LoggerOptions): WinstonLoggerType;
/**
 * Get the default logger instance. If no root logger has been created, a fallback logger is created.
 * @returns The default logger instance.
 */
export declare function getLogger(): WinstonLoggerType;
