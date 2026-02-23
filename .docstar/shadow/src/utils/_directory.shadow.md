# src\utils/
@children-hash: 7962d1b34472ab32
@generated: 2026-02-23T15:26:35Z

## Purpose

The `src/utils` directory provides essential infrastructure utilities for the DebugMCP application, focusing on cross-environment compatibility, robust error handling, and consistent data validation. This module serves as the foundational layer that enables the debug server to operate reliably across different deployment modes (host vs container) while maintaining type safety and comprehensive logging.

## Key Components & Organization

### Path Resolution & Environment Handling
- **container-path-utils.ts**: Core path resolution logic that handles host vs container runtime differences through centralized policy enforcement
- **simple-file-checker.ts**: File existence validation with proper path resolution integration
- **language-config.ts**: Runtime language adapter control via environment variables

### Error Management & Messaging
- **error-messages.ts**: Centralized timeout error message factory providing consistent, diagnostic-rich error descriptions
- **logger.ts**: Winston-based logging infrastructure with namespace support and environment-aware output

### Data Validation & Type Safety
- **type-guards.ts**: Runtime type validation for critical IPC boundaries (AdapterCommand, ProxyInitPayload)
- **line-reader.ts**: Source code context extraction with LRU caching and binary file detection

## Public API Surface

### Main Entry Points
- `resolvePathForRuntime(inputPath, environment)` - Core path resolution for cross-environment compatibility
- `createSimpleFileChecker()` - File existence checking factory
- `createLogger(namespace, options?)` - Logger creation with namespace isolation
- `ErrorMessages.{dapRequestTimeout|proxyInitTimeout|stepTimeout|adapterReadyTimeout}` - Timeout error factories
- `validateAdapterCommand(obj, source)` / `validateProxyInitPayload(payload)` - Type validation at IPC boundaries

### Configuration APIs
- `isLanguageDisabled(language, env?)` - Runtime language adapter control
- `getLineContext(filePath, lineNumber, options?)` - Source code context extraction

## Internal Architecture & Data Flow

### Environment Detection & Path Resolution
The directory implements a sophisticated environment detection system that distinguishes between host and container modes (`MCP_CONTAINER=true`). Path resolution flows through `container-path-utils.ts` which enforces deterministic behavior:
- **Host mode**: Passes paths through unchanged, requires absolute paths
- **Container mode**: Prefixes paths with workspace root from `MCP_WORKSPACE_ROOT`

### Caching Strategy
- **LineReader**: LRU cache (20 files, 5min TTL) for source code context
- **Logger**: Singleton pattern with lazy initialization
- **Environment parsing**: Memoized environment variable processing

### Error Handling Patterns
All utilities follow consistent error handling:
- **Non-throwing validators**: Return structured error results rather than exceptions
- **Rich error context**: Include source information, expected vs actual values
- **Graceful degradation**: Fallback behaviors for missing dependencies or failed operations

## Key Patterns & Conventions

### Centralized Policy Enforcement
- All path operations must flow through `container-path-utils.ts`
- Environment variable parsing follows consistent naming (`DEBUG_MCP_*`, `MCP_*`)
- Error messages include diagnostic context and recovery suggestions

### Type Safety at Boundaries
- Runtime validation at IPC communication points
- Factory functions provide type-safe object creation
- Serialization/deserialization with validation

### Environment-Aware Behavior
- Console output respects `CONSOLE_OUTPUT_SILENCED=1` for transport compatibility
- Container detection drives path resolution strategy
- Debug flags control feature enablement

### Defensive Programming
- Comprehensive input validation with detailed error reporting
- Null/undefined handling with safe defaults
- Binary file detection prevents processing of non-text content

## Integration Points

This utilities module serves as the foundation for:
- **Proxy Manager**: Path resolution, timeout handling, type validation
- **Session Manager**: Error messaging, logging, step timeout handling  
- **Debug Adapters**: Path resolution, file context extraction, environment configuration
- **IPC Layer**: Type validation, serialization utilities

The module's design ensures consistent behavior across all deployment environments while providing the infrastructure needed for reliable debugging operations.