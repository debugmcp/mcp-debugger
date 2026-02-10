# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/genericpath.py
@source-hash: 6a271770c5e0c0a5
@generated: 2026-02-09T18:08:15Z

This module provides cross-platform path operations as part of Python's standard library, serving as a shared foundation for OS-specific path modules like `os.path` and `pathlib`. It implements common filesystem operations that work across different operating systems.

## Core Functions

**File/Directory Testing (L16-57):**
- `exists(path)` (L16-22): Tests path existence using `os.stat()`, returns False for broken symlinks
- `isfile(path)` (L27-33): Checks if path is regular file using `stat.S_ISREG()`
- `isdir(s)` (L39-45): Checks if path is directory using `stat.S_ISDIR()`
- `islink(path)` (L51-57): Tests for symbolic links using `os.lstat()` and `stat.S_ISLNK()`

**File Metadata Access (L60-77):**
- `getsize(filename)` (L60-62): Returns file size from `st_size`
- `getmtime(filename)` (L65-67): Returns modification time from `st_mtime`
- `getatime(filename)` (L70-72): Returns access time from `st_atime`  
- `getctime(filename)` (L75-77): Returns metadata change time from `st_ctime`

**Path Comparison and Analysis (L81-123):**
- `commonprefix(m)` (L81-95): Finds longest common prefix in pathname list, handles `os.PathLike` objects
- `samestat(s1, s2)` (L99-102): Compares stat buffers using inode and device numbers
- `samefile(f1, f2)` (L106-114): Tests if two paths reference same file via stat comparison
- `sameopenfile(fp1, fp2)` (L119-123): Tests if two file objects reference same file via fstat

**Utility Functions (L133-167):**
- `_splitext(p, sep, altsep, extsep)` (L133-154): Generic extension splitter parametrized by separators, handles leading dots correctly
- `_check_arg_types(funcname, *args)` (L156-167): Type validation ensuring no mixing of str/bytes in path operations

## Key Design Patterns

- **Error Handling**: All stat-based functions catch `OSError` and `ValueError`, returning False rather than propagating exceptions
- **Symlink Behavior**: Functions follow symlinks by default (using `stat()` vs `lstat()`)
- **Cross-Platform**: Designed to work with both text and bytes strings
- **PathLike Support**: `commonprefix()` converts arguments using `os.fspath()` for modern path object compatibility

## Dependencies

- `os`: Core filesystem operations (`stat`, `lstat`, `fstat`, `fspath`)
- `stat`: Constants for file type testing (`S_ISREG`, `S_ISDIR`, `S_ISLNK`)

This module serves as the implementation layer for higher-level path modules and should not be imported directly by user code.