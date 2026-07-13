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
import type { ProcessLike } from '../interfaces/process-interfaces.js';

/**
 * Create production dependencies for the DAP Proxy Worker
 *
 * @param proc injectable process handle for the messageSender's IPC/stdout
 * channel (issue #183); defaults to the global `process`.
 */
export function createProductionDependencies(
  proc: Pick<ProcessLike, 'send' | 'stdout'> = process
): DapProxyDependencies {
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
      create: (host: string, port: number, policy?: any) => new MinimalDapClient(host, port, policy) as any // eslint-disable-line @typescript-eslint/no-explicit-any -- MinimalDapClient implements IDapClient but has type compatibility issues
    },
    
    messageSender: {
      send: (message: unknown) => {
        if (proc.send) {
          proc.send(message);
        } else {
          proc.stdout.write(JSON.stringify(message) + '\n');
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
    info: (...args: unknown[]) => console.log('[INFO]', ...args),
    error: (...args: unknown[]) => console.error('[ERROR]', ...args),
    debug: (...args: unknown[]) => console.error('[DEBUG]', ...args),
    warn: (...args: unknown[]) => console.error('[WARN]', ...args)
  };
}
