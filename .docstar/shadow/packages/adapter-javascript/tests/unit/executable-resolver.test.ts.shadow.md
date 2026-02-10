# packages/adapter-javascript/tests/unit/executable-resolver.test.ts
@source-hash: 98bc22d95366c7b4
@generated: 2026-02-10T00:41:10Z

## Purpose
Test suite for executable-resolver utility functions, specifically testing `findNode` and `whichInPath` functionality for locating Node.js executables across different platforms and PATH configurations.

## Key Components

### MockFileSystem Class (L11-24)
- Implements `FileSystem` interface for testing
- `setExistsMock()` (L14-16): Sets custom file existence behavior
- `existsSync()` (L18-23): Returns mock or default false for file existence checks
- Used to simulate different filesystem states without actual file operations

### Test Utilities

**withPath() Helper (L26-32)**
- Temporarily modifies `process.env.PATH` for testing
- Returns cleanup function to restore original PATH
- Enables testing PATH-based executable resolution

**Test Setup/Teardown (L38-53)**
- `beforeEach`: Initializes fresh MockFileSystem and sets as default
- `afterEach`: Restores mocks and resets to NodeFileSystem

## Test Cases

### Basic Node Resolution (L55-60)
Tests `findNode()` returns `process.execPath` when no preferred path specified and execPath exists

### Preferred Path Priority (L62-68) 
Verifies preferred path takes precedence over execPath when it exists
Platform-aware: uses `.exe` extension on Windows

### PATH Fallback (L70-86)
Tests PATH-based resolution when execPath is unavailable
- Creates mock binary directory structure
- Simulates execPath non-existence to trigger PATH search
- Verifies first matching executable in PATH is returned

### whichInPath Directory Precedence (L88-106)
Tests `whichInPath()` search algorithm:
- Directory-first precedence: earlier PATH directories searched completely before later ones
- Within each directory: candidate names checked in provided order
- Expects `dirA/nodeB` over `dirB/nodeA` despite name order

### Fallback Behavior (L108-115)
Tests deterministic fallback when no executables found:
- Empty PATH and no existing files
- Still returns resolved `process.execPath` for predictable behavior

## Dependencies
- **Vitest**: Test framework and mocking
- **@debugmcp/shared**: FileSystem interfaces
- **executable-resolver.js**: Functions under test (`findNode`, `whichInPath`, `isWindows`, `setDefaultFileSystem`)

## Platform Handling
Uses `WIN` constant (L6) from `isWindows()` to handle platform-specific executable extensions (.exe on Windows)

## Key Testing Patterns
- FileSystem dependency injection for isolated testing
- Environment variable manipulation with cleanup
- Cross-platform executable name handling
- Mock-driven filesystem simulation