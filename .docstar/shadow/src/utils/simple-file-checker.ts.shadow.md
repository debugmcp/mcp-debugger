# src/utils/simple-file-checker.ts
@source-hash: c4bcb5e71d5554f9
@generated: 2026-02-10T00:41:53Z

**Purpose**: Utility module providing centralized file existence checking with path resolution and debug logging capabilities.

**Key Components**:

- **FileExistenceResult interface (L17-22)**: Return type with existence status, original/effective paths, and optional error message
- **SimpleFileChecker class (L27-78)**: Main checker with dependency injection for filesystem, environment, and optional logger
- **checkExists method (L37-77)**: Core functionality that resolves paths via container-path-utils, checks existence via filesystem service, and handles errors gracefully
- **createSimpleFileChecker factory (L83-89)**: Factory function for instantiating checker with dependencies

**Dependencies**:
- `@debugmcp/shared`: IFileSystem and IEnvironment interfaces for dependency injection
- `./container-path-utils.js`: Path resolution utilities (resolvePathForRuntime, getPathDescription)

**Architectural Patterns**:
- **Dependency injection**: Constructor accepts filesystem, environment, and logger dependencies
- **Centralized path resolution**: Delegates all path handling to container-path-utils module
- **Error isolation**: Separates path resolution errors from filesystem access errors
- **Graceful degradation**: Returns structured results even when operations fail

**Error Handling Strategy**:
- Path resolution failures (L46-57): Return false with original path as effective path
- Filesystem access failures (L66-76): Return false with resolved path and descriptive error message
- All errors logged for debugging while maintaining clean API responses

**Key Invariants**:
- Always returns FileExistenceResult structure regardless of success/failure
- Original path preserved in results for client reference
- Effective path shows what was actually checked (resolved or original on resolution failure)
- Error messages only present for system-level failures, not simple non-existence