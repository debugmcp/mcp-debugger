# src/errors/debug-errors.ts
@source-hash: 8a315a7b2787365d
@generated: 2026-02-09T18:15:03Z

**Primary Purpose**: Defines a typed error hierarchy for the MCP (Model Context Protocol) debugger, providing semantic error types that extend `McpError` with structured data to avoid string-based error detection.

**Key Dependencies**:
- `McpError` and `ErrorCode` from `@modelcontextprotocol/sdk/types.js` (L8, L11-12)

**Error Classes Hierarchy**:

**Base Language Runtime Error**:
- `LanguageRuntimeNotFoundError` (L17-30): Base class for language runtime issues with `language` and `executablePath` properties, uses `McpErrorCode.InvalidParams`

**Language-Specific Runtime Errors**:
- `PythonNotFoundError` (L35-39): Extends `LanguageRuntimeNotFoundError` for Python runtime issues
- `NodeNotFoundError` (L44-48): Extends `LanguageRuntimeNotFoundError` for Node.js runtime issues (marked for future use)

**Session Management Errors**:
- `SessionNotFoundError` (L53-64): Handles missing session scenarios with `sessionId` property, uses `McpErrorCode.InvalidParams`
- `SessionTerminatedError` (L69-82): Handles terminated session operations with `sessionId` and `state` properties, uses `McpErrorCode.InvalidRequest`

**Configuration & Validation Errors**:
- `UnsupportedLanguageError` (L87-100): Handles unsupported language requests with `language` and `availableLanguages` properties, uses `McpErrorCode.InvalidParams`
- `FileValidationError` (L143-156): Handles file validation failures with `file` and `reason` properties, uses `McpErrorCode.InvalidParams`

**Infrastructure Errors**:
- `ProxyNotRunningError` (L105-116): Handles inactive proxy scenarios with `sessionId` property, uses `McpErrorCode.InvalidRequest`
- `DebugSessionCreationError` (L121-138): Handles session creation failures with `reason` and optional `originalError` properties, uses `McpErrorCode.InternalError`
- `PortAllocationError` (L161-172): Handles port allocation failures with `reason` property, uses `McpErrorCode.InternalError`
- `ProxyInitializationError` (L177-190): Handles proxy initialization failures with `sessionId` and `reason` properties, uses `McpErrorCode.InternalError`

**Utility Functions**:
- `isMcpError<T>()` (L195-200): Type guard for checking specific MCP error types using instanceof
- `getErrorMessage()` (L205-210): Safe error message extraction utility
- `isRecoverableError()` (L215-234): Determines if errors can be recovered from - returns false for session termination/not found, true for proxy/runtime issues, false for unknown errors

**Architectural Patterns**:
- All custom errors extend `McpError` and include structured data in constructor
- Each error type maps to appropriate `McpErrorCode` values
- Consistent property exposure pattern with readonly fields
- Error recovery logic categorizes errors by recoverability

**Critical Design Decisions**:
- Uses semantic error types instead of string-based error detection
- Structured error data prevents fragile error wrapping
- Recovery classification enables intelligent error handling strategies