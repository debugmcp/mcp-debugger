# src/errors/
@generated: 2026-02-09T18:16:05Z

## Overview

The `src/errors` directory provides a comprehensive, typed error handling system for the MCP (Model Context Protocol) debugger. This module defines a semantic error hierarchy that extends the base `McpError` class with structured, domain-specific error types to enable robust error handling and recovery strategies.

## Core Purpose

- **Semantic Error Classification**: Replaces string-based error detection with typed error classes containing structured data
- **Error Recovery Intelligence**: Provides utilities to determine error recoverability for intelligent handling strategies
- **Protocol Compliance**: Maps all errors to appropriate MCP error codes for protocol consistency
- **Developer Experience**: Offers clear error semantics with contextual information for debugging

## Error Hierarchy & Components

### Language Runtime Management
- `LanguageRuntimeNotFoundError`: Base class for runtime discovery issues
- `PythonNotFoundError` / `NodeNotFoundError`: Language-specific runtime errors with executable path context

### Session Lifecycle Management  
- `SessionNotFoundError`: Handles references to non-existent debug sessions
- `SessionTerminatedError`: Manages operations on terminated sessions with state tracking
- `DebugSessionCreationError`: Covers session initialization failures with detailed reasons

### Infrastructure & Networking
- `ProxyNotRunningError`: Handles inactive proxy service scenarios
- `ProxyInitializationError`: Manages proxy startup failures
- `PortAllocationError`: Addresses network port allocation issues

### Validation & Configuration
- `UnsupportedLanguageError`: Handles unsupported language requests with available alternatives
- `FileValidationError`: Manages file validation failures with specific reasons

## Public API Surface

### Error Classes
All error classes follow a consistent pattern:
- Extend `McpError` with appropriate error codes
- Include structured data as readonly properties
- Provide descriptive error messages with context

### Utility Functions
- `isMcpError<T>()`: Type-safe error type checking
- `getErrorMessage()`: Safe error message extraction
- `isRecoverableError()`: Error recovery classification logic

## Internal Organization

### Error Code Mapping
- `InvalidParams`: Configuration and validation errors
- `InvalidRequest`: State-related operation errors  
- `InternalError`: Infrastructure and system-level failures

### Recovery Classification
Errors are categorized by recoverability:
- **Non-recoverable**: Session termination/not found errors
- **Recoverable**: Runtime, proxy, and infrastructure issues
- **Unknown**: Unclassified errors (treated as non-recoverable)

## Key Design Patterns

- **Structured Error Data**: Each error type includes relevant context properties instead of relying on message parsing
- **Protocol Alignment**: All errors map to standard MCP error codes for consistent client handling
- **Type Safety**: Comprehensive TypeScript typing enables compile-time error handling verification
- **Recovery Intelligence**: Built-in logic to determine appropriate error handling strategies

This error system enables the MCP debugger to provide clear, actionable error information while maintaining protocol compliance and supporting intelligent error recovery mechanisms.