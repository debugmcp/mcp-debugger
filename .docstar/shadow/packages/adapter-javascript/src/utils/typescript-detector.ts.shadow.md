# packages/adapter-javascript/src/utils/typescript-detector.ts
@source-hash: 43947ff9c9de7311
@generated: 2026-02-10T00:41:06Z

## Primary Purpose
Detects TypeScript runtime executables (tsx and ts-node) with local-first resolution strategy, caching results for performance.

## Key Components

**TsRunnerDetection Type (L14)**: Result interface with optional tsx and ts-node executable paths

**Cache Management**:
- `cached` variable (L16): Module-wide cache for detection results
- `clearCache()` (L29-31): Resets cache for testing
- `defaultFileSystem` (L19): Configurable filesystem abstraction

**Core Detection Functions**:
- `detectBinary()` (L43-70): Detects single TypeScript runner with platform-aware binary resolution
- `detectTsRunners()` (L76-89): Main async function that detects both tsx and ts-node with caching

**Utility Functions**:
- `setDefaultFileSystem()` (L25-27): Dependency injection for filesystem testing
- `toAbs()` (L33-35): Converts paths to absolute form

## Detection Strategy

**Local-First Resolution (L50-61)**: Checks `<cwd>/node_modules/.bin/` first for project-local installations

**Platform-Aware Binary Names (L48)**: Windows supports `.cmd`, `.exe`, and bare executable names; Unix uses bare names only

**PATH Fallback (L63-67)**: Uses `whichInPath` utility when local binaries not found

## Dependencies
- `path`: Node.js path manipulation
- `@debugmcp/shared`: FileSystem abstraction layer
- `./executable-resolver.js`: Cross-platform executable resolution utilities

## Architectural Patterns
- **Dependency Injection**: FileSystem parameter allows testing with mock implementations
- **Process-Level Caching**: Results cached module-wide to avoid repeated filesystem operations
- **Fail-Safe Design**: Returns undefined rather than throwing on detection failures
- **Platform Abstraction**: Handles Windows vs Unix executable naming conventions