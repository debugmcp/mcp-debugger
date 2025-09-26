import type { Logger as WinstonLoggerType } from 'winston';
import express from 'express';
import { DebugMcpServer } from '../server.js';
import { SSEOptions } from './setup.js';
export interface ServerFactoryOptions {
    logLevel?: string;
    logFile?: string;
}
export interface SSECommandDependencies {
    logger: WinstonLoggerType;
    serverFactory: (options: ServerFactoryOptions) => DebugMcpServer;
    exitProcess?: (code: number) => void;
}
export declare function createSSEApp(options: SSEOptions, dependencies: SSECommandDependencies): express.Application;
export declare function handleSSECommand(options: SSEOptions, dependencies: SSECommandDependencies): Promise<void>;
