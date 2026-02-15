# src\utils/
@children-hash: aea0393aa01950c1
@generated: 2026-02-15T09:01:27Z

## Overview

The `src/utils` directory provides foundational utilities for the Debug MCP Server, serving as the infrastructure layer that enables cross-environment operation, robust error handling, and reliable data processing. These utilities form the backbone supporting the debug server's core proxy and session management functionality.

## Core Responsibilities

**Cross-Environment Compatibility**: Enables seamless operation between host and container deployment modes through centralized path resolution and environment detection.

**Error Management**: Provides consistent, descriptive error messaging with contextual information for debugging timeout and operational failures.

**File System Operations**: Offers optimized file reading with caching, binary detection, and source code context extraction for debugging scenarios.

**Type Safety & Validation**: Ensures runtime type safety at critical boundaries like IPC communication and data serialization.

**Configuration & Logging**: Supports environment-driven configuration and structured logging across the application.

## Key Components & Integration

### Path Resolution System
- **container-path-utils.ts**: Single source of truth for path handling across host/container modes
- **simple-file-checker.ts**: File existence validation using centralized path resolution
- Works together to ensure debug adapters receive properly resolved file paths

### Error & Logging Infrastructure  
- **error-messages.ts**: Centralized timeout error message factory
- **logger.ts**: Winston-based logging with environment-specific behavior and console silencing
- **type-guards.ts**: Comprehensive validation logging for type safety failures
- Provides consistent error reporting and diagnostic information across all modules

### File Processing Pipeline
- **line-reader.ts**: Optimized source code reading with LRU caching and binary detection
- **language-config.ts**: Runtime language adapter control via environment variables
- Enables source context extraction for breakpoints and selective language support

### Data Validation Layer
- **type-guards.ts**: Runtime type validation for AdapterCommand and ProxyInitPayload structures
- Protects IPC boundaries and ensures data integrity in proxy communications

## Public API Surface

### Primary Entry Points
- `createLogger(namespace, options)` - Logger factory for module-specific logging
- `resolvePathForRuntime(inputPath, environment)` - Core path resolution for cross-environment compatibility
- `createSimpleFileChecker()` - File existence validation factory
- `LineReader` class - Source code context extraction with caching
- `validateAdapterCommand()` / `validateProxyInitPayload()` - Type validation at IPC boundaries
- `isLanguageDisabled(language)` - Runtime language support control

### Supporting Utilities
- `ErrorMessages` object - Timeout error message factories
- `getDisabledLanguages()` - Environment-based language configuration
- Type guard functions for runtime safety
- Serialization utilities for safe data transport

## Internal Organization & Data Flow

**Environment Detection** → **Path Resolution** → **File Operations** → **Error Handling** → **Logging**

1. Environment detection (container vs host mode) drives path resolution strategy
2. Centralized path resolution ensures consistent file access across deployment modes
3. File operations (existence checks, content reading) use resolved paths
4. Validation guards protect data integrity at system boundaries
5. Structured logging and error messages provide diagnostic feedback

## Critical Patterns

**Centralization**: Single sources of truth for path resolution, error messages, and validation logic prevent inconsistencies across the codebase.

**Environment Awareness**: All utilities respect deployment context (host vs container) and can be configured via environment variables.

**Defensive Programming**: Comprehensive error handling, graceful degradation, and null safety throughout all utilities.

**Performance Optimization**: Strategic caching (file content, logger instances) with TTL and size limits to handle repeated operations efficiently.

**Testability**: Clean separation of concerns with dependency injection patterns and environment parameter overrides for unit testing.

The utils directory serves as the foundational layer that enables the debug server's higher-level proxy and session management components to operate reliably across different deployment environments while maintaining consistent error handling and logging behavior.