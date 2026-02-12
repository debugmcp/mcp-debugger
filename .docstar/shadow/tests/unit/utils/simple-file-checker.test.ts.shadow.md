# tests/unit/utils/simple-file-checker.test.ts
@source-hash: 58c3e504ed5ec085
@generated: 2026-02-11T16:12:48Z

## Purpose
Unit test suite for the `SimpleFileChecker` utility class, validating file existence checking functionality with path resolution and error handling in both host and container environments.

## Test Structure
- **Test Suite (L20-88)**: Comprehensive test coverage for `SimpleFileChecker` class and `createSimpleFileChecker` factory function
- **Mock Setup (L3-13)**: Hoisted mocks for container path utilities using Vitest's `vi.hoisted()` pattern
- **Test Dependencies (L21-25)**: Mock objects for file system, environment, and logger dependencies

## Key Mock Functions
- `resolvePathForRuntimeMock` (L4): Mocks path resolution for runtime environment
- `getPathDescriptionMock` (L5): Mocks path description generation
- `isContainerModeMock` (L6): Mocks container mode detection
- `fileSystem.pathExists` (L22): Mocks file system existence checks
- `logger.debug` (L25): Mocks debug logging

## Test Scenarios
1. **Successful Path Resolution (L36-52)**: Tests normal operation where path resolves and file exists
2. **Path Resolution Error (L54-68)**: Tests error handling when path resolution fails
3. **File System Error (L70-87)**: Tests error handling when file existence check fails

## Test Reset Pattern
- **beforeEach Hook (L27-34)**: Clears all mocks and sets default container mode to false (host mode)

## Key Assertions
- Validates return object structure with `exists`, `originalPath`, `effectivePath` fields
- Verifies error propagation with `errorMessage` field
- Confirms debug logging with descriptive messages
- Tests both class constructor and factory function instantiation

## Dependencies
- **Vitest**: Testing framework with mocking capabilities
- **Container Path Utils**: Mocked dependency for path resolution logic
- **SimpleFileChecker**: The class under test from `../../../src/utils/simple-file-checker.js`