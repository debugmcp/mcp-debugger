# src/utils/
@generated: 2026-02-09T18:16:19Z

## Purpose & Responsibility
The `src/utils` directory provides foundational utility modules for the Debug MCP server, offering cross-cutting concerns including path resolution, error handling, runtime type safety, process inspection, configuration management, file operations, and logging. These utilities abstract environment-specific complexity and provide consistent interfaces across the entire system.

## Key Components & Architecture

### Core Infrastructure
- **Logger (`logger.ts`)**: Winston-based logging system with environment-aware console control and file output capabilities. Provides namespace-based categorization and handles container/host runtime differences.
- **Type Guards (`type-guards.ts`)**: Runtime type validation for critical system boundaries (DAP commands, proxy initialization). Ensures type safety at IPC and serialization points with comprehensive validation and safe serialization functions.
- **Error Messages (`error-messages.ts`)**: Centralized error message factory for timeout-related operations across debug sessions, proxy management, and adapter communication.

### Environment & Configuration
- **Container Path Utils (`container-path-utils.ts`)**: Centralized path resolution for container vs host deployment modes. Provides deterministic path transformation with strict policy enforcement based on `MCP_CONTAINER` and `MCP_WORKSPACE_ROOT` environment variables.
- **Language Config (`language-config.ts`)**: Runtime language adapter enable/disable control via `DEBUG_MCP_DISABLE_LANGUAGES` environment variable. Provides case-insensitive language filtering for selective adapter activation.

### Runtime Operations
- **JDWP Detector (`jdwp-detector.ts`)**: Java Debug Wire Protocol inspection utility for discovering suspend modes and connection details from running Java processes. Supports both port-based and PID-based detection using system tools.
- **Line Reader (`line-reader.ts`)**: Efficient file line reading with LRU caching for debugging operations. Handles binary file detection, size limits, and context extraction for breakpoints and stack traces.
- **Simple File Checker (`simple-file-checker.ts`)**: Lightweight file existence validation with detailed path resolution feedback. Integrates with container path utilities for environment-aware file operations.

## Public API Surface

### Primary Entry Points
- `createLogger(namespace, options?)` - Logger factory with environment-aware configuration
- `isValidAdapterCommand(obj)` / `validateAdapterCommand(obj, source)` - Type validation for DAP commands
- `resolvePathForRuntime(path)` - Main path resolution function for container/host modes
- `isLanguageDisabled(language)` - Language adapter availability checking
- `LineReader` class - Cached file reading with context extraction
- `SimpleFileChecker.checkExists(path)` - File existence validation with path resolution

### Configuration Functions
- `ErrorMessages` object - Timeout error message factories for different operations
- `detectSuspendByPort(port)` / `detectSuspendByPid(pid)` - JDWP configuration detection
- `getDisabledLanguages()` - Environment-based language configuration parsing

## Internal Organization & Data Flow

### Environment Detection Pattern
Multiple modules follow a common pattern of environment variable-based behavior modification:
1. Container/host mode detection (`MCP_CONTAINER`)
2. Path resolution with workspace root handling
3. Conditional feature enabling/disabling based on flags
4. Graceful degradation when environment variables are missing

### Validation & Safety Chain
Type guards and validation flow through the system:
1. Input validation at system boundaries (type-guards.ts)
2. Path resolution and validation (container-path-utils.ts, simple-file-checker.ts)
3. Runtime configuration validation (language-config.ts)
4. Comprehensive error handling with centralized messaging

### Caching & Performance
- Line reader uses LRU caching with TTL for file content
- Logger instances are managed as singletons
- Path resolution is deterministic to enable caching at higher levels
- JDWP detection is stateless for repeated queries

## Important Patterns & Conventions

### Error Handling Philosophy
- Fail-fast validation with descriptive error messages including source context
- Null/undefined returns for recoverable failures rather than exceptions
- Centralized error message templates for consistency
- Environment-aware error handling (container vs host contexts)

### Path Resolution Strategy
- Single source of truth for path resolution logic
- Container mode requires explicit workspace root configuration
- Host mode passes paths through unmodified
- All path operations go through centralized utilities

### Testing & Dependency Injection
- Functions accept environment parameters for testability
- Interface-based dependencies (IFileSystem, IEnvironment) for mocking
- Factory functions provide default configurations while allowing customization
- Logging is optional throughout to prevent test pollution

## Dependencies & Integration
The utilities directory serves as a foundation layer consumed by:
- `src/proxy/proxy-manager.ts` - Uses error messages, type validation, logging
- `src/session/session-manager.ts` - Uses error messages, logging, JDWP detection
- Language adapters - Use path resolution, language configuration, line reading
- Transport layers - Use type validation and serialization safety