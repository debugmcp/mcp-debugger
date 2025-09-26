import type { Logger as WinstonLoggerType } from 'winston';
export interface ErrorHandlerDependencies {
    logger: WinstonLoggerType;
    exitProcess?: (code: number) => void;
}
export declare function setupErrorHandlers(dependencies: ErrorHandlerDependencies): void;
