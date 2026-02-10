# tests/unit/utils/simple-file-checker.spec.ts
@source-hash: 39a266bc20945734
@generated: 2026-02-09T18:14:47Z

## Primary Purpose
Unit test suite for `SimpleFileChecker` utility class that validates file existence checking behavior in both host and container environments using a true hands-off approach (no path interpretation).

## Test Structure

### Main Test Suite (L8-165)
- **Setup**: Mock dependencies including `IFileSystem`, `IEnvironment`, and logger (L14-48)
- **Core Classes Under Test**: `SimpleFileChecker` and `createSimpleFileChecker` factory function
- **Dependencies**: Vitest testing framework, external dependency interfaces

### Mock Configuration (L14-48)
- **mockFileSystem**: Complete IFileSystem interface mock with all file operations
- **mockEnvironment**: Environment interface mock for container detection and workspace configuration
- **mockLogger**: Simple logger mock for debug output
- **checker**: SimpleFileChecker instance created with mocked dependencies

## Test Scenarios

### Host Mode Tests (L50-100)
Tests behavior when not running in container environment:
- **File Existence Check (L56-69)**: Verifies direct path usage without manipulation
- **Non-existent Files (L71-83)**: Validates proper handling of missing files
- **System Errors (L85-99)**: Tests error handling and graceful degradation

### Container Mode Tests (L102-157)
Tests behavior when `MCP_CONTAINER=true` and `MCP_WORKSPACE_ROOT=/workspace`:
- **Relative Path Handling (L112-125)**: Verifies `/workspace/` prefix addition to relative paths
- **Absolute Path Handling (L127-140)**: Tests that `/workspace/` is always prepended, even to already absolute paths (creating double prefix)
- **Path Format Agnostic (L142-156)**: Validates simple prefix addition without path interpretation (Windows-style paths get Unix prefix)

### Factory Function Test (L159-164)
Validates `createSimpleFileChecker` factory function returns proper instance.

## Key Testing Patterns
- **Environment Mocking**: Uses `mockImplementation` to simulate different container states
- **Async Testing**: All file operations are tested as async operations returning promises
- **Error Simulation**: Tests system-level errors through mock rejection
- **Path Validation**: Extensive testing of path manipulation logic in different environments

## Critical Test Insights
- Container mode always prepends `/workspace/` regardless of input path format
- No intelligent path interpretation - purely additive approach
- Error handling preserves original path information in results
- Factory function provides proper instantiation interface