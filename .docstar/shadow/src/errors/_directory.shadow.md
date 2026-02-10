# src/errors/
@generated: 2026-02-10T21:26:16Z

## Purpose
The `src/errors` directory provides a comprehensive typed error handling system for the MCP (Model Context Protocol) debugger. It defines a hierarchical set of domain-specific error classes that extend the base MCP error framework, enabling precise error classification and handling throughout the debugger's lifecycle.

## Key Components

### Core Error Hierarchy
The module organizes errors into logical categories based on debugger operations:

- **Runtime Errors**: Handle missing or invalid language executables (`PythonNotFoundError`, `NodeNotFoundError`)
- **Session Management**: Track session lifecycle issues (`SessionNotFoundError`, `SessionTerminatedError`) 
- **Language Support**: Manage unsupported programming languages (`UnsupportedLanguageError`)
- **Operational Errors**: Cover runtime failures (`ProxyNotRunningError`, `DebugSessionCreationError`, `FileValidationError`, `PortAllocationError`, `ProxyInitializationError`)

### Error Utilities
Provides helper functions for error handling:
- Type guards for safe error type checking (`isMcpError`)
- Error message extraction (`getErrorMessage`) 
- Recoverability assessment (`isRecoverableError`)

## Public API Surface

### Main Entry Points
- **Error Classes**: All error types are exported for use throughout the debugger
- **Type Guards**: `isMcpError<T>()` for type-safe error detection
- **Utilities**: `getErrorMessage()` and `isRecoverableError()` for error processing

### Error Construction Pattern
All errors follow a consistent pattern:
```typescript
new ErrorType(contextData, message?)
```
Where `contextData` provides structured information about the error condition.

## Internal Organization

### Data Flow
1. **Error Creation**: Errors capture structured context data and appropriate MCP error codes
2. **Error Propagation**: Errors maintain original stack traces and error chains where applicable
3. **Error Recovery**: Utility functions determine if operations can be retried or should fail permanently

### Design Patterns
- **Inheritance Hierarchy**: All errors extend `McpError` with specific error codes
- **Structured Data**: Errors carry typed context information rather than just messages
- **Semantic Classification**: Error types indicate specific failure modes for targeted handling
- **Recoverability Logic**: Clear distinction between transient failures and permanent errors

## Integration Points
This error system integrates with the broader MCP SDK error framework while providing debugger-specific semantics. It enables the debugger to provide meaningful error responses to MCP clients and implement appropriate retry/recovery strategies based on error types.