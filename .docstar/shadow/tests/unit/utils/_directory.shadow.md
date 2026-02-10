# tests/unit/utils/
@generated: 2026-02-09T18:16:14Z

## Overall Purpose

The `tests/unit/utils` directory contains comprehensive unit tests for utility modules that provide core infrastructure services across the debug-mcp-server system. These utilities handle path resolution, error management, logging, language configuration, file operations, and line-based content reading with container environment awareness.

## Key Components and Testing Coverage

### Container and Path Management
- **container-path-utils.spec.ts**: Tests container mode detection and workspace path resolution with MockEnvironment dependency injection
- **simple-file-checker.spec.ts & simple-file-checker.test.ts**: Dual test coverage for file existence checking with container-aware path manipulation

### Error and Message Handling  
- **error-messages.test.ts**: Validates timeout message formatting for DAP operations, debug proxy initialization, and step timeouts
- **logger.test.ts**: Tests Winston logger configuration, transport setup, and environment-specific logging behavior

### Configuration and Language Support
- **language-config.test.ts**: Tests language filtering via environment variables with case-insensitive matching and Set-based storage

### File Content Processing
- **line-reader.spec.ts**: Comprehensive testing of line context extraction, multi-line reading, caching, and binary file detection

## Testing Patterns and Public API

### Common Test Infrastructure
All test files follow consistent patterns:
- Mock dependency injection for clean isolation
- Environment variable preservation/restoration 
- Comprehensive error condition testing
- Both positive and negative case validation

### Key API Entry Points Tested
- **Path Resolution**: `isContainerMode()`, `getWorkspaceRoot()`, `resolvePathForRuntime()`, `getPathDescription()`
- **Error Utilities**: `ErrorMessages` static methods, `getErrorMessage()` function
- **Language Config**: `getDisabledLanguages()`, `isLanguageDisabled()`
- **File Operations**: `LineReader` class, `createLineReader()`, `SimpleFileChecker` class, `createSimpleFileChecker()`
- **Logging**: Logger initialization and transport configuration

### Container Environment Integration
Multiple test suites validate container-aware behavior:
- Path prefixing with `/workspace/` in container mode
- Environment variable detection (`MCP_CONTAINER`, `MCP_WORKSPACE_ROOT`)
- Container-specific logging paths (`/app/logs/debug-mcp-server.log`)

## Internal Organization

### Mock Strategy
- **Filesystem abstraction**: IFileSystem interface mocking for testable file operations
- **Environment abstraction**: IEnvironment interface for consistent environment variable handling
- **Winston mocking**: Complete logger framework mocking with transport verification

### Data Flow Validation
Tests verify proper data flow through:
1. Environment detection → Path resolution → File operations
2. Error conditions → Message formatting → User-friendly output  
3. Configuration parsing → Language filtering → Runtime behavior
4. File content → Line extraction → Context generation with caching

### Performance and Reliability Testing
- **Caching verification**: LineReader cache behavior and statistics
- **Error resilience**: Graceful degradation when file operations fail
- **Cross-platform support**: Windows CRLF line ending compatibility
- **Resource management**: File size limits and binary file detection