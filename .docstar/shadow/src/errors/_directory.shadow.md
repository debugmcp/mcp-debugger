# src\errors/
@generated: 2026-02-12T21:00:53Z

## Purpose
The errors module provides a comprehensive typed error hierarchy for MCP (Model Context Protocol) debugger operations. It extends the base MCP error system with domain-specific error classes that enable structured error handling, semantic error detection, and recovery strategies throughout the debugger system.

## Architecture & Design Patterns
The module follows a hierarchical error design pattern where all errors extend the base `McpError` class from the MCP SDK. Each error class is designed with:
- **Structured Data**: Typed properties containing contextual information about the error
- **Semantic Error Codes**: Appropriate `McpErrorCode` values for standardized error classification
- **Consistent Naming**: `[Context][Condition]Error` convention for clear error identification
- **Recovery Semantics**: Clear distinction between recoverable and non-recoverable errors

## Core Error Categories

### Runtime Environment Errors
- **LanguageRuntimeNotFoundError**: Base class for missing language runtime executables
- **PythonNotFoundError** & **NodeNotFoundError**: Language-specific runtime errors
- These errors are recoverable and indicate environment setup issues

### Session Management Errors
- **SessionNotFoundError**: Invalid session ID references
- **SessionTerminatedError**: Operations attempted on terminated sessions
- **DebugSessionCreationError**: Failures during session initialization
- Critical for session lifecycle management and state validation

### Operational Errors
- **ProxyNotRunningError**: Missing active debug proxy for operations
- **ProxyInitializationError**: Debug proxy setup and configuration failures
- **PortAllocationError**: Network resource allocation failures
- **FileValidationError**: File access and validation issues
- **UnsupportedLanguageError**: Unsupported programming language requests

## Public API Surface

### Error Classes
All error classes are exported and provide structured error data with appropriate MCP error codes. Key constructors accept contextual parameters (sessionId, language, reason, etc.) for detailed error reporting.

### Utility Functions
- **`isMcpError<T>(error): error is T`**: Generic type guard for MCP error instance checking
- **`getErrorMessage(error): string`**: Safe error message extraction from any error type
- **`isRecoverableError(error): boolean`**: Determines if an error condition can be recovered from

## Error Recovery Strategy
The module implements a clear recovery classification:
- **Recoverable Errors**: `ProxyNotRunningError`, `LanguageRuntimeNotFoundError` - can be retried after remediation
- **Non-Recoverable Errors**: `SessionTerminatedError`, `SessionNotFoundError` - require session restart or cleanup

## Integration Points
- Integrates with MCP SDK error handling infrastructure via `McpError` base class
- Provides type-safe error detection throughout the debugger system
- Enables structured error reporting and logging with contextual data
- Supports error recovery strategies in session management and proxy operations

This error system serves as the foundation for robust error handling across the MCP debugger, enabling both programmatic error detection and human-readable error reporting.