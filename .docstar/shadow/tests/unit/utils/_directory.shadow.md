# tests\unit\utils/
@generated: 2026-02-12T21:05:44Z

## Purpose
Test suite for utility modules that provide common functionality across the MCP (Model Context Protocol) debug server system. Tests core infrastructure components for path resolution, logging, error handling, file operations, and language configuration management.

## Key Testing Areas

### Container Environment Support
Multiple test suites validate container/host dual-mode operation:
- **Container Path Utilities**: Tests path resolution, workspace root handling, and descriptive path formatting for container vs. host environments
- **Simple File Checker**: Validates file existence checking with environment-aware path transformation
- **Logger**: Tests log file placement and directory creation in both container and host modes

### Error Handling & Messaging
Comprehensive error management testing:
- **Error Messages**: Tests timeout message generation for DAP requests, proxy initialization, step operations, and adapter readiness
- **Debug Errors**: Tests robust error message extraction from various input types (Error objects, strings, primitives)
- **File Operations**: Error handling for filesystem failures, missing files, and access issues

### File System Operations
Core file handling utilities:
- **Line Reader**: Tests file content reading with caching, line context extraction, binary detection, size limits, and line ending normalization
- **Simple File Checker**: Path existence validation with environment-aware resolution

### Configuration Management
Environment-based configuration handling:
- **Language Configuration**: Tests parsing of disabled languages from environment variables with case-insensitive matching and whitespace handling
- **Logger Configuration**: Tests winston logger setup with transport configuration and environment-specific behaviors

## Testing Patterns

### Mock Strategy
- Comprehensive mocking of external dependencies (filesystem, winston, environment)
- Test doubles implementing standard interfaces (IFileSystem, IEnvironment)
- Isolated testing with proper mock cleanup and restoration

### Environment Testing
- Environment variable manipulation for different runtime scenarios
- Container mode detection and behavior validation
- Graceful handling of missing or invalid configuration

### Error Scenario Coverage
- Negative test cases for error conditions
- Boundary testing (file size limits, line numbers, empty inputs)
- Input validation and type safety testing

## Public API Surface
The test suite validates these key utility components:
- `LineReader`: File content reading with context extraction
- `SimpleFileChecker`: Path existence validation
- `ErrorMessages`: Standardized error message generation
- `createLogger()`: Winston logger configuration
- `getDisabledLanguages()`, `isLanguageDisabled()`: Language configuration utilities
- Container path utilities: `resolvePathForRuntime()`, `getPathDescription()`, `isContainerMode()`

## Integration Points
Tests demonstrate how utilities integrate with the larger system:
- Container-aware path resolution for cross-environment compatibility
- Centralized error message formatting for consistent user experience  
- Configurable logging with environment-specific transport handling
- File operations with proper error propagation and caching
- Language filtering based on environment configuration

The test suite ensures these foundational utilities provide reliable, well-tested infrastructure for the MCP debug server's core functionality across different deployment environments.