# packages/adapter-javascript/tests/unit/executable-resolver.edge.test.ts
@source-hash: d19f6bf1a864d226
@generated: 2026-02-09T18:14:01Z

## Purpose and Responsibility

Unit test file for `executable-resolver.js` utilities, focusing on edge cases for executable path resolution across Windows and POSIX systems. Tests the behavior of `whichInPath` and `findNode` functions under various PATH configurations and file system states.

## Key Components

### MockFileSystem Class (L9-22)
- Test double implementing `FileSystem` interface
- `setExistsMock(mock)` (L12-14): Configures custom file existence behavior
- `existsSync(path)` (L16-21): Returns mock existence results or false by default

### Test Utilities
- `withPath(paths)` (L26-32): Temporarily modifies `process.env.PATH` and returns cleanup function
- `WIN` constant (L24): Cached result of `isWindows()` for platform-specific test logic

### Test Setup (L38-51)
- `beforeEach`: Initializes fresh `MockFileSystem` and sets as default
- `afterEach`: Restores original PATH, resets mocks, restores `NodeFileSystem`

## Test Cases

### Platform-Specific Executable Preference (L53-72)
Tests that `whichInPath` correctly prioritizes:
- Windows: `node.exe` over `node` when both exist in same directory
- POSIX: Only searches for `node`

### PATH Directory Precedence (L74-93)
Verifies that directories earlier in PATH take precedence over later directories, even when later directories contain preferred executable names.

### Relative Path Resolution (L95-102)
Tests `findNode` with relative `preferredPath` - ensures absolute path resolution when file exists.

### Fallback Behavior (L104-122)
Tests `findNode` fallback logic:
1. When `process.execPath` doesn't exist but PATH candidate does → returns PATH candidate
2. When neither exists → returns resolved `process.execPath` as deterministic fallback

## Dependencies
- **vitest**: Test framework and mocking utilities
- **@debugmcp/shared**: `FileSystem` and `NodeFileSystem` interfaces
- **../../src/utils/executable-resolver.js**: Functions under test (`whichInPath`, `findNode`, `isWindows`, `setDefaultFileSystem`)

## Architectural Patterns
- Dependency injection pattern: Uses `setDefaultFileSystem` to inject mock during tests
- Environment isolation: Careful PATH manipulation with cleanup
- Platform-agnostic testing: Uses `isWindows()` to adapt test expectations
- Mock-based testing: FileSystem abstraction enables deterministic file existence simulation