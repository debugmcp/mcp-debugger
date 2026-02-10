# packages/adapter-javascript/src/utils/executable-resolver.ts
@source-hash: 839840ffa428c4ca
@generated: 2026-02-10T00:41:06Z

## Cross-Platform Node.js Executable Resolver

**Primary Purpose**: Provides deterministic Node.js executable path resolution across platforms without spawning processes, with configurable filesystem abstraction for testing.

### Key Functions

**`findNode(preferredPath?, fileSystem?): Promise<string>` (L74-109)**
- Core resolver implementing 4-tier precedence strategy:
  1. preferredPath (if exists)
  2. process.execPath (if exists) 
  3. PATH search with platform-specific candidates
  4. Deterministic fallback to process.execPath
- Always returns absolute paths via `path.resolve()`
- Graceful error handling with try-catch blocks ignoring filesystem errors

**`whichInPath(names, fileSystem?): string | undefined` (L42-63)**
- PATH-aware binary search respecting directory precedence
- Iterates directories first, then candidate names within each directory
- Returns first match as absolute path or undefined if none found
- Platform-agnostic implementation using `process.env.PATH`

**`isWindows(): boolean` (L33-35)**
- Platform detection utility checking `process.platform === 'win32'`

**`resolveNodeExecutable(preferredPath?): Promise<string>` (L111-113)**
- Convenience wrapper around `findNode()` using default filesystem

### Architecture Patterns

**Dependency Injection**: FileSystem abstraction (L20-31) enables testing via `setDefaultFileSystem()`
- Default: NodeFileSystem instance (L23)
- Injectable via optional parameters in core functions

**Platform-Specific Behavior**: 
- Windows candidates: `['node.exe', 'node']` (L101)
- POSIX candidates: `['node']` (L101)

**Error Resilience**: All filesystem operations wrapped in try-catch blocks to maintain deterministic behavior during testing

### Dependencies
- `path`: Node.js path manipulation
- `@debugmcp/shared`: FileSystem interface and NodeFileSystem implementation

### Critical Constraints
- Must return absolute paths in all cases
- No process spawning (deterministic, cross-platform)
- Respects PATH environment variable ordering
- Graceful degradation with guaranteed fallback to process.execPath