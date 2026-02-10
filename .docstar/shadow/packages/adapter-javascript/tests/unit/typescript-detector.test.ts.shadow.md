# packages/adapter-javascript/tests/unit/typescript-detector.test.ts
@source-hash: 7d6854f2d251d37d
@generated: 2026-02-10T00:41:11Z

## TypeScript Detector Test Suite

Unit tests for the `detectTsRunners` function that locates TypeScript runtime executables (tsx, ts-node) in local node_modules/.bin and system PATH.

### Test Infrastructure

**MockFileSystem (L10-28)**: Test double implementing `FileSystem` interface
- `setExistsMock(mock)` (L13): Configures file existence simulation
- `existsSync(path)` (L17): Returns mock results or false by default
- `readFileSync()` (L24): Stub implementation (unused by detector)

**withPath(paths) (L33-39)**: Utility for temporarily modifying process.env.PATH
- Returns cleanup function to restore original PATH
- Used to simulate different PATH environments during tests

### Test Setup & Teardown

**beforeEach (L45-55)**: 
- Clears detection cache via `clearCache()`
- Initializes `MockFileSystem` with false-returning existence mock
- Tracks filesystem calls via global `callCount`

**afterEach (L57-65)**:
- Restores all mocks and cache state
- Resets PATH environment if modified
- Restores real `NodeFileSystem`

### Test Cases

**Empty Environment (L67-78)**: Verifies both `tsx` and `tsNode` return undefined when no executables found in empty PATH or local bins

**Local Detection (L80-97)**: Tests detection of tsx in `node_modules/.bin/`
- Platform-aware executable naming (`.cmd` suffix on Windows)
- Prioritizes local over PATH installations
- Mocks only the target executable as existing

**PATH Detection (L99-120)**: Tests fallback to system PATH when local binaries absent
- Simulates ts-node available in PATH directory
- Ensures local checks fail before PATH search
- Platform-aware executable resolution

**Caching Behavior (L122-157)**: Validates result caching and cache invalidation
- First call populates cache, second call skips filesystem checks
- `clearCache()` forces re-detection with updated environment
- Tracks filesystem call counts to verify caching effectiveness

### Dependencies

- **vitest**: Testing framework and mocking utilities
- **@debugmcp/shared**: FileSystem interface and NodeFileSystem implementation  
- **typescript-detector.js**: Target module exports (`detectTsRunners`, `clearCache`, `setDefaultFileSystem`)
- **executable-resolver.js**: Platform detection (`isWindows`)

### Key Patterns

- Cross-platform executable handling (Windows .cmd vs Unix executables)
- Dependency injection via `setDefaultFileSystem()` for testability
- Cache validation through filesystem call counting
- Environment restoration to prevent test pollution