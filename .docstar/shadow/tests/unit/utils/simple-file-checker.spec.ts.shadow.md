# tests/unit/utils/simple-file-checker.spec.ts
@source-hash: 39a266bc20945734
@generated: 2026-02-10T00:41:36Z

## Purpose
Unit test suite for `SimpleFileChecker` utility that validates file existence checking with different path handling behaviors in host vs container environments.

## Test Structure
- **Main test suite (L8-165)**: `SimpleFileChecker` with comprehensive mocking setup
- **Setup (L14-48)**: Creates mocks for `IFileSystem`, `IEnvironment`, and logger with all required interface methods
- **Host Mode tests (L50-100)**: Tests behavior when not in container mode
- **Container Mode tests (L102-157)**: Tests path prefixing behavior in containerized environment
- **Factory function tests (L159-164)**: Validates factory pattern implementation

## Key Test Scenarios

### Host Mode Behavior (L50-100)
- **File existence check (L56-69)**: Verifies direct path usage without manipulation
- **Non-existent files (L71-83)**: Tests negative case handling
- **System errors (L85-99)**: Tests error handling with proper error message formatting

### Container Mode Behavior (L102-157)
- **Environment setup (L103-110)**: Mocks `MCP_CONTAINER=true` and `MCP_WORKSPACE_ROOT=/workspace`
- **Relative path prefixing (L112-125)**: Tests `/workspace/` prefix addition to relative paths
- **Absolute path handling (L127-140)**: Tests double prefixing behavior (intentional design)
- **Path format agnostic (L142-156)**: Tests that Windows-style paths get simple prefix without interpretation

## Dependencies
- **Testing framework**: Vitest with mocking capabilities
- **Source imports**: 
  - `SimpleFileChecker`, `createSimpleFileChecker` from `src/utils/simple-file-checker.js`
  - Interface types from `src/interfaces/external-dependencies.js`

## Mock Strategy
Comprehensive interface mocking with all `IFileSystem` methods (L16-32) and `IEnvironment` methods (L35-39), ensuring isolated testing without real file system access.

## Critical Test Insights
- Container mode always prepends `/workspace/` regardless of input path format (L137-139)
- No path interpretation or normalization - purely additive prefixing approach
- Error handling wraps system errors in descriptive messages (L97)