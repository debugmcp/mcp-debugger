import { Command } from 'commander';
export interface StdioOptions {
    logLevel?: string;
    logFile?: string;
}
export interface SSEOptions {
    port: string;
    logLevel?: string;
    logFile?: string;
}
export type StdioHandler = (options: StdioOptions, command?: Command) => Promise<void>;
export type SSEHandler = (options: SSEOptions, command?: Command) => Promise<void>;
export declare function createCLI(name: string, description: string, version: string): Command;
export declare function setupStdioCommand(program: Command, handler: StdioHandler): void;
export declare function setupSSECommand(program: Command, handler: SSEHandler): void;
