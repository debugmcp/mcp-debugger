# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/genericpath.py
@source-hash: 6a271770c5e0c0a5
@generated: 2026-02-09T18:07:04Z

## Purpose
Core path operation utilities providing OS-agnostic file system functionality. Serves as a shared module imported by OS-specific path libraries (posix, nt). Not intended for direct use by end users.

## Key Functions

### File System Queries
- **exists(path)** (L16-22): Tests path existence using os.stat(), returns False for broken symlinks and handles OSError/ValueError gracefully
- **isfile(path)** (L27-33): Checks if path is regular file using stat.S_ISREG(), follows symlinks
- **isdir(s)** (L39-45): Verifies directory existence using stat.S_ISDIR(), follows symlinks  
- **islink(path)** (L51-57): Detects symbolic links using os.lstat() and stat.S_ISLNK(), handles systems without lstat support

### File Metadata Access
- **getsize(filename)** (L60-62): Returns file size via os.stat().st_size
- **getmtime(filename)** (L65-67): Returns last modification time
- **getatime(filename)** (L70-72): Returns last access time
- **getctime(filename)** (L75-77): Returns metadata change time

### Path Operations  
- **commonprefix(m)** (L81-95): Finds longest common leading component of path list, handles os.PathLike objects, uses lexicographic min/max for efficiency
- **_splitext(p, sep, altsep, extsep)** (L133-154): Generic extension splitting implementation, parametrized with separators, handles leading dots correctly

### File Identity Comparison
- **samestat(s1, s2)** (L99-102): Compares stat buffers using inode and device numbers
- **samefile(f1, f2)** (L106-114): Tests if two paths reference same file via stat comparison
- **sameopenfile(fp1, fp2)** (L119-123): Tests if two open file objects reference same file via fstat

### Utility Functions
- **_check_arg_types(funcname, *args)** (L156-167): Type validation ensuring no mixing of str/bytes in path arguments

## Dependencies
- **os**: Core file system operations (stat, lstat, fstat, fspath)
- **stat**: File mode constants and type checking functions

## Architectural Notes
- Consistent error handling pattern: OSError/ValueError caught and converted to False returns
- Symlink-aware design: isfile/isdir follow links, islink detects them
- Cross-platform compatibility: AttributeError handling for systems lacking specific functions
- Type safety: Path-like object support with proper str/bytes separation

## Exported Interface
__all__ defines 11 public functions for file existence, type checking, metadata access, and path operations.