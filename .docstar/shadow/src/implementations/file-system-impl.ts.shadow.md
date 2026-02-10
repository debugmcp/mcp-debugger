# src/implementations/file-system-impl.ts
@source-hash: d346a8479a1bdbdb
@generated: 2026-02-10T00:41:46Z

**Primary Purpose:** Concrete implementation of the `IFileSystem` interface using the `fs-extra` library, providing enhanced file system operations with promise-based APIs.

**Key Class:**
- `FileSystemImpl` (L8-78): Main implementation class that wraps `fs-extra` methods to fulfill the `IFileSystem` contract

**Core Methods:**

**Basic File Operations (L10-41):**
- `readFile(path, encoding?)` (L10): Reads file content with UTF-8 default encoding
- `writeFile(path, data)` (L14): Writes string or Buffer data to file
- `exists(path)` (L18): Checks file/directory existence using `fs.access()` with try/catch pattern
- `mkdir(path, options?)` (L27): Creates directories with optional recursive flag
- `readdir(path)` (L31): Lists directory contents
- `stat(path)` (L35): Returns file/directory statistics
- `unlink(path)` (L39): Deletes files

**Advanced Directory Operations:**
- `rmdir(path, options?)` (L43): Removes directories, uses `fs.remove()` for recursive deletion, otherwise `fs.rmdir()`

**fs-extra Enhanced Methods (L51-77):**
- `ensureDir(path)` (L51): Creates directory and parent directories if they don't exist
- `ensureDirSync(path)` (L55): Synchronous version of ensureDir
- `pathExists(path)` (L59): Alternative existence check method
- `existsSync(path)` (L63): Synchronous existence check
- `remove(path)` (L67): Recursively removes files/directories
- `copy(src, dest)` (L71): Copies files/directories
- `outputFile(file, data)` (L75): Writes file and creates parent directories if needed

**Dependencies:**
- `fs-extra`: Primary dependency for enhanced file system operations
- `fs.Stats`: Type import for file statistics
- `@debugmcp/shared.IFileSystem`: Interface contract being implemented

**Architecture Notes:**
- Simple adapter pattern wrapping fs-extra methods
- Provides both async and sync variants for certain operations
- Consistent error handling through fs-extra's promise-based API
- Dual approach for directory removal (recursive vs non-recursive)