# packages/adapter-javascript/src/utils/executable-resolver.ts
@source-hash: 839840ffa428c4ca
@generated: 2026-02-09T18:13:55Z

## Primary Purpose
Cross-platform Node.js executable resolver that provides deterministic path discovery without spawning processes. Used by JavaScript adapter to locate Node.js executable with configurable filesystem abstraction for testing.

## Key Functions

### `findNode(preferredPath?, fileSystem?)` (L74-109)
Core resolver function implementing 4-tier precedence:
1. preferredPath if provided and exists
2. process.execPath if exists  
3. PATH search using platform-specific candidates
4. Fallback to process.execPath (deterministic)

Always returns absolute path. Uses injectable FileSystem for testability.

### `whichInPath(names, fileSystem?)` (L42-63)
PATH search utility that respects directory ordering. Iterates PATH directories first, then candidate names within each directory. Returns first match or undefined.

### `isWindows()` (L33-35)
Platform detection helper returning boolean based on process.platform.

### `resolveNodeExecutable(preferredPath?)` (L111-113)  
Convenience wrapper around findNode using default filesystem.

### `setDefaultFileSystem(fileSystem)` (L29-31)
Dependency injection for filesystem implementation, primarily for testing.

## Architecture & Patterns

- **Dependency Injection**: FileSystem abstraction (L20, L23) enables hermetic testing
- **Error Resilience**: All filesystem operations wrapped in try-catch with silent failures
- **Platform Adaptation**: Windows uses ['node.exe', 'node'] candidates, POSIX uses ['node'] (L101)
- **Deterministic Fallback**: Always returns process.execPath as last resort to prevent failures

## Dependencies
- Node.js built-ins: `path`, `process`
- `@debugmcp/shared`: FileSystem interface and NodeFileSystem implementation

## Critical Invariants
- Always returns absolute paths via `path.resolve()`
- PATH search respects directory precedence over candidate name precedence
- Silent error handling maintains deterministic behavior in test environments
- No subprocess spawning (performance and security consideration)