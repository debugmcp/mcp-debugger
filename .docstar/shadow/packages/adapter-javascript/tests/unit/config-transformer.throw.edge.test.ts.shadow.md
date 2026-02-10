# packages/adapter-javascript/tests/unit/config-transformer.throw.edge.test.ts
@source-hash: 234e52677657f740
@generated: 2026-02-10T00:41:08Z

## Purpose
Edge case test suite for config-transformer utility functions, specifically testing error handling and fault tolerance when file system operations throw exceptions.

## Key Components

### Mock Setup (L7-16)
- `existsSyncMock` and `readFileSyncMock` variables for controlling fs behavior
- ESM-safe fs module mock using vitest's `vi.mock()` with delegate pattern
- Preserves actual fs implementation while allowing selective override of `existsSync` and `readFileSync`

### Test Configuration (L21-31)
- `projDir` and `programDir` path constants for test scenarios
- `beforeEach` (L24-27): Resets mocks to safe defaults (return false/empty string)
- `afterEach` (L29-31): Restores all mocks to clean state

### Test Cases

#### `isESMProject` Error Handling (L33-65)
- **Test 1 (L33-50)**: Validates function handles `existsSync` throws for package.json and tsconfig.json files gracefully, returns `false` instead of propagating errors
- **Test 2 (L52-65)**: Tests `readFileSync` throw scenarios, ensuring function remains fault-tolerant

#### `hasTsConfigPaths` Error Handling (L67-85)
- **Test 3 (L67-76)**: Verifies function handles `existsSync` throws for tsconfig.json, returns `false`
- **Test 4 (L78-85)**: Tests `readFileSync` throw scenarios for tsconfig.json parsing

## Architecture Patterns
- **Fault tolerance testing**: All tests verify functions return sensible defaults (`false`) rather than throwing
- **Selective mocking**: Uses path-based conditional logic to throw errors only for specific files
- **ESM compatibility**: Mock implementation preserves actual fs module while enabling test control

## Dependencies
- `vitest` for testing framework and mocking
- `path` for file path manipulation
- Imports `isESMProject` and `hasTsConfigPaths` from config-transformer utils

## Critical Behavior
Functions under test must be exception-safe and return meaningful defaults when file system operations fail, preventing crashes in production environments with file permission issues or missing files.