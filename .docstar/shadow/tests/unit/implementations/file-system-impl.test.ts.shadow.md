# tests/unit/implementations/file-system-impl.test.ts
@source-hash: 9d69f1db4fa908e7
@generated: 2026-02-10T01:18:59Z

## Purpose
Comprehensive unit test suite for `FileSystemImpl` class, providing test coverage for file system abstraction layer. Tests all file and directory operations with proper mocking of `fs-extra` library.

## Test Structure
- **Main describe block** (L40-300): `FileSystemImpl` test suite
- **Setup** (L43-46): Mock clearing and fresh instance creation before each test
- **Mock configuration** (L8-36): Complete `fs-extra` mock setup with all required methods

## Core Test Groups

### Path Operations
- **pathExists tests** (L48-73): Validates path existence checking, including error propagation
- **exists tests** (L193-211): Tests alternative existence method using `fs.access`

### File I/O Operations  
- **readFile tests** (L75-101): String reading with encoding options (utf8, default utf-8)
- **writeFile tests** (L103-127): String and Buffer writing capabilities
- **outputFile tests** (L177-191): File output with directory creation

### Directory Management
- **ensureDir tests** (L129-143): Async directory creation
- **ensureDirSync tests** (L283-299): Synchronous directory creation
- **directory operations** (L213-256): mkdir, readdir, rmdir with recursive options

### File System Operations
- **remove tests** (L145-159): File/directory removal
- **copy tests** (L161-175): File/directory copying
- **file operations** (L258-281): stat and unlink operations

## Key Testing Patterns
- **Mock setup**: Extensive `vi.mock()` configuration covering all fs-extra methods (L8-36)
- **Error handling**: Each operation group tests error propagation scenarios
- **Type flexibility**: Tests handle both string and Buffer content types
- **Options handling**: Tests both with and without optional parameters (encoding, recursive flags)

## Dependencies
- **Testing framework**: Vitest with describe/it/expect/beforeEach/vi
- **External mock**: fs-extra (comprehensive method mocking)
- **Target class**: `../../../src/implementations/file-system-impl.js`

## Architecture Notes
- Uses default export mocking pattern for fs-extra
- Consistent async/await testing pattern throughout
- Proper mock clearing in beforeEach to ensure test isolation
- Tests both success and error scenarios for each method