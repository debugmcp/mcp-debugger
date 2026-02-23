# tests\unit\utils/
@children-hash: 2b19eca1cfc92953
@generated: 2026-02-23T15:26:29Z

## Overall Purpose
This directory contains comprehensive unit tests for utility modules used throughout the MCP (Model Context Protocol) debug system. The tests validate core infrastructure components including path resolution, error handling, logging, file operations, and language configuration management.

## Key Test Components

### Path & Container Management Tests
- **container-path-utils.spec.ts**: Tests container mode detection, workspace root resolution, and path transformation for runtime execution
- **simple-file-checker.spec.ts & simple-file-checker.test.ts**: Dual test coverage for file existence checking with container-aware path resolution

### Error & Message Handling Tests  
- **error-messages.test.ts**: Validates timeout message generation for DAP operations and error message extraction utilities
- **line-reader.spec.ts**: Tests file reading, line context extraction, caching behavior, and binary file detection

### System Configuration Tests
- **language-config.test.ts**: Tests environment-based language disabling functionality via `DEBUG_MCP_DISABLE_LANGUAGES`
- **logger.test.ts**: Validates winston-based logger creation, transport configuration, and environment-specific behaviors

## Testing Patterns & Architecture

### Mock Strategy
All tests employ comprehensive mocking of external dependencies:
- File system operations via `IFileSystem` interface mocks
- Environment variables via `IEnvironment` interface mocks  
- Logger functionality for debug output capture
- Winston transport layer for logging tests

### Container Mode Testing
Multiple test suites validate container vs host mode behavior:
- Path resolution with workspace prefixing in container mode
- Environment variable detection (`MCP_CONTAINER`, `MCP_WORKSPACE_ROOT`)
- Different file access patterns between environments

### Error Handling Validation
Consistent testing of error conditions across utilities:
- File system access failures
- Missing environment variables
- Invalid input validation
- Graceful degradation scenarios

## Test Infrastructure

### Common Dependencies
- **Vitest framework**: Primary test runner with mocking capabilities
- **Shared interfaces**: `IEnvironment`, `IFileSystem` from `@debugmcp/shared`
- **Container path utilities**: Cross-cutting path resolution logic

### Test Isolation
- Environment variable preservation/restoration in `beforeEach`/`afterEach` hooks
- Mock cleanup and reset patterns
- Consistent spy usage for function call verification

## Integration Points
These utility tests validate the foundational layer that supports:
- Debug adapter protocol (DAP) request handling
- File system operations in containerized environments  
- Language-specific debug configuration
- Error reporting and logging across the system
- Line-by-line code inspection and context extraction

The tests ensure robust operation across different deployment modes (host vs container) and provide confidence in the utility layer that higher-level MCP debug functionality depends upon.