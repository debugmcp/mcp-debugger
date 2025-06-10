import type { Logger as WinstonLoggerType } from 'winston';

export interface ErrorHandlerDependencies {
  logger: WinstonLoggerType;
  exitProcess?: (code: number) => void;
}

export function setupErrorHandlers(dependencies: ErrorHandlerDependencies): void {
  const { logger, exitProcess = process.exit } = dependencies;

  process.on('uncaughtException', (err: Error, origin: string) => {
    logger.error(`[Server UNCAUGHT_EXCEPTION] Origin: ${origin}`, { 
      errorName: err.name, 
      errorMessage: err.message, 
      errorStack: err.stack 
    });
    exitProcess(1);
  });

  process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
    logger.error('[Server UNHANDLED_REJECTION] Reason:', { reason });
    logger.error('[Server UNHANDLED_REJECTION] Promise:', { promise });
    exitProcess(1);
  });
}
