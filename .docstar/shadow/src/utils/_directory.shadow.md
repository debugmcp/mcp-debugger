# src\utils/
@generated: 2026-02-12T21:05:48Z

## Purpose

The `src/utils` directory provides foundational utilities and infrastructure for the Debug MCP Server, focusing on cross-environment compatibility, type safety, error handling, and file operations. This module serves as the utility layer supporting the core debugging functionality across host and container deployment modes.

## Key Components and Integration

### Path Resolution and Environment Handling
- **container-path-utils.ts**: Central authority for all path resolution across host/container modes
  - Provides environment detection (`isContainerMode()`)
  - Handles workspace root resolution and path prefixing for container deployments
  - Used by `SimpleFileChecker` and throughout the application for consistent path handling
- **simple-file-checker.ts**: File existence validation with proper path resolution
  - Integrates with container-path-utils for cross-environment compatibility
  - Enforces absolute path requirements in host mode
  - Provides structured error reporting with original/effective path context

### Logging and Error Management  
- **logger.ts**: Winston-based logging infrastructure with environment-aware configuration
  - Handles console silencing for transport corruption prevention
  - Provides container-specific log paths and dual transport setup (console + file)
  - Singleton pattern with namespace support
- **error-messages.ts**: Centralized timeout error message factory
  - Standardized error messages for DAP requests, proxy initialization, step operations
  - Used by proxy and session managers for consistent error reporting

### Type Safety and Validation
- **type-guards.ts**: Runtime type validation at critical boundaries
  - Validates `AdapterCommand` and `ProxyInitPayload` structures
  - Provides serialization/deserialization with safety checks
  - Defensive programming with rich error context and structured logging

### Source Code Operations
- **line-reader.ts**: Optimized file reading for debugging context
  - LRU caching for performance (20 files, 5min TTL)
  - Binary file detection and size limits
  - Extracts line context for breakpoints and stack traces
- **language-config.ts**: Runtime language adapter control via environment variables
  - Enables selective disabling of language support for debugging
  - Environment-driven configuration with case-insensitive handling

## Public API Surface

### Path Resolution
- `resolvePathForRuntime(inputPath, environment)` - Core path resolution
- `isContainerMode(environment)` - Environment detection
- `createSimpleFileChecker()` - File existence validation factory

### Logging
- `createLogger(namespace, options)` - Logger factory with namespace support
- `getLogger()` - Default logger singleton accessor

### Error Handling
- `ErrorMessages.dapRequestTimeout(command, timeout)` - DAP timeout errors
- `ErrorMessages.proxyInitTimeout(timeout)` - Proxy initialization errors
- `ErrorMessages.stepTimeout(timeout)` - Step operation timeouts

### Type Safety
- `validateAdapterCommand(obj, source)` - Command structure validation
- `validateProxyInitPayload(payload)` - Proxy payload validation
- `createAdapterCommand(command, args, env)` - Type-safe command creation

### File Operations
- `LineReader.getLineContext(filePath, lineNumber)` - Extract line with context
- `LineReader.getMultiLineContext(filePath, startLine, endLine)` - Range extraction

### Configuration
- `getDisabledLanguages(env)` - Parse disabled language list
- `isLanguageDisabled(language, env)` - Check language status

## Internal Organization and Data Flow

1. **Environment Detection**: Container-path-utils detects deployment mode and drives path resolution strategy
2. **Path Resolution**: All file operations flow through centralized path resolution before filesystem access  
3. **Validation Pipeline**: Type guards validate data at IPC boundaries before processing
4. **Error Reporting**: Centralized error message factories provide consistent error context
5. **Caching Layer**: Line-reader provides performance optimization for repeated file access
6. **Logging Integration**: All utilities integrate with the logging infrastructure for debugging

## Important Patterns and Conventions

- **Single Source of Truth**: Container-path-utils is the only path resolution mechanism
- **Defensive Programming**: Comprehensive error handling with structured error returns rather than exceptions
- **Environment-Driven Behavior**: Runtime configuration through environment variables
- **Factory Pattern**: Clean instantiation interfaces (`createLogger`, `createSimpleFileChecker`)
- **Type Safety at Boundaries**: Validation at all external data entry points
- **Performance Optimization**: Strategic caching for frequently accessed resources
- **Cross-Environment Compatibility**: Consistent behavior across host and container deployments

This utility layer provides the foundation for reliable, type-safe debugging operations while abstracting away deployment-specific concerns and providing consistent error handling and logging across the entire Debug MCP Server.