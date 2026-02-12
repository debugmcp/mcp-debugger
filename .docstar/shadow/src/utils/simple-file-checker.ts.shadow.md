# src/utils/simple-file-checker.ts
@source-hash: d6177bb834860e30
@generated: 2026-02-11T16:12:51Z

## Primary Purpose

Simple file existence checker utility that implements centralized path resolution policy for cross-environment compatibility (host vs container modes). Provides immediate UX feedback by checking file existence with proper path handling and error reporting.

## Key Components

### FileExistenceResult Interface (L18-23)
Return type containing:
- `exists`: boolean existence flag
- `originalPath`: client-provided path
- `effectivePath`: resolved path that was actually checked
- `errorMessage`: optional system error details

### SimpleFileChecker Class (L28-93)
Main utility class with dependencies:
- `fileSystem`: IFileSystem for path operations
- `environment`: IEnvironment for runtime context
- `logger`: optional debug logging interface

**Key Method: checkExists(path: string) (L38-92)**
- Uses `resolvePathForRuntime()` for centralized path resolution
- Enforces absolute path requirement in host mode (L45-57)
- Handles path resolution failures gracefully (L61-72)
- Performs actual existence check via `fileSystem.pathExists()` (L74-91)
- Returns structured result with original/effective paths for debugging

### Factory Function (L98-103)
`createSimpleFileChecker()` provides clean instantiation interface.

## Dependencies

- `node:path`: Native Node.js path utilities for absolute path validation
- `@debugmcp/shared`: Core interfaces (IFileSystem, IEnvironment)
- `./container-path-utils.js`: Centralized path resolution functions
  - `resolvePathForRuntime()`: Main path resolution
  - `getPathDescription()`: Debug-friendly path formatting
  - `isContainerMode()`: Environment detection

## Architectural Decisions

**Path Resolution Strategy**: Delegates all path transformation to container-path-utils for consistency across the codebase.

**Host Mode Protection**: Explicitly rejects relative paths in host mode (L45-57) to prevent downstream debug adapter failures, as Node.js fs operations would resolve relative paths via process.cwd().

**Error Handling**: Two-tier error handling - path resolution errors vs filesystem access errors, both logged and returned in structured format.

**Logging Policy**: Comprehensive debug logging of path transformations and failures for troubleshooting cross-environment issues.

## Critical Constraints

1. Must use centralized path resolution (policy requirement)
2. Absolute paths required in host mode for debug adapter compatibility
3. Container mode paths are inherently absolute due to workspace prefixing
4. All errors must be non-throwing and returned in result structure