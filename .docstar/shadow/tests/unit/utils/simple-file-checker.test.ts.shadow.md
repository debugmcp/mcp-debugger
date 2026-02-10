# tests/unit/utils/simple-file-checker.test.ts
@source-hash: 0416fa826bed7263
@generated: 2026-02-09T18:14:44Z

## Purpose
Unit test suite for `SimpleFileChecker` utility class, testing file existence checking functionality with path resolution and error handling.

## Test Structure
- **Main describe block** (L18-84): Tests for `SimpleFileChecker` class
- **Mock setup** (L3-11): Hoisted mocks for container path utilities
- **Test fixtures** (L19-23): Mock filesystem, environment, and logger objects

## Key Test Cases

### Successful Path Resolution Test (L32-48)
- Tests normal operation flow: path resolution → existence check → result formatting
- Verifies correct result structure with `exists`, `originalPath`, `effectivePath` fields
- Validates debug logging with path descriptions

### Path Resolution Error Handling (L50-64) 
- Tests error propagation when `resolvePathForRuntime` throws
- Uses factory function `createSimpleFileChecker` instead of constructor
- Verifies error message inclusion in result and fallback to original path

### Filesystem Error Handling (L66-83)
- Tests behavior when `pathExists` operation fails
- Validates error message formatting with "Cannot check file existence:" prefix
- Confirms debug logging of failure details

## Dependencies
- **Vitest framework**: Test runner with mocking capabilities
- **Mocked modules**: `container-path-utils.js` via `vi.mock()`
- **Under test**: `SimpleFileChecker` class and `createSimpleFileChecker` factory

## Test Patterns
- Mock clearing in `beforeEach` (L25-30) ensures test isolation
- Type assertions with `as any` for mock objects
- Consistent result structure validation across success/error scenarios
- Debug logging verification in both success and failure paths