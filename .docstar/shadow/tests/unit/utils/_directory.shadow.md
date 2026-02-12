# tests/unit/utils/
@generated: 2026-02-11T23:47:38Z

## Purpose
Unit test suite for core utility modules in the MCP debug server, providing comprehensive test coverage for path resolution, error handling, file operations, logging, and container environment functionality.

## Key Components and Organization

### Container Path Management Tests
- **`container-path-utils.spec.ts`**: Tests container-aware path resolution utilities, validating workspace root detection, path prefixing, and environment-based container mode detection
- **`simple-file-checker.spec.ts` & `simple-file-checker.test.ts`**: Tests file existence checking with dual-mode operation (host vs container environments), including path transformation and error handling

### Error and Message Handling Tests  
- **`error-messages.test.ts`**: Validates timeout message generation for DAP operations and robust error message extraction from various input types
- **`language-config.test.ts`**: Tests language configuration parsing from environment variables, including disabled language detection and case-insensitive matching

### File and System Operations Tests
- **`line-reader.spec.ts`**: Comprehensive testing of file reading utilities with line context extraction, caching behavior, binary detection, and size limits
- **`logger.test.ts`**: Tests winston-based logger configuration, transport setup, container-specific logging paths, and error handling

## Testing Patterns and Conventions

### Mock Architecture
- Consistent use of Vitest mocking framework with `vi.mocked()` for type safety
- Mock factories for complex dependencies (file systems, environments, loggers)
- Environment isolation with `beforeEach`/`afterEach` cleanup patterns
- Hoisted mocks for module-level dependencies

### Container Environment Testing
- Dual-mode testing for host vs container environments using `MCP_CONTAINER` flag
- Workspace root path resolution testing with `MCP_WORKSPACE_ROOT` variable
- Container-specific path transformations and log file locations

### Error Handling Coverage
- Comprehensive edge case testing (missing files, invalid inputs, boundary conditions)
- Graceful degradation testing for system failures
- Error message validation and user-friendly formatting

## Key Testing Utilities

### Environment Management
- Mock environment implementations with configurable variables
- Environment state preservation and restoration between tests
- Container mode detection and workspace root configuration

### File System Abstraction
- Mock file system implementations with all standard operations
- Path existence checking, file reading, and directory creation testing
- Binary file detection and size limit enforcement

### Logging and Debugging
- Logger initialization and transport configuration testing
- Debug message formatting and container-specific log paths
- Error suppression and console output management

## Dependencies and Integration
- **Vitest Framework**: Primary testing framework with mocking capabilities
- **Winston Logger**: Logging infrastructure testing with transport configuration
- **Container Utilities**: Path resolution and environment detection for containerized deployments
- **File System Abstractions**: Mock implementations for isolated file operation testing

## Critical Test Coverage Areas
- Container vs host mode path resolution and file access
- Error message generation for timeout scenarios and debug operations
- Language configuration parsing from environment variables
- File reading with caching, context extraction, and boundary handling
- Logger setup with environment-specific transport configuration
- Robust error handling across all utility functions