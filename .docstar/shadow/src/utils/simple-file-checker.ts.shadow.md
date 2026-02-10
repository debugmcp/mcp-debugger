# src/utils/simple-file-checker.ts
@source-hash: c4bcb5e71d5554f9
@generated: 2026-02-09T18:15:06Z

## Purpose
Lightweight file existence checker that centralizes path resolution and provides detailed feedback for UX purposes. Follows a "hands-off" policy by delegating path resolution to `container-path-utils` and focusing solely on existence checks.

## Key Components

### FileExistenceResult Interface (L17-22)
Result object containing:
- `exists`: boolean existence status
- `originalPath`: client-provided path
- `effectivePath`: resolved path that was actually checked
- `errorMessage`: optional error details for system failures

### SimpleFileChecker Class (L27-78)
Main checker class with dependencies:
- `fileSystem`: IFileSystem for path operations
- `environment`: IEnvironment for runtime context
- `logger`: optional debug logging interface

**Key Method:**
- `checkExists(path: string)` (L37-77): Core functionality that resolves paths via `resolvePathForRuntime()`, logs path descriptions, and performs existence checks with comprehensive error handling

### Factory Function (L83-88)
`createSimpleFileChecker()`: Convenience factory for instantiating SimpleFileChecker

## Architecture & Dependencies
- **Primary Dependency**: `container-path-utils` for `resolvePathForRuntime()` and `getPathDescription()`
- **External Interfaces**: `@debugmcp/shared` for IFileSystem and IEnvironment contracts
- **Error Handling**: Two-phase approach - path resolution errors vs file system operation errors
- **Logging**: Optional debug logging with structured messages including path descriptions

## Key Patterns
- **Centralized Path Resolution**: Delegates all path manipulation to utility module
- **Defensive Programming**: Handles both path resolution and file system errors gracefully
- **Transparent Debugging**: Logs both original and effective paths for troubleshooting
- **Graceful Degradation**: Returns structured results even on failures with clear error messages

## Design Constraints
1. Must use centralized path resolution (no local path manipulation)
2. Only performs existence checks (no file operations)
3. Provides immediate UX feedback with detailed path information
4. Clear separation between path resolution and existence check errors