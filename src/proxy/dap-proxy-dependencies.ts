/**
 * Production dependencies factory for DAP Proxy
 */

import { spawn } from 'child_process';
import fs from 'fs-extra';
import { MinimalDapClient } from './minimal-dap.js';
import { DapMirrorServer } from './dap-mirror-server.js';
import { proxyLogPathFor } from './proxy-log-path.js';
import { createLogger, redirectProxyLoggers } from '../utils/logger.js';
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
  // Logger factory for delayed initialization. The level comes from the init
  // payload (CLI --log-level / DEBUG_MCP_LOG_LEVEL, issue #403); legacy parents
  // that send no level keep the historical 'debug'.
  const loggerFactory: ILoggerFactory = async (sessionId: string, logDir: string, level?: string) => {
    const logPath = proxyLogPathFor(logDir, sessionId);
    return createLogger(`dap-proxy:${sessionId}`, {
      level: level ?? 'debug',
      file: logPath
    });
  };

  return {
    loggerFactory,

    redirectProxyLoggers,

    fileSystem: {
      ensureDir: (path: string) => fs.ensureDir(path),
      pathExists: (path: string) => fs.pathExists(path),
      readFile: (path: string, encoding: 'utf8') => fs.readFile(path, encoding),
      remove: (path: string) => fs.remove(path)
    },
    
    processSpawner: {
      // Default windowsHide so no spawn from the proxy can allocate a visible
      // console window on Windows (#215); callers may still override.
      spawn: (command, args, options) => spawn(command, args, { windowsHide: true, ...options })
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
    },

    mirrorServerFactory: {
      create: (host, options) => new DapMirrorServer(host, options)
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
