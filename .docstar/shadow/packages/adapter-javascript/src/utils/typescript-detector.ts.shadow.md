# packages/adapter-javascript/src/utils/typescript-detector.ts
@source-hash: 43947ff9c9de7311
@generated: 2026-02-09T18:13:57Z

## TypeScript Runtime Detection Utility

**Primary Purpose:** Detects and locates TypeScript runtime executables (`tsx` and `ts-node`) with local node_modules prioritization and PATH fallback, using module-level caching for performance.

### Key Components

**Core Types:**
- `TsRunnerDetection` (L14): Object type containing optional paths to tsx and tsNode executables

**State Management:**
- `cached` (L16): Module-level cache storing detection results
- `defaultFileSystem` (L19): Configurable filesystem abstraction defaulting to NodeFileSystem

**Primary Functions:**
- `detectBinary()` (L43-70): Single binary detection with Windows suffix handling (.cmd/.exe/bare)
- `detectTsRunners()` (L76-89): Main async API detecting both tsx and ts-node with caching
- `clearCache()` (L29-31): Cache invalidation utility for testing
- `setDefaultFileSystem()` (L25-27): Dependency injection for filesystem abstraction

**Helper Functions:**
- `toAbs()` (L33-35): Path normalization to absolute paths

### Detection Algorithm

1. **Local Priority:** Searches `<cwd>/node_modules/.bin/` first
2. **PATH Fallback:** Uses `whichInPath` utility for system-wide detection  
3. **Windows Support:** Tries `.cmd`, `.exe`, then bare executable names
4. **Caching:** Results cached at module level until `clearCache()` called

### Dependencies

- `path`: Node.js path manipulation
- `@debugmcp/shared`: FileSystem abstraction (NodeFileSystem)
- `./executable-resolver.js`: whichInPath utility and isWindows detection

### Architecture Patterns

- **Strategy Pattern:** Pluggable filesystem via dependency injection
- **Caching Strategy:** Module-level memoization with explicit cache control
- **Error Handling:** Graceful degradation - returns undefined rather than throwing
- **Platform Abstraction:** Windows-specific executable suffix handling