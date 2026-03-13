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
 * Helper to extract error message safely
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

