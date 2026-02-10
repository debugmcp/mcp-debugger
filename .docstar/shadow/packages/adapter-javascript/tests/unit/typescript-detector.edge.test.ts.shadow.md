# packages/adapter-javascript/tests/unit/typescript-detector.edge.test.ts
@source-hash: 3a513b54e6f1de09
@generated: 2026-02-10T00:41:08Z

## Purpose
Unit test file for TypeScript binary detection edge cases, focusing on executable ordering and PATH precedence behavior across Windows and POSIX systems.

## Key Components

### MockFileSystem Class (L10-35)
Test double implementing `FileSystem` interface with configurable mock behaviors:
- `setExistsMock()` (L14-16): Configures file existence checks
- `setReadFileMock()` (L18-20): Configures file reading behavior
- `existsSync()` (L22-27): Returns mocked existence results
- `readFileSync()` (L29-34): Returns mocked file content

### Test Utilities
- `withPath()` helper (L39-45): Temporarily modifies PATH environment variable for testing
- `WIN` constant (L37): Platform detection flag using `isWindows()`

### Test Suite Structure (L47-138)
Tests `detectBinary` function from `typescript-detector.js` with focus on:

**Setup/Teardown (L51-67)**:
- Installs MockFileSystem before each test
- Restores environment and default filesystem after each test

**Windows Executable Priority Test (L69-97)**:
- Validates Windows-specific suffix ordering: `.cmd > .exe > bare`
- Tests local `node_modules/.bin` directory precedence
- Skips on POSIX systems with undefined expectation

**PATH Directory Precedence Test (L99-117)**:
- Verifies directory-first resolution across PATH entries
- Tests that earlier PATH directories win regardless of suffix priority
- Uses multi-directory PATH setup

**Platform-Specific Suffix Preference Test (L119-137)**:
- Windows: prefers `.cmd` over `.exe` and bare within same directory
- POSIX: prefers bare executable over extensions

## Dependencies
- `vitest`: Testing framework
- `@debugmcp/shared`: FileSystem interfaces
- `../../src/utils/typescript-detector.js`: Function under test
- `../../src/utils/executable-resolver.js`: Platform detection

## Architecture Notes
- Uses dependency injection pattern with configurable FileSystem
- Platform-conditional test logic for cross-platform compatibility
- Environment isolation ensures tests don't affect system state