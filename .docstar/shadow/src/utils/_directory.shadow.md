# src\utils/
@children-hash: 940c79a54cf91375
@generated: 2026-02-24T01:54:54Z

## Overall Purpose

The `src/utils` directory provides foundational utility modules for the DebugMCP application, focusing on cross-environment compatibility, security, logging, and data validation. These utilities enable the debug server to operate consistently across host and containerized deployments while maintaining security and type safety.

## Key Components and Architecture

### Cross-Environment Runtime Utilities

**container-path-utils.ts** serves as the central path resolution authority, implementing deterministic path transformation logic for container vs host environments. It provides:
- `resolvePathForRuntime()` - Core path resolution with workspace root prefixing in container mode
- `isContainerMode()` and `getWorkspaceRoot()` - Environment detection and configuration
- Idempotent path handling with clear error policies

**simple-file-checker.ts** builds on path utilities to provide immediate UX feedback for file existence checks, enforcing absolute path requirements and proper error handling across deployment modes.

### Security and Data Safety

**env-sanitizer.ts** implements comprehensive security measures for log sanitization:
- Pattern-based detection of sensitive environment variables (API keys, tokens, credentials)
- Deep sanitization of complex objects including MCP proxy payloads
- Stderr filtering to prevent credential leakage

**type-guards.ts** ensures runtime type safety at critical IPC boundaries:
- Validation of `AdapterCommand` and `ProxyInitPayload` structures
- Safe serialization/deserialization with error context
- Factory functions for type-safe object creation

### Operational Infrastructure

**logger.ts** provides winston-based logging infrastructure with:
- Namespaced loggers for component identification
- Environment-aware console output (respects `CONSOLE_OUTPUT_SILENCED`)
- Dual transport strategy (console + rotated file logging)
- Container-aware log path resolution

**error-messages.ts** centralizes timeout error message generation for consistent diagnostic output across DAP requests, proxy initialization, step operations, and adapter readiness.

**language-config.ts** enables runtime language adapter control through environment variables for debugging scenarios.

**line-reader.ts** optimizes source code context extraction with LRU caching, binary file detection, and line range operations for breakpoint and stack trace visualization.

## Public API Surface

### Primary Entry Points
- `resolvePathForRuntime()` - Central path resolution for all file operations
- `createLogger()` / `getLogger()` - Logging infrastructure initialization
- `sanitizeEnvForLogging()` / `sanitizePayloadForLogging()` - Security sanitization
- `validateAdapterCommand()` / `validateProxyInitPayload()` - Type safety validation
- `createSimpleFileChecker()` - File existence checking with proper path handling

### Configuration Points
- Environment variables: `MCP_CONTAINER`, `MCP_WORKSPACE_ROOT`, `CONSOLE_OUTPUT_SILENCED`, `DEBUG_MCP_DISABLE_LANGUAGES`
- Logger options: level, file paths, transport configuration
- Path resolution policies: container vs host mode behavior

## Internal Organization and Data Flow

The utilities follow a layered architecture:

1. **Foundation Layer**: container-path-utils provides core path resolution policy
2. **Security Layer**: env-sanitizer and type-guards ensure data safety
3. **Infrastructure Layer**: logger, error-messages, and language-config provide operational support
4. **Application Layer**: simple-file-checker and line-reader provide domain-specific functionality

Data flows through validation → sanitization → logging → operation execution, with centralized path resolution ensuring consistency across all file operations.

## Important Patterns and Conventions

- **Centralized Policy Enforcement**: All path resolution flows through container-path-utils
- **Environment-Driven Behavior**: Runtime behavior switches based on environment variables
- **Defensive Programming**: Comprehensive error handling with structured logging
- **Type Safety**: Validation at boundaries with rich error context
- **Security by Default**: Automatic sanitization of sensitive data in logs
- **Performance Optimization**: LRU caching for frequently accessed resources
- **Container Awareness**: All utilities handle containerized deployment scenarios

The utilities collectively enable the DebugMCP server to operate reliably across different environments while maintaining security, performance, and type safety.