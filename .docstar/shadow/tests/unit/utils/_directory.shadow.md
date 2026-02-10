# tests/unit/utils/
@generated: 2026-02-10T01:19:41Z

## Purpose
Unit test directory for utility modules, providing comprehensive test coverage for core system utilities including container path resolution, error handling, language configuration, file operations, logging, and file existence checking.

## Key Test Modules

### Container & Path Management
- **container-path-utils.spec.ts**: Tests container path resolution utilities with workspace root handling, path prefixing in container mode, and descriptive path formatting
- **simple-file-checker.spec.ts / simple-file-checker.test.ts**: Tests file existence checking with environment-aware path resolution (two implementations testing same functionality)

### Error & Message Handling  
- **error-messages.test.ts**: Validates error message generation for timeout scenarios (DAP requests, proxy initialization, step operations) and error message extraction from various input types
- **logger.test.ts**: Tests winston-based logger creation, transport configuration, container environment handling, and error boundary behavior

### Configuration & Language Support
- **language-config.test.ts**: Tests environment-based language disabling functionality, parsing comma-separated language lists from `DEBUG_MCP_DISABLE_LANGUAGES`

### File Operations
- **line-reader.spec.ts**: Comprehensive testing of file reading utilities including line context extraction, caching behavior, binary detection, size limits, and multi-line range operations

## Testing Patterns & Architecture

### Mock Strategy
- **Comprehensive Interface Mocking**: All tests use complete interface implementations (IFileSystem, IEnvironment, Logger) for isolated testing
- **Environment Manipulation**: Systematic testing of container vs host mode behaviors through environment variable control
- **External Dependency Isolation**: Complete mocking of winston, filesystem operations, and path utilities

### Error Boundary Testing
- **Graceful Degradation**: Tests validate proper error handling across all utilities
- **Error Message Consistency**: Standardized error message formatting and propagation
- **Edge Case Coverage**: Boundary conditions, missing files, invalid inputs, and system failures

### Environment Awareness
- **Container Mode Detection**: Tests validate `MCP_CONTAINER` environment variable handling
- **Path Resolution**: Container workspace root prefixing vs direct path usage
- **Configuration Parsing**: Environment-based feature toggling and language disabling

## Public API Testing Coverage

### Core Utilities Under Test
- **Container Path Utilities**: `isContainerMode()`, `getWorkspaceRoot()`, `resolvePathForRuntime()`, `getPathDescription()`
- **Error Messaging**: `ErrorMessages` static methods, `getErrorMessage()` function
- **Language Configuration**: `getDisabledLanguages()`, `isLanguageDisabled()`
- **Line Reading**: `LineReader` class with caching and context extraction
- **Logging**: `createLogger()`, `getLogger()` factory functions
- **File Checking**: `SimpleFileChecker` class and factory function

### Integration Points
- Tests validate proper integration between path utilities and file checkers
- Error handling consistency across different utility modules
- Environment-based configuration affecting multiple subsystems
- Caching behavior and performance optimization validation

## Critical System Behaviors Validated
- **Container Environment Adaptation**: Path prefixing, workspace root resolution, log file locations
- **Error Resilience**: Graceful handling of missing files, invalid configurations, system errors
- **Performance Features**: File content caching, size limit enforcement, binary detection
- **User Experience**: Descriptive error messages, case-insensitive language matching, robust input parsing