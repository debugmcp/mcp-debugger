# tests/unit/utils/simple-file-checker.test.ts
@source-hash: 0416fa826bed7263
@generated: 2026-02-10T00:41:36Z

**Purpose**: Unit tests for SimpleFileChecker class, verifying file existence checking functionality with path resolution and error handling.

**Key Test Structure**:
- Uses Vitest framework with mocking capabilities (L1, L3-11)
- Tests `SimpleFileChecker` class and `createSimpleFileChecker` factory function (L14-16)
- Mock setup for path utilities using vi.hoisted pattern (L3-6) and vi.mock for module mocking (L8-11)

**Test Dependencies**:
- Mocks `container-path-utils.js` functions: `resolvePathForRuntime` and `getPathDescription` (L8-11)
- Creates mock file system with `pathExists` method (L19-21)
- Mock logger with debug method (L23)
- Mock environment object (L22)

**Test Cases**:

1. **Successful Path Resolution** (L32-48):
   - Verifies normal operation when path resolution and existence check succeed
   - Tests return structure with `exists: true`, `originalPath`, and `effectivePath`
   - Validates debug logging behavior

2. **Path Resolution Error Handling** (L50-64):
   - Tests behavior when `resolvePathForRuntime` throws an error
   - Uses factory function `createSimpleFileChecker` instead of constructor
   - Verifies error propagation with `exists: false` and `errorMessage` fields

3. **File System Error Handling** (L66-83):
   - Tests behavior when `pathExists` operation fails
   - Validates error message formatting: "Cannot check file existence: [error]"
   - Confirms debug logging for failed checks

**Test Setup Pattern**:
- `beforeEach` hook (L25-30) clears all mocks for test isolation
- Consistent mock object structure with typed vi.fn declarations
- Uses `as any` type assertions for dependency injection compatibility

**Key Behaviors Tested**:
- Path resolution integration via mocked utilities
- Error boundary handling for both resolution and file system operations
- Logging integration with structured debug messages
- Return value consistency across success/failure scenarios