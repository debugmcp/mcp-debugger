# tests\unit\utils/
@children-hash: d5870913c6d4876d
@generated: 2026-02-15T09:01:26Z

## Overall Purpose
This directory contains comprehensive unit tests for core utility modules that handle path resolution, error handling, logging, file operations, and language configuration in a containerized MCP (Model Context Protocol) environment. The tests validate utilities that bridge between host and container execution modes, providing essential infrastructure for the debug MCP server.

## Key Testing Components

### Container-Aware Path Management
- **container-path-utils.spec.ts**: Tests the foundation of container/host path resolution, including workspace root detection, path normalization, and runtime-specific path handling
- **simple-file-checker.spec.ts & simple-file-checker.test.ts**: Dual test coverage for file existence checking with container-aware path resolution, validating both mock-based and integration scenarios

### Error Handling & Logging Infrastructure  
- **error-messages.test.ts**: Tests standardized error message generation for timeout scenarios (DAP requests, proxy initialization, step operations, adapter readiness)
- **logger.test.ts**: Comprehensive winston-based logger testing including transport configuration, container-specific log paths, error handling, and environment-based behavior

### File System Operations
- **line-reader.spec.ts**: Tests advanced file reading capabilities including line context extraction, caching, binary file detection, size limits, and multi-line range operations

### Configuration Management
- **language-config.test.ts**: Tests environment-based language disabling functionality, parsing comma-separated language lists from `DEBUG_MCP_DISABLE_LANGUAGES`

## Testing Patterns & Architecture

### Mock Strategy
- **Environment Isolation**: All tests preserve and restore `process.env` state
- **Comprehensive Mocking**: File systems, loggers, and external dependencies are fully mocked using Vitest
- **Type-Safe Mocking**: Consistent use of `vi.mocked()` for TypeScript compatibility

### Container Mode Testing
- **Dual Environment Support**: Tests validate behavior in both host and container modes
- **Environment Variable Driven**: Uses `MCP_CONTAINER` and `MCP_WORKSPACE_ROOT` for runtime detection
- **Path Resolution**: Container mode tests ensure proper workspace root prefixing

### Error Handling Validation
- **Graceful Degradation**: Tests verify utilities handle missing files, invalid inputs, and system errors
- **Consistent Error Messages**: Validates standardized error message formats across utilities
- **Boundary Conditions**: Comprehensive edge case testing (file size limits, line boundaries, empty inputs)

## Public API Testing Coverage

The test suite validates these key utility interfaces:
- **Path Resolution**: `resolvePathForRuntime()`, `getWorkspaceRoot()`, `getPathDescription()`
- **File Operations**: `LineReader.getLineContext()`, `SimpleFileChecker.checkPath()`
- **Error Handling**: `ErrorMessages` static methods, `getErrorMessage()`
- **Configuration**: `getDisabledLanguages()`, `isLanguageDisabled()`
- **Logging**: `createLogger()`, `getLogger()` with transport configuration

## Internal Organization

Tests follow a consistent structure:
1. **Mock Setup**: Hoisted mocks and dependency injection
2. **Environment Management**: beforeEach/afterEach hooks for isolation
3. **Scenario Testing**: Positive cases, error conditions, and edge cases
4. **Assertion Patterns**: Type-safe verification of function calls and return values

The test suite ensures these utilities work reliably across different execution environments while providing proper error handling and logging for debugging scenarios.