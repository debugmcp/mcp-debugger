/**
 * Typed error hierarchy for the MCP debugger
 *
 * These errors provide semantic meaning and structured data,
 * avoiding string-based error detection and fragile error wrapping.
 */
import { McpError } from '@modelcontextprotocol/sdk/types.js';
export { ErrorCode as McpErrorCode } from '@modelcontextprotocol/sdk/types.js';
/**
 * Base error for language runtime issues
 */
export declare class LanguageRuntimeNotFoundError extends McpError {
    readonly language: string;
    readonly executablePath: string;
    constructor(language: string, executablePath: string);
}
/**
 * Python-specific runtime not found error
 */
export declare class PythonNotFoundError extends LanguageRuntimeNotFoundError {
    constructor(pythonPath: string);
}
/**
 * Node.js-specific runtime not found error (for future use)
 */
export declare class NodeNotFoundError extends LanguageRuntimeNotFoundError {
    constructor(nodePath: string);
}
/**
 * Session not found error
 */
export declare class SessionNotFoundError extends McpError {
    readonly sessionId: string;
    constructor(sessionId: string);
}
/**
 * Session terminated error
 */
export declare class SessionTerminatedError extends McpError {
    readonly sessionId: string;
    readonly state: string;
    constructor(sessionId: string, state?: string);
}
/**
 * Unsupported language error
 */
export declare class UnsupportedLanguageError extends McpError {
    readonly language: string;
    readonly availableLanguages: string[];
    constructor(language: string, availableLanguages: string[]);
}
/**
 * Proxy not running error
 */
export declare class ProxyNotRunningError extends McpError {
    readonly sessionId: string;
    constructor(sessionId: string, operation: string);
}
/**
 * Debug session creation error
 */
export declare class DebugSessionCreationError extends McpError {
    readonly reason: string;
    readonly originalError?: Error;
    constructor(reason: string, originalError?: Error);
}
/**
 * File validation error
 */
export declare class FileValidationError extends McpError {
    readonly file: string;
    readonly reason: string;
    constructor(file: string, reason: string);
}
/**
 * Port allocation error
 */
export declare class PortAllocationError extends McpError {
    readonly reason: string;
    constructor(reason?: string);
}
/**
 * Type guard to check if an error is a specific MCP error type
 */
export declare function isMcpError<T extends McpError>(error: unknown, errorClass: new (...args: unknown[]) => T): error is T;
/**
 * Helper to extract error message safely
 */
export declare function getErrorMessage(error: unknown): string;
/**
 * Helper to check if an error is recoverable
 */
export declare function isRecoverableError(error: unknown): boolean;
