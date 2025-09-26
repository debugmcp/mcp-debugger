/**
 * Typed error hierarchy for the MCP debugger
 *
 * These errors provide semantic meaning and structured data,
 * avoiding string-based error detection and fragile error wrapping.
 */
import { McpError } from '@modelcontextprotocol/sdk/types.js';
// Re-export error codes for convenience
export { ErrorCode as McpErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { ErrorCode as McpErrorCode } from '@modelcontextprotocol/sdk/types.js';
/**
 * Base error for language runtime issues
 */
export class LanguageRuntimeNotFoundError extends McpError {
    language;
    executablePath;
    constructor(language, executablePath) {
        super(McpErrorCode.InvalidParams, `${language} runtime not found at: ${executablePath}`, { language, executablePath });
        this.language = language;
        this.executablePath = executablePath;
    }
}
/**
 * Python-specific runtime not found error
 */
export class PythonNotFoundError extends LanguageRuntimeNotFoundError {
    constructor(pythonPath) {
        super('Python', pythonPath);
    }
}
/**
 * Node.js-specific runtime not found error (for future use)
 */
export class NodeNotFoundError extends LanguageRuntimeNotFoundError {
    constructor(nodePath) {
        super('Node.js', nodePath);
    }
}
/**
 * Session not found error
 */
export class SessionNotFoundError extends McpError {
    sessionId;
    constructor(sessionId) {
        super(McpErrorCode.InvalidParams, `Session not found: ${sessionId}`, { sessionId });
        this.sessionId = sessionId;
    }
}
/**
 * Session terminated error
 */
export class SessionTerminatedError extends McpError {
    sessionId;
    state;
    constructor(sessionId, state = 'TERMINATED') {
        super(McpErrorCode.InvalidRequest, `Session is terminated: ${sessionId}`, { sessionId, state });
        this.sessionId = sessionId;
        this.state = state;
    }
}
/**
 * Unsupported language error
 */
export class UnsupportedLanguageError extends McpError {
    language;
    availableLanguages;
    constructor(language, availableLanguages) {
        super(McpErrorCode.InvalidParams, `Language '${language}' is not supported. Available languages: ${availableLanguages.join(', ')}`, { language, availableLanguages });
        this.language = language;
        this.availableLanguages = availableLanguages;
    }
}
/**
 * Proxy not running error
 */
export class ProxyNotRunningError extends McpError {
    sessionId;
    constructor(sessionId, operation) {
        super(McpErrorCode.InvalidRequest, `Cannot ${operation}: no active proxy for session ${sessionId}`, { sessionId, operation });
        this.sessionId = sessionId;
    }
}
/**
 * Debug session creation error
 */
export class DebugSessionCreationError extends McpError {
    reason;
    originalError;
    constructor(reason, originalError) {
        super(McpErrorCode.InternalError, `Failed to create debug session: ${reason}`, {
            reason,
            originalMessage: originalError?.message,
            originalStack: originalError?.stack
        });
        this.reason = reason;
        this.originalError = originalError;
    }
}
/**
 * File validation error
 */
export class FileValidationError extends McpError {
    file;
    reason;
    constructor(file, reason) {
        super(McpErrorCode.InvalidParams, `File validation failed for ${file}: ${reason}`, { file, reason });
        this.file = file;
        this.reason = reason;
    }
}
/**
 * Port allocation error
 */
export class PortAllocationError extends McpError {
    reason;
    constructor(reason = 'No available ports') {
        super(McpErrorCode.InternalError, `Port allocation failed: ${reason}`, { reason });
        this.reason = reason;
    }
}
/**
 * Type guard to check if an error is a specific MCP error type
 */
export function isMcpError(error, errorClass) {
    return error instanceof errorClass;
}
/**
 * Helper to extract error message safely
 */
export function getErrorMessage(error) {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}
/**
 * Helper to check if an error is recoverable
 */
export function isRecoverableError(error) {
    // Session terminated or not found errors are not recoverable
    if (error instanceof SessionTerminatedError ||
        error instanceof SessionNotFoundError) {
        return false;
    }
    // Proxy not running might be recoverable by restarting
    if (error instanceof ProxyNotRunningError) {
        return true;
    }
    // Language runtime errors might be recoverable by fixing the path
    if (error instanceof LanguageRuntimeNotFoundError) {
        return true;
    }
    // Default to not recoverable for unknown errors
    return false;
}
//# sourceMappingURL=debug-errors.js.map