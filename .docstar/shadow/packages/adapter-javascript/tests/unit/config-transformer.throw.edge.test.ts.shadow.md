# packages/adapter-javascript/tests/unit/config-transformer.throw.edge.test.ts
@source-hash: 234e52677657f740
@generated: 2026-02-09T18:14:00Z

## Purpose
Edge case testing for `config-transformer` utility functions, specifically testing error resilience when filesystem operations throw exceptions. Validates that `isESMProject` and `hasTsConfigPaths` gracefully handle filesystem errors without propagating exceptions.

## Key Test Structure
- **Test Suite** (L20): `utils/config-transformer.throw.edge` - focused on exception handling scenarios
- **Setup/Teardown** (L24-31): Configures mock behaviors and restores mocks after each test
- **Mock Variables** (L7-8): `existsSyncMock` and `readFileSyncMock` - delegatable mock functions for fs operations

## Mock Implementation Pattern
- **fs Module Mock** (L9-16): ESM-safe mocking strategy using `vi.importActual` and delegation pattern
- **Delegate Functions** (L11-14): Conditional execution - uses mocks when available, falls back to actual fs operations
- **Mock Reset** (L25-26): Ensures clean state with default non-throwing behaviors

## Test Cases

### isESMProject Error Handling
- **existsSync Throws Test** (L33-50): Verifies function returns `false` when `existsSync` throws for package.json and tsconfig.json files
- **readFileSync Throws Test** (L52-65): Ensures function remains safe when file reading operations fail

### hasTsConfigPaths Error Handling  
- **existsSync Throws Test** (L67-76): Confirms function returns `false` when tsconfig.json existence check throws
- **readFileSync Throws Test** (L78-85): Validates graceful handling of JSON parsing failures due to read errors

## Dependencies
- **Testing Framework**: Vitest (describe, it, expect, beforeEach, afterEach, vi)
- **Node.js Modules**: path, fs (PathLike type)
- **Target Functions**: `isESMProject`, `hasTsConfigPaths` from `config-transformer.js`

## Test Data Pattern
- **Project Structure**: Uses `proj-throw-edge` as test project directory with `src` subdirectory
- **File Paths**: Constructs specific paths for package.json and tsconfig.json at different directory levels
- **Error Messages**: Consistent error message patterns for different failure scenarios