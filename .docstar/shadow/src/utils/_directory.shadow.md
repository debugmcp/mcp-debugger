# src/utils/
@generated: 2026-02-11T23:47:42Z

## Overall Purpose

The `src/utils` directory provides foundational utility modules for the Debug MCP Server, handling cross-cutting concerns like path resolution, error messaging, file operations, logging, and type safety. This module serves as the infrastructure layer supporting the core debugging functionality with environment-aware utilities and robust error handling.

## Key Components and Integration

### Path Resolution and File Operations
- **container-path-utils.ts**: Central path resolution authority providing deterministic handling for container vs host deployment modes
- **simple-file-checker.ts**: File existence validation with integrated path resolution
- **line-reader.ts**: Source code context extraction for breakpoints and stack traces with LRU caching

These components work together to provide consistent file system access across different runtime environments, with container-path-utils serving as the single source of truth for path transformations.

### Error Handling and Messaging
- **error-messages.ts**: Centralized factory for timeout-related error messages across DAP operations, proxy initialization, and session management
- **type-guards.ts**: Runtime type validation with comprehensive error reporting for IPC boundaries

### Infrastructure Services
- **logger.ts**: Winston-based logging with environment-aware transport configuration and console output control
- **language-config.ts**: Runtime language adapter control through environment variables for debugging scenarios

## Public API Surface

### Core Entry Points
- `resolvePathForRuntime(inputPath, environment)`: Primary path resolution function
- `createSimpleFileChecker()`: File existence validation factory
- `getLineContext(filePath, lineNumber, options?)`: Source code context extraction
- `createLogger(namespace, options?)`: Logger instance creation
- `isLanguageDisabled(language)`: Language adapter control
- `validateAdapterCommand(obj, source)`: Type safety validation
- `ErrorMessages.*`: Timeout error message factories

### Environment Configuration
- `MCP_CONTAINER`: Container mode detection
- `MCP_WORKSPACE_ROOT`: Container workspace mount point
- `DEBUG_MCP_DISABLE_LANGUAGES`: Language adapter control
- `CONSOLE_OUTPUT_SILENCED`: Logging transport control
- `DEBUG_MCP_LOG_LEVEL`: Log level configuration

## Internal Organization and Data Flow

### Path Resolution Pipeline
1. Environment detection (container vs host mode)
2. Path transformation via container-path-utils
3. Validation and existence checking
4. Context extraction for debugging operations

### Error Handling Strategy
- Centralized error message generation with contextual information
- Type validation at critical boundaries (IPC, serialization)
- Graceful degradation with structured error reporting
- Comprehensive logging with debug context

### Caching and Performance
- LRU caching in line-reader for repeated file access
- Singleton logger instances for resource efficiency
- Binary file detection to avoid processing non-text files

## Important Patterns and Conventions

### Environment-Driven Configuration
All utilities respect environment variables for runtime behavior control, enabling deployment flexibility without code changes.

### Defensive Programming
- Null/undefined handling with graceful fallbacks
- Size limits and validation checks
- Binary file detection and rejection
- Path validation with absolute path requirements

### Centralized Policy Enforcement
- Single source of truth for path resolution (container-path-utils)
- Consistent error messaging patterns
- Standardized logging formats

### Type Safety and Validation
- Runtime type checking at boundaries
- Structured validation with detailed error reporting
- Safe serialization/deserialization patterns

This utilities module provides the foundational infrastructure required for reliable cross-environment debugging operations, with particular emphasis on container deployment scenarios and robust error handling throughout the debug session lifecycle.