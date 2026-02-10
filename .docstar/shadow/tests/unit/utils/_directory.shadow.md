# tests/unit/utils/
@generated: 2026-02-10T21:26:22Z

## Purpose
This directory contains comprehensive unit test suites for the utility layer of the MCP debug server, providing test coverage for core infrastructure components including path resolution, file operations, error handling, logging, and configuration management.

## Key Components and Testing Areas

### Container Path Utilities Testing
- **container-path-utils.spec.ts**: Tests container-aware path resolution functionality, validating workspace root detection, path prefixing in containerized environments, and path description generation for user feedback
- Provides mock environment implementation for isolated testing of container vs host mode behaviors

### File System Utilities Testing  
- **simple-file-checker.spec.ts & simple-file-checker.test.ts**: Dual test coverage for file existence checking with path resolution integration
- Tests both factory pattern and constructor-based instantiation
- Validates container-aware path prefixing and error handling for file system operations

### Line Reading and File Processing
- **line-reader.spec.ts**: Comprehensive testing of file content reading with line context extraction, caching mechanisms, binary file detection, and size limits
- Tests multi-line range extraction and cache management for performance optimization

### Error Handling and Messaging
- **error-messages.test.ts**: Tests standardized error message generation for timeout scenarios (DAP requests, proxy initialization, step operations, adapter readiness)
- Validates consistent error message extraction from various input types

### Configuration Management
- **language-config.test.ts**: Tests environment-based language configuration, specifically the parsing and querying of disabled languages from `DEBUG_MCP_DISABLE_LANGUAGES`
- Validates case-insensitive language matching and robust input parsing

### Logging Infrastructure  
- **logger.test.ts**: Tests winston-based logger creation with transport configuration, error handling, and environment-specific behaviors
- Validates container vs host logging configurations and fallback mechanisms

## Testing Patterns and Organization

### Common Test Patterns
- **Mock Environment Management**: Consistent pattern of preserving and restoring `process.env` state across tests
- **Dependency Injection**: Extensive use of interface mocking (`IFileSystem`, `IEnvironment`) for isolated unit testing
- **Error Boundary Testing**: Comprehensive coverage of error conditions and graceful failure handling
- **Environment-Aware Testing**: Tests validate different behaviors in container vs host environments

### Test Infrastructure
- **Vitest Framework**: All tests use Vitest with consistent describe/it structure and mock management
- **Mock Factories**: Reusable mock implementations for common interfaces and dependencies
- **Type Safety**: Tests maintain TypeScript type safety even with mock objects using `vi.mocked()` patterns

### Coverage Areas
- Path resolution and workspace root handling in containerized environments
- File system operations with caching and performance considerations  
- Error message standardization for debugging operations
- Configuration parsing from environment variables
- Logging setup and transport management
- Robust input validation and edge case handling

## Integration Points
The test suites validate utilities that support the broader MCP debug server functionality:
- Container path utilities enable workspace-relative file operations
- File checkers support source file validation and debugging
- Line readers provide context for error reporting and debugging output
- Error messages standardize user-facing diagnostic information
- Language configuration supports selective feature enabling/disabling
- Logging infrastructure provides observability across the debug server

## Key Testing Insights
- Tests emphasize container vs host environment behavioral differences
- Comprehensive error handling ensures graceful degradation
- Caching mechanisms are validated for performance-critical file operations
- Environment variable parsing includes robust whitespace and case handling
- Mock patterns enable isolated testing of complex dependency chains