# packages/adapter-javascript/tests/unit/typescript-detector.test.ts
@source-hash: 7d6854f2d251d37d
@generated: 2026-02-09T18:14:06Z

## Test Suite: TypeScript Runners Detection

This test file validates the `typescript-detector` utility that locates TypeScript execution tools (tsx and ts-node) in both local project dependencies and system PATH.

### Core Functionality
Tests the `detectTsRunners()` function which returns paths to available TypeScript runners, with caching behavior and cross-platform compatibility (Windows vs Unix).

### Test Infrastructure

**MockFileSystem Class (L10-28)**
- Implements `FileSystem` interface for controlled testing
- `setExistsMock()` (L13-15): Configures file existence behavior
- `existsSync()` (L17-22): Returns mocked file existence results
- `readFileSync()` (L24-27): Stub implementation (unused by tested code)

**Test Utilities**
- `withPath()` helper (L33-39): Temporarily modifies PATH environment variable
- `callCount` global (L31): Tracks filesystem operation calls for caching validation
- Platform detection via `isWindows()` (L30) for cross-platform executable handling

### Test Setup/Teardown (L45-65)
- `beforeEach()`: Clears cache, resets mocks, initializes fresh MockFileSystem
- `afterEach()`: Restores environment, clears cache, resets to NodeFileSystem

### Test Cases

**Empty Environment Test (L67-78)**
- Validates behavior when no TypeScript runners are available
- Tests with empty PATH and no local binaries
- Expects both `tsx` and `tsNode` to be undefined

**Local Detection Test (L80-97)**  
- Tests detection of tsx in `node_modules/.bin/`
- Platform-aware executable checking (.cmd extension on Windows)
- Verifies local binaries take precedence over PATH

**PATH Detection Test (L99-120)**
- Tests fallback to system PATH when no local binaries exist
- Creates mock binary in temporary directory added to PATH
- Validates ts-node detection from system installation

**Caching Behavior Test (L122-157)**
- Verifies results are cached between calls to avoid redundant filesystem operations
- Tests cache invalidation via `clearCache()`
- Validates filesystem call count to confirm caching effectiveness

### Key Dependencies
- `detectTsRunners`, `clearCache`, `setDefaultFileSystem` from `typescript-detector.js`
- `FileSystem`, `NodeFileSystem` from `@debugmcp/shared`
- `isWindows` from `executable-resolver.js`

### Testing Patterns
- Cross-platform path handling with Windows-specific executable extensions
- Environment variable manipulation with cleanup
- Mock injection for controlled filesystem behavior
- Call counting for cache validation
- Async/await testing pattern for detection functions