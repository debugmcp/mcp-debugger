# src\errors/
@generated: 2026-02-12T21:05:40Z

## Purpose
The `src/errors` directory provides a comprehensive typed error hierarchy for the MCP (Model Context Protocol) debugger. It defines semantic error classes that extend the base `McpError` to provide structured, type-safe error handling with specific error codes, avoiding string-based error detection and enabling more robust error recovery strategies.

## Key Components

### Core Error Hierarchy
All error classes extend `McpError` from the MCP SDK and are organized into functional categories:

- **Runtime Errors**: `LanguageRuntimeNotFoundError`, `PythonNotFoundError`, `NodeNotFoundError` - Handle missing language runtime executables
- **Session Management**: `SessionNotFoundError`, `SessionTerminatedError` - Manage debug session lifecycle errors
- **Language Support**: `UnsupportedLanguageError` - Handle unsupported programming language scenarios
- **Operational Errors**: `ProxyNotRunningError`, `DebugSessionCreationError`, `FileValidationError`, `PortAllocationError`, `ProxyInitializationError` - Cover various operational failure modes

### Error Utilities
- **Type Guards**: `isMcpError<T>` for runtime type checking
- **Message Extraction**: `getErrorMessage` for safe error message retrieval
- **Recovery Classification**: `isRecoverableError` to distinguish between recoverable and fatal errors

## Public API Surface

### Main Entry Points
- **Error Classes**: All error constructors accept structured data relevant to their specific failure context
- **Utility Functions**: 
  - `isMcpError<T>(error: unknown): error is T` - Type-safe error instance checking
  - `getErrorMessage(error: unknown): string` - Safe message extraction
  - `isRecoverableError(error: McpError): boolean` - Recovery strategy determination

## Internal Organization

### Data Flow Pattern
1. Errors are created with context-specific structured data (sessionId, language, reason, etc.)
2. All errors use appropriate MCP error codes (`InvalidParams`, `InvalidRequest`, `InternalError`)
3. Error utilities provide type-safe handling and recovery decision support
4. Original error context is preserved through stack traces and nested error properties

### Design Conventions
- **Consistent Naming**: `[Context][Condition]Error` pattern
- **Structured Data**: Each error class includes relevant properties for debugging context
- **Error Code Mapping**: Semantic mapping to MCP standard error codes
- **Recovery Classification**: Clear distinction between recoverable and non-recoverable errors

## Integration Patterns
This error system integrates with the broader MCP debugger by providing:
- Type-safe error handling throughout the debugger components
- Structured error context for logging and debugging
- Recovery strategy guidance for error handling middleware
- Consistent error reporting to MCP clients

The module serves as the foundation for robust error handling across session management, language runtime discovery, debug proxy operations, and file system interactions.