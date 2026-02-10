# src/utils/
@generated: 2026-02-10T01:19:42Z

## Purpose

The `src/utils` directory provides foundational utilities for the Debug MCP Server, offering core infrastructure for path resolution, file operations, logging, process detection, configuration management, error handling, and type safety. This module serves as the shared foundation layer supporting debugging operations across container and host environments.

## Key Components & Integration

### Path & Environment Management
- **container-path-utils.ts**: Central path resolution engine handling container vs host deployment modes through `MCP_CONTAINER` environment detection
- **language-config.ts**: Runtime language adapter control via `DEBUG_MCP_DISABLE_LANGUAGES` environment variable
- Both components provide environment-aware configuration that adapts behavior based on deployment context

### File System Operations
- **simple-file-checker.ts**: High-level file existence checking with path resolution integration
- **line-reader.ts**: Optimized source code reader with LRU caching for breakpoint context and stack trace visualization
- Both leverage container-path-utils for consistent path handling across deployment modes

### Process & System Detection
- **jdwp-detector.ts**: Java Debug Wire Protocol configuration extraction from running processes on Linux systems
- Provides runtime introspection capabilities for Java debugging scenarios

### Infrastructure Services
- **logger.ts**: Winston-based logging framework with environment-specific behavior and console output management
- **error-messages.ts**: Centralized error message factory for timeout scenarios across DAP operations
- **type-guards.ts**: Runtime type safety enforcement for IPC communication and data serialization

## Public API Surface

### Core Entry Points
- `createLogger(namespace, options)` - Logger factory with environment-aware configuration
- `resolvePathForRuntime(inputPath, environment)` - Universal path resolution for container/host modes
- `LineReader` class - Cached file reading for source code context extraction
- `validateProxyInitPayload(payload)` / `validateAdapterCommand(cmd)` - Type safety for IPC boundaries
- `detectSuspendByPort(port)` / `detectSuspendByPid(pid)` - JDWP configuration detection
- `isLanguageDisabled(language)` - Runtime language adapter control

### Factory Functions
- `createSimpleFileChecker(filesystem, environment, logger)` - File checking with dependency injection
- `createAdapterCommand(command, args, env)` - Type-safe command construction

## Internal Organization & Data Flow

The utilities follow a layered architecture:

1. **Foundation Layer**: container-path-utils provides path resolution that all file operations depend on
2. **Service Layer**: logger, error-messages, and type-guards provide infrastructure services
3. **Operation Layer**: line-reader, simple-file-checker, and jdwp-detector provide specialized operations
4. **Configuration Layer**: language-config provides runtime behavior control

Data flows through dependency injection patterns, with most utilities accepting environment and filesystem abstractions for testability. The container-path-utils module serves as the single source of truth for path transformations across the entire system.

## Important Patterns & Conventions

### Environment-Driven Configuration
- All utilities respect `MCP_CONTAINER` for deployment mode detection
- Environment variables control runtime behavior without code changes
- Graceful fallbacks when environment configuration is missing

### Error Handling Philosophy
- Structured error results rather than exceptions for operational failures
- Rich error context with troubleshooting guidance
- Defensive programming with validation at system boundaries

### Performance Optimization
- LRU caching in line-reader for repeated file access
- Lazy initialization patterns in logger and file operations
- Binary file detection to avoid processing non-text content

### Type Safety
- Runtime validation at IPC boundaries
- Comprehensive type guards for external data
- Factory functions ensuring valid object construction

The directory provides the essential infrastructure that enables the Debug MCP Server to operate reliably across different deployment environments while maintaining performance and type safety.