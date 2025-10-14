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
  public readonly language: string;
  public readonly executablePath: string;

  constructor(language: string, executablePath: string) {
    super(
      McpErrorCode.InvalidParams,
      `${language} runtime not found at: ${executablePath}`,
      { language, executablePath }
    );
    this.language = language;
    this.executablePath = executablePath;
  }
}

/**
 * Python-specific runtime not found error
 */
export class PythonNotFoundError extends LanguageRuntimeNotFoundError {
  constructor(pythonPath: string) {
    super('Python', pythonPath);
  }
}

/**
 * Node.js-specific runtime not found error (for future use)
 */
export class NodeNotFoundError extends LanguageRuntimeNotFoundError {
  constructor(nodePath: string) {
    super('Node.js', nodePath);
  }
}

/**
 * Session not found error
 */
export class SessionNotFoundError extends McpError {
  public readonly sessionId: string;

  constructor(sessionId: string) {
    super(
      McpErrorCode.InvalidParams,
      `Session not found: ${sessionId}`,
      { sessionId }
    );
    this.sessionId = sessionId;
  }
}

/**
 * Session terminated error
 */
export class SessionTerminatedError extends McpError {
  public readonly sessionId: string;
  public readonly state: string;

  constructor(sessionId: string, state: string = 'TERMINATED') {
    super(
      McpErrorCode.InvalidRequest,
      `Session is terminated: ${sessionId}`,
      { sessionId, state }
    );
    this.sessionId = sessionId;
    this.state = state;
  }
}

/**
 * Unsupported language error
 */
export class UnsupportedLanguageError extends McpError {
  public readonly language: string;
  public readonly availableLanguages: string[];

  constructor(language: string, availableLanguages: string[]) {
    super(
      McpErrorCode.InvalidParams,
      `Language '${language}' is not supported. Available languages: ${availableLanguages.join(', ')}`,
      { language, availableLanguages }
    );
    this.language = language;
    this.availableLanguages = availableLanguages;
  }
}

/**
 * Proxy not running error
 */
export class ProxyNotRunningError extends McpError {
  public readonly sessionId: string;

  constructor(sessionId: string, operation: string) {
    super(
      McpErrorCode.InvalidRequest,
      `Cannot ${operation}: no active proxy for session ${sessionId}`,
      { sessionId, operation }
    );
    this.sessionId = sessionId;
  }
}

/**
 * Debug session creation error
 */
export class DebugSessionCreationError extends McpError {
  public readonly reason: string;
  public readonly originalError?: Error;

  constructor(reason: string, originalError?: Error) {
    super(
      McpErrorCode.InternalError,
      `Failed to create debug session: ${reason}`,
      {
        reason,
        originalMessage: originalError?.message,
        originalStack: originalError?.stack
      }
    );
    this.reason = reason;
    this.originalError = originalError;
  }
}

/**
 * File validation error
 */
export class FileValidationError extends McpError {
  public readonly file: string;
  public readonly reason: string;

  constructor(file: string, reason: string) {
    super(
      McpErrorCode.InvalidParams,
      `File validation failed for ${file}: ${reason}`,
      { file, reason }
    );
    this.file = file;
    this.reason = reason;
  }
}

/**
 * Port allocation error
 */
export class PortAllocationError extends McpError {
  public readonly reason: string;

  constructor(reason: string = 'No available ports') {
    super(
      McpErrorCode.InternalError,
      `Port allocation failed: ${reason}`,
      { reason }
    );
    this.reason = reason;
  }
}

/**
 * Proxy initialization error
 */
export class ProxyInitializationError extends McpError {
  public readonly sessionId: string;
  public readonly reason: string;

  constructor(sessionId: string, reason: string) {
    super(
      McpErrorCode.InternalError,
      `Failed to initialize proxy for session ${sessionId}: ${reason}`,
      { sessionId, reason }
    );
    this.sessionId = sessionId;
    this.reason = reason;
  }
}

/**
 * Type guard to check if an error is a specific MCP error type
 */
export function isMcpError<T extends McpError>(
  error: unknown,
  errorClass: new (...args: unknown[]) => T
): error is T {
  return error instanceof errorClass;
}

/**
 * Helper to extract error message safely
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * Helper to check if an error is recoverable
 */
export function isRecoverableError(error: unknown): boolean {
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
