/**
 * Typed error hierarchy for the MCP debugger
 *
 * These errors provide semantic meaning and structured data,
 * avoiding string-based error detection and fragile error wrapping.
 */

import { ProtocolError, ProtocolErrorCode } from '@modelcontextprotocol/server';

// Re-exported under the v1 name: the protocol's JSON-RPC codes. (The v2 SDK's
// own transport codes split off into SdkErrorCode, a string enum.)
export { ProtocolErrorCode as McpErrorCode } from '@modelcontextprotocol/server';

/**
 * Base for mcp-debugger's typed errors.
 *
 * The v1 SDK's McpError constructor baked `MCP error <code>: ` into
 * `.message`, which was right for logs and in-process callers and wrong
 * inside a tool result envelope, where it read like a transport failure
 * (issue #647), so this base records the plain text as `detail`; tool result
 * envelopes and getErrorMessage() report that, and the JSON-RPC boundary
 * sends it on the wire (toWireError, issue #659). The v2 SDK's ProtocolError
 * adds no prefix, so `.message` and `.detail` now coincide; `detail` stays
 * the one name the envelopes read, whatever the SDK does to `.message`.
 */
export abstract class DebugError extends ProtocolError {
  /** The plain text, without any `MCP error <code>: ` prefix the SDK may put on `.message`. */
  public readonly detail: string;

  protected constructor(code: ProtocolErrorCode, detail: string, data?: unknown) {
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
      ProtocolErrorCode.InvalidParams,
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
      ProtocolErrorCode.InvalidParams,
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
      ProtocolErrorCode.InvalidRequest,
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
      ProtocolErrorCode.InvalidParams,
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
      ProtocolErrorCode.InvalidParams,
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
      ProtocolErrorCode.InvalidRequest,
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
      ProtocolErrorCode.InternalError,
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
 * The plain text of a ProtocolError: a DebugError's recorded `detail`,
 * otherwise `.message`. The v1 SDK's constructor prefixed `.message` with
 * `MCP error <code>: ` and this stripped exactly that one layer; the v2 SDK's
 * ProtocolError adds nothing, so the message is the detail and a message that
 * begins with that text carries it on purpose.
 */
export function mcpErrorDetail(error: ProtocolError): string {
  return error instanceof DebugError ? error.detail : error.message;
}

/**
 * The ProtocolError shape the JSON-RPC boundary throws (issue #659).
 *
 * The SDK's Protocol copies a thrown error's `.code` and `.message` verbatim
 * into the JSON-RPC error. With the v1 SDK the client-side constructor then
 * prefixed `MCP error <code>: ` again, so an ordinary McpError thrown from a
 * request handler reached SDK clients as `MCP error -32602: MCP error -32602: …`.
 * This subclass keeps the class (instanceof, `.code`, `.data`) and sets
 * `.message` to the bare detail so the wire carries the text exactly once,
 * whichever SDK generation built the error. It is for the request-handler
 * boundary only; everything upstream keeps throwing ProtocolError / DebugError.
 */
export class WireMcpError extends ProtocolError {
  constructor(code: ProtocolErrorCode, detail: string, data?: unknown) {
    super(code, detail, data);
    this.message = detail;
  }
}

/** Convert a ProtocolError for the JSON-RPC boundary; a WireMcpError passes through. */
export function toWireError(error: ProtocolError): WireMcpError {
  if (error instanceof WireMcpError) {
    return error;
  }
  const wire = new WireMcpError(error.code, mcpErrorDetail(error), error.data);
  if (error.stack) {
    wire.stack = error.stack;
  }
  return wire;
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

