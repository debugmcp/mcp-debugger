# packages/adapter-javascript/tests/unit/executable-resolver.edge.test.ts
@source-hash: d19f6bf1a864d226
@generated: 2026-02-10T00:41:08Z

## Purpose
Edge case test suite for executable resolution utilities, specifically testing cross-platform behavior of Node.js executable discovery with mocked file systems.

## Key Components

### MockFileSystem (L9-22)
Test double implementing `FileSystem` interface with configurable existence checks via `setExistsMock()`. Returns false by default when no mock is set.

### Test Utilities
- `withPath()` (L26-32): Temporarily modifies `process.env.PATH` and returns cleanup function
- `WIN` constant (L24): Platform detection flag using `isWindows()`

### Test Suite Structure (L34-123)
Setup/teardown (L38-51): Configures mock file system and restores environment state between tests.

## Test Cases

### Platform-specific Executable Preference (L53-72)
Tests `whichInPath()` behavior when multiple Node executables exist:
- Windows: prefers `node.exe` over `node` in same directory
- POSIX: uses `node` only
- Validates absolute path resolution

### PATH Directory Precedence (L74-93) 
Verifies `whichInPath()` prioritizes directories in PATH order over executable name preferences. Tests scenario where earlier PATH directory contains less-preferred executable name.

### Relative Path Resolution (L95-102)
Tests `findNode()` with relative preferred path, ensuring proper absolute path resolution when file exists.

### Fallback Behavior (L104-122)
Complex test of `findNode()` fallback logic:
1. When `process.execPath` doesn't exist but PATH candidate does → returns PATH candidate
2. When neither exists → falls back to resolved `process.execPath`

## Dependencies
- `@debugmcp/shared`: FileSystem interface
- `executable-resolver.js`: Core utilities under test (`whichInPath`, `findNode`, `isWindows`, `setDefaultFileSystem`)

## Test Patterns
- Environment isolation with cleanup
- Cross-platform executable naming conventions
- Mock-driven file system behavior
- Deterministic fallback testing