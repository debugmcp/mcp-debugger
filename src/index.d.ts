#!/usr/bin/env node
/**
 * Debug MCP Server - Entry Point
 *
 * This is the main entry point for the Debug MCP Server.
 */
import { DebugMcpServer } from './server.js';
import { setupErrorHandlers } from './cli/error-handlers.js';
import { createCLI, setupStdioCommand, setupSSECommand } from './cli/setup.js';
import { handleStdioCommand } from './cli/stdio-command.js';
import { handleSSECommand } from './cli/sse-command.js';
export interface ServerOptions {
    logLevel?: string;
    logFile?: string;
}
export declare function createDebugMcpServer(options: ServerOptions): DebugMcpServer;
export declare function main(): Promise<void>;
export { setupErrorHandlers, createCLI, setupStdioCommand, setupSSECommand, handleStdioCommand, handleSSECommand };
