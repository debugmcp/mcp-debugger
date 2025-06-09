/**
 * Production dependencies factory for DAP Proxy
 */

import { spawn } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import { MinimalDapClient } from './minimal-dap.js';
import { createLogger } from '../utils/logger.js';
import {
  DapProxyDependencies,
  ILogger,
  ILoggerFactory
} from './dap-proxy-interfaces.js';

/**
 * Create production dependencies for the DAP Proxy Worker
 */
export function createProductionDependencies(): DapProxyDependencies {
  // Logger factory for delayed initialization
  const loggerFactory: ILoggerFactory = async (sessionId: string, logDir: string) => {
    const logPath = path.join(logDir, `proxy-${sessionId}.log`);
    return createLogger(`dap-proxy:${sessionId}`, {
      level: 'debug',
      file: logPath
    });
  };

  return {
    loggerFactory,
    
    fileSystem: {
      ensureDir: (path: string) => fs.ensureDir(path),
      pathExists: (path: string) => fs.pathExists(path)
    },
    
    processSpawner: {
      spawn
    },
    
    dapClientFactory: {
      create: (host: string, port: number) => new MinimalDapClient(host, port) as any
    },
    
    messageSender: {
      send: (message: any) => {
        if (process.send) {
          process.send(message);
        } else {
          process.stdout.write(JSON.stringify(message) + '\n');
        }
      }
    }
  };
}

/**
 * Create a simple console logger for pre-initialization errors
 */
export function createConsoleLogger(): ILogger {
  return {
    info: (...args: any[]) => console.error('[INFO]', ...args),
    error: (...args: any[]) => console.error('[ERROR]', ...args),
    debug: (...args: any[]) => console.error('[DEBUG]', ...args),
    warn: (...args: any[]) => console.error('[WARN]', ...args)
  };
}

/**
 * Setup global error handlers for the proxy process
 */
export function setupGlobalErrorHandlers(
  logger: ILogger,
  messageSender: { send: (msg: any) => void },
  shutdownFn: () => Promise<void>,
  getCurrentSessionId: () => string | null
): void {
  process.on('uncaughtException', (err: Error, origin: string) => {
    logger.error(`[Proxy Worker UNCAUGHT_EXCEPTION] Origin: ${origin}`, err);
    messageSender.send({
      type: 'error',
      message: `Proxy worker uncaught exception: ${err.message} (origin: ${origin})`,
      sessionId: getCurrentSessionId() || 'unknown'
    });
    shutdownFn().finally(() => process.exit(1));
  });

  process.on('unhandledRejection', (reason: any, promise: Promise<unknown>) => {
    logger.error('[Proxy Worker UNHANDLED_REJECTION] Reason:', reason, 'Promise:', promise);
    messageSender.send({
      type: 'error',
      message: `Proxy worker unhandled rejection: ${String(reason)}`,
      sessionId: getCurrentSessionId() || 'unknown'
    });
    shutdownFn().finally(() => process.exit(1));
  });

  process.on('SIGINT', async () => {
    logger.info('[Proxy] SIGINT received, shutting down proxy worker.');
    await shutdownFn();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('[Proxy] SIGTERM received, shutting down proxy worker.');
    await shutdownFn();
    process.exit(0);
  });
}
