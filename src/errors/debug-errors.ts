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
 * Base for mcp-debugger's typed errors.
 *
 * McpError's constructor bakes `MCP error <code>: ` into `.message`, which is
 * right on the JSON-RPC path (the SDK derives the wire error from it) and wrong
 * inside a tool result envelope, where it reads like a transport failure
 * (issue #647). The SDK keeps no copy of the plain text, so this base records
 * it as `detail`; tool result envelopes and getErrorMessage() report that.
 */
export abstract class DebugError extends McpError {
  /** The message without the SDK's `MCP error <code>: ` prefix. */
  public readonly detail: string;

  protected constructor(code: McpErrorCode, detail: string, data?: unknown) {
    super(code, detail, data);
    this.detail = detail;
  }
}

/**
 * Base error for language runtime issues
 */
export class LanguageRuntimeNotFoundError extends DebugError {
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
export class SessionNotFoundError extends DebugError {
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
export class SessionTerminatedError extends DebugError {
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
export class UnsupportedLanguageError extends DebugError {
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
 * A debug feature was requested that the session's adapter does not support
 * (e.g. a logpoint on an adapter without SourceBreakpoint.logMessage support).
 */
export class UnsupportedFeatureError extends DebugError {
  public readonly feature: string;
  public readonly language: string;

  constructor(feature: string, language: string, detail?: string) {
    super(
      McpErrorCode.InvalidParams,
      `${feature} not supported by the ${language} adapter${detail ? `: ${detail}` : ''}`,
      { feature, language }
    );
    this.feature = feature;
    this.language = language;
  }
}

/**
 * Proxy not running error
 */
export class ProxyNotRunningError extends DebugError {
  public readonly sessionId: string;
  public readonly operation: string;

  constructor(sessionId: string, operation: string) {
    super(
      McpErrorCode.InvalidRequest,
      `Cannot ${operation}: no active proxy for session ${sessionId}`,
      { sessionId, operation }
    );
    this.sessionId = sessionId;
    this.operation = operation;
  }
}

/**
 * Debug session creation error
 */
export class DebugSessionCreationError extends DebugError {
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
 * Helper to extract a user-facing error message safely. A DebugError reports
 * its plain `detail` rather than the prefixed McpError message (issue #647).
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof DebugError) {
    return error.detail;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

