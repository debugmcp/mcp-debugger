# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/genericpath.py
@source-hash: 6a271770c5e0c0a5
@generated: 2026-02-09T18:09:15Z

## Primary Purpose
Cross-platform path manipulation utilities shared by OS-specific path modules (posix, nt, etc.). Not intended for direct use - OS modules import these functions and expose them through their own interfaces.

## Core Functions

### File System Tests
- **exists()** (L16-22): Tests path existence using os.stat(), returns False for broken symlinks and handles OSError/ValueError
- **isfile()** (L27-33): Tests if path is regular file using stat.S_ISREG(), follows symlinks
- **isdir()** (L39-45): Tests if path is directory using stat.S_ISDIR(), follows symlinks  
- **islink()** (L51-57): Tests if path is symbolic link using os.lstat() and stat.S_ISLNK(), handles AttributeError for systems without lstat

### File Metadata
- **getsize()** (L60-62): Returns file size from os.stat().st_size
- **getmtime()** (L65-67): Returns last modification time from os.stat().st_mtime
- **getatime()** (L70-72): Returns last access time from os.stat().st_atime
- **getctime()** (L75-77): Returns metadata change time from os.stat().st_ctime

### Path Analysis
- **commonprefix()** (L81-95): Finds longest common leading component of path list, handles os.PathLike objects via os.fspath(), uses lexicographic min/max comparison
- **_splitext()** (L133-154): Generic extension splitting with configurable separators, handles leading dots correctly, works with both text and bytes

### File Identity
- **samestat()** (L99-102): Compares two stat buffers using device number and inode
- **samefile()** (L106-114): Tests if two paths reference same file using stat comparison
- **sameopenfile()** (L119-123): Tests if two file objects reference same file using fstat comparison

### Utilities
- **_check_arg_types()** (L156-167): Validates function arguments are str/bytes/PathLike, prevents mixing string types

## Dependencies
- **os**: Core file system operations (stat, lstat, fstat, fspath)
- **stat**: File type and permission constants (S_ISREG, S_ISDIR, S_ISLNK)

## Key Patterns
- Consistent exception handling: All file tests catch OSError and ValueError
- Symlink handling: Functions that follow vs don't follow symlinks are clearly distinguished
- Type safety: Functions handle both string and bytes paths, with validation
- Cross-platform design: Uses os.lstat with AttributeError fallback for systems without symlink support

## Exported Interface
Module exports 11 functions via __all__ (L9-11): commonprefix, exists, getatime, getctime, getmtime, getsize, isdir, isfile, islink, samefile, sameopenfile, samestat