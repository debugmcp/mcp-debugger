import type { Logger as WinstonLoggerType } from 'winston';
import type { ProcessLike } from '../interfaces/process-interfaces.js';

export interface ErrorHandlerDependencies {
  logger: WinstonLoggerType;
  exitProcess?: (code: number) => void;
  /** Injectable process handle for handler registration (issue #183); defaults to the global process. */
  proc?: ProcessLike;
}

export function setupErrorHandlers(dependencies: ErrorHandlerDependencies): void {
  const proc = dependencies.proc ?? process;
  const { logger, exitProcess = (code: number) => proc.exit(code) } = dependencies;

  proc.on('uncaughtException', (err: Error, origin: string) => {
    logger.error(`[Server UNCAUGHT_EXCEPTION] Origin: ${origin}`, {
      errorName: err.name,
      errorMessage: err.message,
      errorStack: err.stack
    });
    exitProcess(1);
  });

  proc.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
    logger.error('[Server UNHANDLED_REJECTION] Reason:', { reason });
    logger.error('[Server UNHANDLED_REJECTION] Promise:', { promise });
    // Do not exit: in a long-running server (HTTP server mode), stray rejections
    // should not kill the process. Fatal errors surface as uncaughtExceptions.
  });
}
