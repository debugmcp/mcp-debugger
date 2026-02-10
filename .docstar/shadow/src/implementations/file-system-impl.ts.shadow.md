# src/implementations/file-system-impl.ts
@source-hash: d346a8479a1bdbdb
@generated: 2026-02-09T18:15:02Z

## Purpose
Concrete file system implementation that wraps fs-extra functionality to provide standardized async file operations. Acts as an adapter between the IFileSystem interface and Node.js file system operations.

## Key Components

### FileSystemImpl Class (L8-78)
Implements IFileSystem interface using fs-extra as the underlying provider. All methods are thin wrappers that delegate to fs-extra with consistent error handling and type safety.

**Core File Operations:**
- `readFile()` (L10-12): Reads file content with UTF-8 default encoding
- `writeFile()` (L14-16): Writes string or Buffer data to file
- `exists()` (L18-25): Checks file existence using fs.access() with try/catch pattern
- `unlink()` (L39-41): Deletes files

**Directory Operations:**
- `mkdir()` (L27-29): Creates directories with optional recursive flag
- `readdir()` (L31-33): Lists directory contents
- `rmdir()` (L43-48): Removes directories, uses fs.remove() for recursive deletion
- `ensureDir()/ensureDirSync()` (L51-57): Creates directory and parent directories if needed

**Enhanced fs-extra Features:**
- `pathExists()` (L59-61): Alternative existence check
- `existsSync()` (L63-65): Synchronous existence check
- `remove()` (L67-69): Removes files/directories recursively
- `copy()` (L71-73): Copies files/directories
- `outputFile()` (L75-77): Writes file and creates parent directories

## Dependencies
- `fs-extra`: Primary file system operations provider
- `fs.Stats`: Type definition for file statistics
- `@debugmcp/shared.IFileSystem`: Interface contract

## Architectural Patterns
- **Adapter Pattern**: Wraps fs-extra to conform to IFileSystem interface
- **Promise-based API**: All operations return Promises for consistency
- **Thin Wrapper**: Minimal abstraction over fs-extra, preserving original functionality
- **Dual API Support**: Provides both async and sync variants where applicable (ensureDir, exists)

## Critical Implementation Details
- `rmdir()` switches to `fs.remove()` for recursive operations (L44-45)
- `exists()` uses access() pattern instead of deprecated fs.exists (L19-24)
- Default UTF-8 encoding applied to readFile operations (L11)