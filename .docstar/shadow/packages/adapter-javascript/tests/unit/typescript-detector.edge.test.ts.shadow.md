# packages/adapter-javascript/tests/unit/typescript-detector.edge.test.ts
@source-hash: 3a513b54e6f1de09
@generated: 2026-02-09T18:14:06Z

## Purpose
Edge test suite for TypeScript binary detection logic, focusing on PATH precedence and platform-specific executable suffix ordering. Validates cross-platform behavior differences between Windows and POSIX systems.

## Key Components

### MockFileSystem (L10-35)
Test double implementing FileSystem interface with configurable mock behaviors:
- `setExistsMock()` (L14-16): Configure file existence simulation
- `setReadFileMock()` (L18-20): Configure file content simulation  
- `existsSync()` (L22-27): Mock file existence check
- `readFileSync()` (L29-34): Mock file reading

### Test Utilities
- `withPath()` (L39-45): Helper for temporarily modifying PATH environment variable
- `WIN` constant (L37): Platform detection flag using `isWindows()`

## Test Structure

### Setup/Teardown (L51-67)
- `beforeEach`: Initializes MockFileSystem and sets default "no files exist" behavior
- `afterEach`: Restores original PATH and resets to NodeFileSystem

### Test Cases

#### Windows Suffix Priority (L69-97)
Tests local `node_modules/.bin` suffix ordering on Windows:
- Priority: `.cmd > .exe > bare`
- Verifies detectBinary respects suffix precedence within single directory
- POSIX systems return undefined when no files exist

#### PATH Directory Precedence (L99-117)
Validates directory-first resolution across PATH entries:
- Earlier PATH directories win regardless of suffix priority
- Tests with `ts-node` binary across directories A and B
- Ensures local node_modules exclusion works correctly

#### Platform-Specific Single Directory (L119-137)
Tests suffix preference within single PATH directory:
- Windows: prefers `.cmd` over `.exe` over bare
- POSIX: prefers bare executable
- All suffix variants present in same directory

## Dependencies
- **vitest**: Test framework (describe, it, expect, beforeEach, afterEach)
- **@debugmcp/shared**: FileSystem interfaces (FileSystem, NodeFileSystem)
- **typescript-detector.js**: Target module (detectBinary, setDefaultFileSystem)
- **executable-resolver.js**: Platform detection (isWindows)

## Testing Patterns
- Mock-based isolation using dependency injection
- Platform-conditional test logic with early returns
- Environment variable manipulation with cleanup
- Path resolution testing across different directory structures