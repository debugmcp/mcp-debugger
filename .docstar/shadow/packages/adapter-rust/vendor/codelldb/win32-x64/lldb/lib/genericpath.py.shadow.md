# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/genericpath.py
@source-hash: 6a271770c5e0c0a5
@generated: 2026-02-09T18:12:50Z

## Primary Purpose
Cross-platform filesystem path operations module for Python's `os.path` implementation. Provides OS-agnostic implementations of common path utilities that are imported by platform-specific modules (posixpath, ntpath, etc.).

## Key Functions

### Path Existence & Type Checking
- `exists(path)` (L16-22): Tests path existence using `os.stat()`, returns False for broken symlinks
- `isfile(path)` (L27-33): Tests if path is regular file using `stat.S_ISREG()`
- `isdir(s)` (L39-45): Tests if path is directory using `stat.S_ISDIR()`
- `islink(path)` (L51-57): Tests if path is symbolic link using `os.lstat()` and `stat.S_ISLNK()`

### File Metadata Access
- `getsize(filename)` (L60-62): Returns file size via `os.stat().st_size`
- `getmtime(filename)` (L65-67): Returns modification time via `os.stat().st_mtime`
- `getatime(filename)` (L70-72): Returns access time via `os.stat().st_atime`
- `getctime(filename)` (L75-77): Returns metadata change time via `os.stat().st_ctime`

### Path Comparison & Analysis
- `commonprefix(m)` (L81-95): Finds longest common prefix of path list, handles `os.PathLike` objects
- `samestat(s1, s2)` (L99-102): Compares stat buffers by inode and device numbers
- `samefile(f1, f2)` (L106-114): Tests if two paths reference same file via stat comparison
- `sameopenfile(fp1, fp2)` (L119-123): Tests if two open file objects reference same file

### Utility Functions
- `_splitext(p, sep, altsep, extsep)` (L133-154): Generic extension splitting implementation with separator parameters
- `_check_arg_types(funcname, *args)` (L156-166): Validates path arguments are str/bytes/PathLike, prevents mixing types

## Dependencies
- `os`: Core filesystem operations (`stat`, `lstat`, `fstat`, `fspath`)
- `stat`: File mode constants and tests (`S_ISREG`, `S_ISDIR`, `S_ISLNK`)

## Architecture Notes
- Designed as internal implementation module (warning against direct use in docstring)
- All functions handle `OSError` and `ValueError` exceptions gracefully
- Follows symbolic links by default (uses `os.stat()` not `os.lstat()`)
- `_splitext()` supports both text and bytes strings
- Type checking prevents mixing str/bytes in path operations

## Exported Interface
Module exports 11 functions via `__all__` (L9-11): `commonprefix`, `exists`, `getatime`, `getctime`, `getmtime`, `getsize`, `isdir`, `isfile`, `islink`, `samefile`, `sameopenfile`, `samestat`