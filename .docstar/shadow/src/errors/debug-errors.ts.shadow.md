# src/errors/debug-errors.ts
@source-hash: 8a315a7b2787365d
@generated: 2026-02-10T00:41:53Z

## Purpose
Defines a typed error hierarchy for the MCP (Model Context Protocol) debugger, providing semantic error classes that extend the base McpError with structured data and specific error codes to avoid string-based error detection.

## Dependencies
- **@modelcontextprotocol/sdk/types.js**: Imports `McpError` base class and `ErrorCode` enum for standardized MCP error handling

## Core Error Classes

### Runtime Errors
- **LanguageRuntimeNotFoundError (L17-30)**: Base class for missing language runtime executables
  - Properties: `language`, `executablePath`
  - Uses `McpErrorCode.InvalidParams`
- **PythonNotFoundError (L35-39)**: Python-specific runtime error extending LanguageRuntimeNotFoundError
- **NodeNotFoundError (L44-48)**: Node.js-specific runtime error (marked for future use)

### Session Management Errors
- **SessionNotFoundError (L53-64)**: Invalid session ID reference
  - Property: `sessionId`
  - Uses `McpErrorCode.InvalidParams`
- **SessionTerminatedError (L69-82)**: Operations on terminated sessions
  - Properties: `sessionId`, `state` (defaults to 'TERMINATED')
  - Uses `McpErrorCode.InvalidRequest`

### Language Support Errors
- **UnsupportedLanguageError (L87-100)**: Unsupported programming language
  - Properties: `language`, `availableLanguages[]`
  - Uses `McpErrorCode.InvalidParams`

### Operational Errors
- **ProxyNotRunningError (L105-116)**: Missing active debug proxy
  - Property: `sessionId`
  - Constructor accepts `operation` parameter for context
- **DebugSessionCreationError (L121-138)**: Debug session initialization failures
  - Properties: `reason`, `originalError?`
  - Captures original error stack traces
- **FileValidationError (L143-156)**: File access/validation issues
  - Properties: `file`, `reason`
- **PortAllocationError (L161-172)**: Network port allocation failures
  - Property: `reason` (defaults to 'No available ports')
- **ProxyInitializationError (L177-190)**: Debug proxy setup failures
  - Properties: `sessionId`, `reason`

## Utility Functions

### Error Type Guards and Helpers (L195-234)
- **isMcpError<T> (L195-200)**: Generic type guard for MCP error instances
- **getErrorMessage (L205-210)**: Safe error message extraction
- **isRecoverableError (L215-234)**: Determines if errors can be recovered from
  - Non-recoverable: SessionTerminatedError, SessionNotFoundError
  - Recoverable: ProxyNotRunningError, LanguageRuntimeNotFoundError

## Architectural Patterns
- All errors extend McpError with appropriate error codes
- Structured data passed to base constructor for consistent error context
- Type-safe error handling with TypeScript generics
- Clear separation between recoverable and non-recoverable error conditions
- Consistent naming convention: `[Context][Condition]Error`