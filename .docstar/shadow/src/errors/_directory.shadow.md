# src/errors/
@generated: 2026-02-11T23:47:35Z

## Purpose
The `src/errors` directory provides a comprehensive typed error hierarchy for the MCP (Model Context Protocol) debugger. It defines semantic error classes that extend the base McpError with structured data and specific error codes, enabling type-safe error handling and avoiding brittle string-based error detection throughout the debugger system.

## Core Components

### Error Class Hierarchy
The module organizes errors into logical categories:

- **Runtime Errors**: Language-specific runtime detection failures
  - `LanguageRuntimeNotFoundError` (base class)
  - `PythonNotFoundError`, `NodeNotFoundError` (language-specific implementations)

- **Session Management**: Debug session lifecycle errors
  - `SessionNotFoundError` (invalid session references)
  - `SessionTerminatedError` (operations on terminated sessions)

- **Language Support**: Programming language compatibility
  - `UnsupportedLanguageError` (unsupported language requests)

- **Operational Errors**: Runtime operation failures
  - `ProxyNotRunningError` (missing debug proxy)
  - `DebugSessionCreationError` (session initialization failures)
  - `FileValidationError` (file access issues)
  - `PortAllocationError` (network resource allocation)
  - `ProxyInitializationError` (debug proxy setup failures)

### Utility Functions
- **Type Guards**: `isMcpError<T>()` for safe error type checking
- **Error Handling**: `getErrorMessage()` for safe message extraction
- **Recovery Logic**: `isRecoverableError()` to distinguish between recoverable and fatal errors

## Public API Surface
The module exports all error classes and utility functions, providing:
- Typed error constructors with structured data
- Type guards for error instance checking
- Recovery assessment utilities
- Consistent error message extraction

## Internal Organization
All error classes follow consistent patterns:
- Extend `McpError` with appropriate MCP error codes
- Include structured context data as properties
- Use standardized naming: `[Context][Condition]Error`
- Maintain constructor parameter consistency

## Data Flow
Errors flow from specific operational contexts (runtime detection, session management, file operations) through the typed hierarchy to structured MCP error responses. The utility functions enable safe error handling and recovery decision-making throughout the debugger system.

## Key Patterns
- **Type Safety**: All errors are strongly typed with specific context data
- **Semantic Clarity**: Error names clearly indicate the failure context and condition
- **Recoverability**: Built-in classification of recoverable vs. non-recoverable errors
- **MCP Compliance**: All errors map to appropriate MCP error codes for protocol consistency