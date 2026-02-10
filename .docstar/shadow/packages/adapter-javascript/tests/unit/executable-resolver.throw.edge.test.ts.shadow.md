# packages/adapter-javascript/tests/unit/executable-resolver.throw.edge.test.ts
@source-hash: a0b24eacf2d3d732
@generated: 2026-02-10T00:41:10Z

## Purpose
Edge case and error handling test suite for the executable-resolver utility module. Specifically tests throw/catch scenarios and boundary conditions in path resolution logic for Node.js executable discovery.

## Key Components

### MockFileSystem Class (L9-34)
- **Purpose**: Test double implementing FileSystem interface for controlled error simulation
- **Methods**:
  - `setExistsMock(mock)` (L13-15): Injects custom behavior for file existence checks
  - `setReadFileMock(mock)` (L17-19): Injects custom behavior for file reading
  - `existsSync(path)` (L21-26): Returns mock result or false default
  - `readFileSync(path, encoding)` (L28-33): Returns mock result or empty string default
- **Pattern**: Dependency injection pattern for filesystem operations

### Test Utilities

#### withPath Function (L38-44)
- **Purpose**: Temporary PATH environment variable manipulation
- **Returns**: Cleanup function to restore original PATH
- **Usage**: Creates isolated test environment for PATH-dependent tests

#### WIN Constant (L36)
Platform detection flag for Windows-specific test branching

### Test Suite Structure (L46-162)

#### Setup/Teardown (L50-64)
- **beforeEach**: Initializes fresh MockFileSystem and sets it as default
- **afterEach**: Restores environment and resets to NodeFileSystem

#### Test Cases

**Empty PATH Test (L66-70)**
- Verifies `whichInPath` returns undefined when PATH is empty
- Tests boundary condition of no search paths

**Exception Recovery Test (L72-109)**
- **Purpose**: Tests resilience when filesystem operations throw exceptions
- **POSIX Path** (L74-90): Tests directory-level exception handling
- **Windows Path** (L92-108): Tests extension-level exception handling
- **Pattern**: Exception thrown on first candidate, second candidate succeeds

**findNode Exception Tests (L111-161)**
- **execPath Throws Test (L111-122)**: Tests fallback when process.execPath check fails
- **PATH Candidate Recovery (L124-161)**: Tests recovery from PATH candidate exceptions

## Dependencies
- **External**: vitest, path, @debugmcp/shared
- **Internal**: executable-resolver utility functions (whichInPath, findNode, isWindows, setDefaultFileSystem)

## Test Patterns
1. **Platform-aware testing**: Different logic paths for Windows vs POSIX
2. **Exception simulation**: Controlled error injection via mocks
3. **Environment isolation**: PATH manipulation with cleanup
4. **Fallback verification**: Ensures graceful degradation on errors

## Key Invariants
- FileSystem must be reset between tests to avoid cross-contamination
- PATH modifications must be cleaned up to prevent side effects
- Platform-specific behavior must be tested separately for Windows/POSIX