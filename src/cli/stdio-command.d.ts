import type { Logger as WinstonLoggerType } from 'winston';
import { DebugMcpServer } from '../server.js';
import { StdioOptions } from './setup.js';
export interface ServerFactoryOptions {
    logLevel?: string;
    logFile?: string;
}
export interface StdioCommandDependencies {
    logger: WinstonLoggerType;
    serverFactory: (options: ServerFactoryOptions) => DebugMcpServer;
    exitProcess?: (code: number) => void;
}
export declare function handleStdioCommand(options: StdioOptions, dependencies: StdioCommandDependencies): Promise<void>;
