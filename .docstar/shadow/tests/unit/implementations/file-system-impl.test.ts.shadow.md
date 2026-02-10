# tests/unit/implementations/file-system-impl.test.ts
@source-hash: b8f285bb5b4415b6
@generated: 2026-02-09T18:14:47Z

## FileSystemImpl Unit Tests

**Primary Purpose:** Comprehensive unit test suite for the FileSystemImpl class, testing all file system operations through mocked fs-extra dependencies.

### Test Structure

**Test Setup (L42-48):**
- Main describe block for FileSystemImpl
- beforeEach hook resets all mocks and creates fresh FileSystemImpl instance
- Uses Vitest testing framework with vi mocking utilities

**Mock Configuration (L8-38):**
- Complete fs-extra mock covering all used methods
- Mocks both async and sync operations: pathExists, readFile, writeFile, ensureDir, remove, copy, outputFile, access, mkdir, readdir, rmdir, stat, unlink, ensureDirSync
- Uses vi.mock with default export structure to match fs-extra usage pattern

### Test Coverage by Method

**Path Operations:**
- `pathExists` (L50-75): Tests existence checking, boolean returns, error propagation
- `exists` (L195-213): Tests access-based existence checking via fs.access

**File I/O Operations:**
- `readFile` (L77-103): Tests UTF-8 default encoding, explicit encoding parameter, error handling
- `writeFile` (L105-129): Tests string and Buffer content writing, error propagation
- `outputFile` (L179-193): Tests file output with directory creation, error handling
- `stat` (L260-274): Tests file statistics retrieval
- `unlink` (L276-282): Tests file deletion

**Directory Operations:**
- `ensureDir` (L131-145): Tests directory creation with error handling
- `mkdir` (L216-230): Tests directory creation with and without recursive option
- `readdir` (L232-240): Tests directory content listing
- `rmdir` (L242-257): Tests directory removal, including recursive removal via remove()
- `ensureDirSync` (L285-301): Tests synchronous directory creation

**Bulk Operations:**
- `remove` (L147-161): Tests file/directory removal with error handling
- `copy` (L163-177): Tests file/directory copying with error handling

### Test Patterns

**Error Handling:** Each method group includes error propagation tests using mockRejectedValue/mockImplementation
**Mock Verification:** All tests verify correct fs-extra method calls with expected arguments
**Edge Cases:** Tests cover both success and failure scenarios, different parameter combinations

### Dependencies

- **Vitest**: Testing framework (describe, it, expect, beforeEach, vi)
- **fs-extra**: File system library being mocked
- **FileSystemImpl**: Implementation under test from src/implementations/file-system-impl.js

### Key Architectural Decisions

- Comprehensive mocking strategy prevents actual file system operations during testing
- Separation of sync/async operations testing
- Consistent error propagation testing across all methods
- Mock reset in beforeEach ensures test isolation