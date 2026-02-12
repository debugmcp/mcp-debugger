# src\utils/
@generated: 2026-02-12T21:00:59Z

## Overall Purpose

The `src/utils` directory provides core utility infrastructure for the Debug MCP Server, focusing on cross-environment compatibility, error handling, logging, file operations, and type safety. This module serves as the foundational layer supporting the server's ability to operate seamlessly in both host and container deployment modes while maintaining robust debugging capabilities.

## Key Components and Architecture

### Cross-Environment Path Management
- **container-path-utils.ts**: Central path resolution authority providing deterministic transformation between host and container modes
- **simple-file-checker.ts**: File existence validation with integrated path resolution for immediate UX feedback
- Both components enforce the critical policy of absolute paths in host mode while supporting workspace-prefixed paths in container mode

### Error Handling and Messaging
- **error-messages.ts**: Centralized error message factory for timeout scenarios across DAP operations, proxy initialization, and debug sessions
- **type-guards.ts**: Runtime type safety validation for IPC boundaries with comprehensive error reporting
- Provides consistent, diagnostic-rich error messages throughout the system

### Logging and Monitoring
- **logger.ts**: Winston-based logging infrastructure with environment-aware configuration
- Handles console output silencing for transport integrity and container-specific log paths
- **line-reader.ts**: Source code context extraction with LRU caching for breakpoint and stack trace visualization

### Configuration and Control
- **language-config.ts**: Runtime language adapter control through environment variables for selective debugging

## Public API Surface

### Primary Entry Points
- `createLogger(namespace, options)` - Logger factory for subsystem-specific logging
- `resolvePathForRuntime(inputPath, environment)` - Core path resolution for all file operations  
- `checkExists(path)` - File existence validation with path resolution
- `getLineContext(filePath, lineNumber)` - Source code context extraction for debugging
- `validateAdapterCommand(obj, source)` - Type safety for command structures
- `isLanguageDisabled(language)` - Runtime language support queries

### Configuration Interfaces
- `LineReaderOptions` - File reading behavior configuration
- `LoggerOptions` - Logging system configuration  
- `FileExistenceResult` - Structured file check results
- `ErrorMessages` object - Timeout error message factories

## Internal Organization and Data Flow

### Path Resolution Flow
1. **Environment Detection**: `isContainerMode()` determines runtime context
2. **Path Transformation**: `resolvePathForRuntime()` applies environment-specific rules
3. **Validation**: File operations validate absolute paths in host mode
4. **Execution**: File system operations use resolved paths

### Error Handling Chain
1. **Type Validation**: Type guards ensure data structure integrity
2. **Message Generation**: Centralized error factories provide contextual messages
3. **Logging**: Structured error reporting with diagnostic information
4. **User Feedback**: Rich error context for debugging and troubleshooting

### Caching Strategy
- LRU caching in LineReader for performance optimization of repeated file access
- Logger singleton pattern for consistent logging across components
- Environment variable parsing caching in language configuration

## Important Patterns and Conventions

### Container-First Design
- All path operations flow through centralized resolution utilities
- Environment variable-driven behavior switching (`MCP_CONTAINER`, `MCP_WORKSPACE_ROOT`)
- Consistent workspace root normalization and validation

### Defensive Programming
- Comprehensive null/undefined checks across all utilities
- Graceful degradation with meaningful error messages
- Type safety validation at critical boundaries (IPC, serialization)

### Logging Discipline
- Console output silencing capability for transport integrity
- Structured JSON logging for container environments
- Debug-level tracing for path resolution and type validation

### Performance Optimization
- LRU caching with TTL for file operations
- Binary file detection to avoid unnecessary processing
- Size limits on file operations (10MB default)

### Cross-Environment Compatibility
- Environment abstraction through `IEnvironment` interface
- File system abstraction through `IFileSystem` interface  
- Centralized environment variable management

This utilities layer ensures the Debug MCP Server can operate reliably across different deployment scenarios while providing robust debugging capabilities through comprehensive logging, error handling, and file operations.