# src/errors/
@generated: 2026-02-10T01:19:36Z

## Purpose
The `errors` directory provides a comprehensive typed error hierarchy for the MCP (Model Context Protocol) debugger, establishing semantic error classes that extend the base `McpError` with structured data and specific error codes. This enables type-safe error handling throughout the debugger system while avoiding string-based error detection anti-patterns.

## Architecture Overview
The error system is built around extending the MCP SDK's `McpError` base class with domain-specific error types that encapsulate both error context and appropriate MCP error codes. All errors follow a consistent pattern of accepting structured data in their constructors and passing it to the base class for standardized error representation.

## Error Categories

### Runtime Environment Errors
- **LanguageRuntimeNotFoundError**: Abstract base for missing language executables
- **PythonNotFoundError** / **NodeNotFoundError**: Concrete implementations for Python and Node.js runtime detection failures
- Captures executable paths and language identifiers for debugging

### Session Management Errors
- **SessionNotFoundError**: Invalid session ID references during operations
- **SessionTerminatedError**: Attempts to use already-terminated debug sessions
- Maintains session state and ID context for recovery scenarios

### Language Support Errors
- **UnsupportedLanguageError**: Requests for unsupported programming languages
- Includes available language alternatives for user guidance

### Operational Errors
- **ProxyNotRunningError**: Missing active debug proxy for session operations
- **DebugSessionCreationError**: Failures during debug session initialization
- **FileValidationError**: File access and validation issues
- **PortAllocationError**: Network port allocation failures
- **ProxyInitializationError**: Debug proxy setup and configuration failures

## Public API Surface

### Error Classes
All error classes are exported and can be instantiated with appropriate context data. Each follows the pattern:
```typescript
new SpecificError(contextData) // Automatically maps to appropriate McpError code
```

### Utility Functions
- **`isMcpError<T>(error: unknown): error is T`**: Generic type guard for MCP error instances
- **`getErrorMessage(error: unknown): string`**: Safe error message extraction
- **`isRecoverableError(error: Error): boolean`**: Determines error recoverability for retry logic

## Data Flow and Integration
The error system integrates with the MCP protocol by:
1. Mapping domain-specific errors to appropriate `ErrorCode` values
2. Preserving structured error data for client consumption
3. Supporting error recovery patterns through recoverability detection
4. Maintaining error context through the debugging workflow

## Key Patterns
- **Structured Error Data**: All errors carry typed context information
- **MCP Protocol Compliance**: Proper error code mapping for protocol compatibility
- **Recovery Strategy Support**: Clear distinction between recoverable and terminal errors
- **Type Safety**: Full TypeScript support with generic type guards
- **Consistent Naming**: `[Context][Condition]Error` convention for clarity

This error system serves as the foundation for robust error handling throughout the MCP debugger, enabling graceful degradation and meaningful error reporting while maintaining protocol compliance.