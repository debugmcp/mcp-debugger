# src\utils/
@children-hash: 3e8aa56128a0cba3
@generated: 2026-02-19T23:48:18Z

## Purpose

The `src/utils` directory provides core utility infrastructure for the Debug MCP Server, focusing on cross-environment compatibility, robust error handling, and runtime type safety. This module serves as the foundation layer supporting debugging operations across host and container deployment modes.

## Key Components & Relationships

### Path Resolution & Environment Handling
- **container-path-utils.ts**: Central authority for all path resolution, providing deterministic transformation between host mode (passthrough) and container mode (workspace-prefixed paths)
- **simple-file-checker.ts**: File existence validation that delegates to container-path-utils for consistent path handling policy
- **language-config.ts**: Runtime language adapter control via environment variables for debugging scenarios

### Error Management & Messaging
- **error-messages.ts**: Centralized factory for timeout-related error messages across DAP requests, proxy initialization, step operations, and adapter readiness
- **logger.ts**: Winston-based logging infrastructure with namespaced loggers, environment-aware console output, and dual transport strategy (console + rotating files)

### Source Code Operations
- **line-reader.ts**: High-performance file reading utility with LRU caching for extracting line context in breakpoints and stack traces, includes binary file detection and size limits

### Type Safety & Validation
- **type-guards.ts**: Runtime type validation for critical IPC boundaries, validating `AdapterCommand` and `ProxyInitPayload` structures with comprehensive error handling and serialization utilities

## Public API Surface

### Path Resolution Entry Points
- `resolvePathForRuntime(inputPath, environment)`: Core path transformation logic
- `isContainerMode(environment)`: Environment detection
- `createSimpleFileChecker()`: Factory for file existence checking

### Error & Logging Entry Points  
- `ErrorMessages`: Factory object for timeout error message generation
- `createLogger(namespace, options?)`: Winston logger factory with environment-aware configuration
- `getLogger()`: Default logger singleton accessor

### Source Code Access
- `LineReader` class: Cached file reading with context extraction
- `getLineContext()`: Primary method for retrieving line content with surrounding context
- `getMultiLineContext()`: Stack trace line range extraction

### Type Safety Entry Points
- `validateAdapterCommand()`, `validateProxyInitPayload()`: Core validation functions
- `serializeAdapterCommand()`, `deserializeAdapterCommand()`: Safe JSON handling
- `createAdapterCommand()`: Type-safe command factory

## Internal Organization & Data Flow

### Environment Detection Flow
1. Environment variables (`MCP_CONTAINER`, `DEBUG_MCP_DISABLE_LANGUAGES`) determine runtime mode
2. container-path-utils provides centralized path resolution policy
3. All file operations route through this resolution layer
4. simple-file-checker enforces path validation rules

### Error Handling Hierarchy
1. Type validation at entry points (type-guards)
2. Centralized error message generation (error-messages)
3. Structured logging with environment-aware output (logger)
4. Graceful degradation with informative error context

### Caching & Performance
- LineReader maintains LRU cache (20 files, 5min TTL) for source code access
- Logger instances are singletons per namespace
- Path resolution results flow through without caching (stateless)

## Important Patterns & Conventions

### Cross-Environment Compatibility
- All path operations must use `resolvePathForRuntime()` for consistency
- Host mode requires absolute paths; container mode auto-prefixes workspace root
- Environment detection via boolean flags rather than heuristics

### Defensive Programming
- Type guards at all external boundaries with rich error context
- Graceful degradation rather than throwing (file operations, binary detection)
- Comprehensive parameter validation with structured error reporting

### Logging & Debugging
- Namespace-based logger organization for component isolation
- Console output silencing (`CONSOLE_OUTPUT_SILENCED=1`) to prevent transport corruption
- Detailed validation logging with timestamps and context

### Performance Considerations
- LRU caching for repeated file access operations
- Binary file detection to avoid processing unsuitable content
- Size limits (10MB default) to prevent memory issues
- Lazy initialization patterns for singleton resources

This utility layer serves as the foundational infrastructure enabling reliable debugging operations across different deployment environments while maintaining type safety and performance.