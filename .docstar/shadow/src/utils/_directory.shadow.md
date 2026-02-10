# src/utils/
@generated: 2026-02-10T21:26:30Z

## Overall Purpose

The `src/utils` directory provides foundational utility modules that support the Debug MCP Server's core operations across containerized and host environments. These utilities handle path resolution, error messaging, process detection, language configuration, file operations, logging, and type safety - forming the infrastructure layer that enables reliable debugging operations.

## Key Components and Integration

### Core Infrastructure
- **container-path-utils.ts**: Central path resolution authority that provides deterministic path handling for both container (`MCP_CONTAINER=true`) and host deployment modes. All file operations throughout the system flow through this module's `resolvePathForRuntime()` function.
- **logger.ts**: Winston-based logging infrastructure with environment-aware configuration, console output silencing for transport integrity, and container-specific log paths. Provides the logging foundation used across all components.

### File System Operations
- **line-reader.ts**: Performance-optimized file reader with LRU caching for source code context extraction. Used extensively for breakpoint context and stack trace visualization, with binary file detection and size constraints.
- **simple-file-checker.ts**: Centralized file existence checking that integrates with container-path-utils for proper path resolution and provides structured results with error isolation.

### Process and Runtime Detection
- **jdwp-detector.ts**: Linux-specific Java Debug Wire Protocol detector that extracts debug configuration from running Java processes using `/proc` filesystem and `lsof`. Critical for automatic debug session attachment.
- **language-config.ts**: Runtime language adapter control through `DEBUG_MCP_DISABLE_LANGUAGES` environment variable, enabling selective debugging scenarios without code changes.

### Error Handling and Validation
- **error-messages.ts**: Centralized factory for timeout-related error messages across DAP requests, proxy initialization, step operations, and adapter readiness. Provides consistent diagnostic messaging with recovery suggestions.
- **type-guards.ts**: Runtime type safety validation for critical data structures like `AdapterCommand` and `ProxyInitPayload`. Ensures data integrity at IPC boundaries with comprehensive error context.

## Public API Surface

### Primary Entry Points
- `resolvePathForRuntime(inputPath, environment)` - Core path resolution for all file operations
- `createLogger(namespace, options)` / `getLogger()` - Logging infrastructure access
- `getLineContext(filePath, lineNumber, options)` - Source code context extraction
- `checkExists(path)` - File existence checking with path resolution
- `detectSuspendByPort(port)` / `detectSuspendByPid(pid)` - JDWP configuration detection
- `isLanguageDisabled(language)` - Runtime language adapter control
- `validateAdapterCommand(obj, source)` - Type safety validation

### Factory Functions
- `createSimpleFileChecker(filesystem, environment, logger)` - File checker instantiation
- `ErrorMessages.*` - Timeout error message factories
- `createAdapterCommand(command, args, env)` - Safe command creation

## Internal Organization and Data Flow

### Dependency Flow
1. **Foundation Layer**: container-path-utils and logger provide base services
2. **File Operations Layer**: line-reader and simple-file-checker build on path resolution
3. **Validation Layer**: type-guards and error-messages ensure data integrity
4. **Detection Layer**: jdwp-detector and language-config provide runtime intelligence

### Cross-Module Integration
- All file operations flow through container-path-utils for consistent path handling
- All modules use the logger utility for consistent error reporting and debugging
- Type guards validate data at module boundaries, especially for IPC communication
- Error messages provide consistent user-facing diagnostics across timeout scenarios

## Important Patterns and Conventions

### Environment-Driven Configuration
- Container mode detection via `MCP_CONTAINER` environment variable
- Console output silencing via `CONSOLE_OUTPUT_SILENCED` for transport integrity
- Language disabling via `DEBUG_MCP_DISABLE_LANGUAGES` for debugging control
- Log level configuration via `DEBUG_MCP_LOG_LEVEL`

### Error Handling Strategy
- Graceful degradation: utilities return null/false rather than throwing on expected failures
- Structured error results with original/effective path tracking
- Comprehensive error context including source location and expected formats
- Centralized error message factories for consistent diagnostics

### Performance Optimization
- LRU caching in line-reader for repeated file access
- Binary file detection to avoid processing non-text content
- Timeout controls for external process interactions (lsof)
- Lazy initialization patterns for expensive resources

### Type Safety and Validation
- Runtime type guards at critical boundaries (IPC, serialization)
- Factory functions that enforce invariants during object creation
- Comprehensive validation with detailed error messages
- Safe serialization/deserialization with validation hooks

This utilities directory serves as the reliable foundation enabling the Debug MCP Server's cross-environment debugging capabilities while maintaining performance, type safety, and operational consistency.