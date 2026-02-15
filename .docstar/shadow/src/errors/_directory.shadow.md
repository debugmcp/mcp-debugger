# src\errors/
@children-hash: 310c2d668524f424
@generated: 2026-02-15T09:01:22Z

## Purpose
The `src/errors` directory provides a comprehensive typed error system for the MCP (Model Context Protocol) debugger. It establishes a semantic error hierarchy that extends the base MCP SDK error framework with debugger-specific error classes, enabling structured error handling and avoiding brittle string-based error detection.

## Key Components

### Error Hierarchy
The module defines specialized error classes organized by functional domain:

- **Runtime Errors**: `LanguageRuntimeNotFoundError`, `PythonNotFoundError`, `NodeNotFoundError` - Handle missing language runtime executables
- **Session Management**: `SessionNotFoundError`, `SessionTerminatedError` - Manage debug session lifecycle errors  
- **Language Support**: `UnsupportedLanguageError` - Handle unsupported programming languages
- **Operational Errors**: `ProxyNotRunningError`, `DebugSessionCreationError`, `FileValidationError`, `PortAllocationError`, `ProxyInitializationError` - Cover various runtime operational failures

### Error Utilities
Provides essential helper functions for error handling:
- Type guards (`isMcpError<T>`) for safe error type checking
- Error message extraction (`getErrorMessage`) with fallback handling
- Recoverability detection (`isRecoverableError`) to distinguish between fatal and recoverable errors

## Public API Surface

### Main Entry Points
- **Error Classes**: All error classes are exportable and instantiable with structured data
- **Type Guards**: `isMcpError<T>` for runtime type checking
- **Utilities**: `getErrorMessage`, `isRecoverableError` for error processing

### Integration Points
- Extends `@modelcontextprotocol/sdk` base `McpError` class
- Uses standardized MCP `ErrorCode` enum values
- Provides structured error data for consistent error context

## Internal Organization

### Data Flow
1. Errors are constructed with semantic context data (session IDs, file paths, reasons, etc.)
2. Base MCP error codes are assigned based on error category
3. Structured data is preserved for upstream error handling
4. Utility functions provide safe error introspection and classification

### Architectural Patterns
- **Semantic Inheritance**: Each error class represents a specific failure mode with relevant context
- **Structured Data**: All errors carry typed properties for programmatic handling
- **Error Classification**: Clear separation between recoverable and non-recoverable errors
- **Type Safety**: Full TypeScript support with generic type guards
- **Consistent Naming**: `[Context][Condition]Error` convention for clarity

## Role in Larger System
This error system serves as the foundation for reliable error handling throughout the MCP debugger, providing:
- Structured error reporting to MCP clients
- Type-safe error handling in debug session management
- Consistent error semantics across language runtime integrations
- Recoverability hints for automated error recovery strategies