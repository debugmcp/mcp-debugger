/**
 * Debug MCP Server - Main Server Implementation
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { DebugSessionInfo, Variable, StackFrame, DebugLanguage, Breakpoint } from '@debugmcp/shared';
import { DebugProtocol } from '@vscode/debugprotocol';
/**
 * Configuration options for the Debug MCP Server
 */
export interface DebugMcpServerOptions {
    logLevel?: string;
    logFile?: string;
}
/**
 * Main Debug MCP Server class
 */
export declare class DebugMcpServer {
    server: Server;
    private sessionManager;
    private logger;
    private constructorOptions;
    private supportedLanguages;
    private fileChecker;
    private lineReader;
    private getSupportedLanguagesAsync;
    private getLanguageMetadata;
    /**
     * Validate session exists and is not terminated
     */
    private validateSession;
    createDebugSession(params: {
        language: DebugLanguage;
        name?: string;
        executablePath?: string;
    }): Promise<DebugSessionInfo>;
    startDebugging(sessionId: string, scriptPath: string, args?: string[], dapLaunchArgs?: Partial<DebugProtocol.LaunchRequestArguments>, dryRunSpawn?: boolean): Promise<{
        success: boolean;
        state: string;
        error?: string;
        data?: unknown;
    }>;
    closeDebugSession(sessionId: string): Promise<boolean>;
    setBreakpoint(sessionId: string, file: string, line: number, condition?: string): Promise<Breakpoint>;
    getVariables(sessionId: string, variablesReference: number): Promise<Variable[]>;
    getStackTrace(sessionId: string): Promise<StackFrame[]>;
    getScopes(sessionId: string, frameId: number): Promise<DebugProtocol.Scope[]>;
    continueExecution(sessionId: string): Promise<boolean>;
    stepOver(sessionId: string): Promise<boolean>;
    stepInto(sessionId: string): Promise<boolean>;
    stepOut(sessionId: string): Promise<boolean>;
    constructor(options?: DebugMcpServerOptions);
    /**
     * Sanitize request data for logging (remove sensitive information)
     */
    private sanitizeRequest;
    /**
     * Get session name for logging
     */
    private getSessionName;
    private getPathDescription;
    private registerTools;
    private handleListDebugSessions;
    private handlePause;
    private handleEvaluateExpression;
    private handleGetSourceContext;
    private handleListSupportedLanguages;
    /**
     * Public methods for server lifecycle management
     */
    start(): Promise<void>;
    stop(): Promise<void>;
    /**
     * Get adapter registry from session manager
     */
    getAdapterRegistry(): import("@debugmcp/shared").IAdapterRegistry;
}
