# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/stat.py
@source-hash: 052af0327eae6941
@generated: 2026-02-09T18:08:06Z

## Purpose
Python standard library module providing constants and utility functions for interpreting file system stat results from os.stat() and os.lstat(). Part of LLDB's embedded Python environment for debugging tools.

## Key Components

### Stat Tuple Indices (L8-17)
Constants defining positions in stat result tuples:
- `ST_MODE`, `ST_INO`, `ST_DEV`, `ST_NLINK`, `ST_UID`, `ST_GID`, `ST_SIZE`, `ST_ATIME`, `ST_MTIME`, `ST_CTIME`

### Mode Extraction Functions (L21-31)
- `S_IMODE(mode)` (L21-25): Extracts permission bits (chmod-settable portion)
- `S_IFMT(mode)` (L27-31): Extracts file type portion of mode

### File Type Constants (L36-46)
Unix file type constants for use with S_IFMT():
- `S_IFDIR`, `S_IFCHR`, `S_IFBLK`, `S_IFREG`, `S_IFIFO`, `S_IFLNK`, `S_IFSOCK`
- Platform fallbacks: `S_IFDOOR`, `S_IFPORT`, `S_IFWHT` (set to 0)

### File Type Test Functions (L50-88)
Boolean functions testing file types:
- `S_ISDIR()`, `S_ISCHR()`, `S_ISBLK()`, `S_ISREG()`, `S_ISFIFO()`, `S_ISLNK()`, `S_ISSOCK()` (L50-76)
- Platform-specific stubs: `S_ISDOOR()`, `S_ISPORT()`, `S_ISWHT()` (L78-88) - always return False

### Permission Constants (L92-110)
Unix permission bit constants:
- Special bits: `S_ISUID`, `S_ISGID`, `S_ENFMT`, `S_ISVTX` (L92-95)
- Legacy Unix V7: `S_IREAD`, `S_IWRITE`, `S_IEXEC` (L96-98)
- Owner/Group/Other permissions: `S_IRWXU`, `S_IRUSR`, etc. (L99-110)

### File Flag Constants (L114-125)
BSD-style file flag constants:
- User flags: `UF_NODUMP`, `UF_IMMUTABLE`, `UF_APPEND`, etc. (L114-120)
- System flags: `SF_ARCHIVED`, `SF_IMMUTABLE`, `SF_APPEND`, etc. (L121-125)

### Mode Formatting (L128-166)
- `_filemode_table` (L128-154): Lookup table for converting mode bits to ls-style strings
- `filemode(mode)` (L156-166): Converts file mode to "-rwxrwxrwx" format string

### Windows Compatibility (L172-188)
FILE_ATTRIBUTE constants for Windows os.stat() st_file_attributes member.

### C Implementation Fallback (L192-195)
Attempts to import optimized C implementation from _stat module, silently falls back to Python implementation if unavailable.

## Dependencies
- Standard library only
- Optional C extension `_stat` for performance

## Architectural Notes
- Pure utility module with no state
- Follows Unix stat conventions with Windows compatibility layer
- Designed for "from stat import *" usage pattern
- Provides both low-level constants and high-level convenience functions