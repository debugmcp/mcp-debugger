# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/stat.py
@source-hash: 052af0327eae6941
@generated: 2026-02-09T18:13:07Z

## Primary Purpose
Python module providing constants and utility functions for interpreting file system metadata from `os.stat()` and `os.lstat()` calls. Part of the LLDB debugger's Python environment on Windows x64.

## Key Constants

### Stat Tuple Indices (L8-17)
- `ST_MODE`, `ST_INO`, `ST_DEV`, etc. - Integer indices for accessing fields in stat tuple returned by `os.stat()`

### File Type Constants (L36-46)
- `S_IFDIR`, `S_IFCHR`, `S_IFREG`, etc. - Octal bitmasks for identifying file types
- Platform fallback constants `S_IFDOOR`, `S_IFPORT`, `S_IFWHT` set to 0 for unsupported types

### Permission Constants (L92-110)
- `S_ISUID`, `S_ISGID`, `S_ISVTX` - Special permission bits
- `S_IRWXU`, `S_IRUSR`, `S_IWUSR`, etc. - Standard Unix permission bits for user/group/other

### File Flags (L114-125)
- `UF_*` constants - User-settable file flags (nodump, immutable, append-only, etc.)
- `SF_*` constants - System file flags

### Windows File Attributes (L172-188)
- `FILE_ATTRIBUTE_*` constants - Windows-specific file attribute flags

## Key Functions

### Mode Manipulation (L21-31)
- `S_IMODE(mode)` - Extract permission bits (chmod-settable portion)
- `S_IFMT(mode)` - Extract file type bits

### File Type Tests (L50-88)
- `S_ISDIR()`, `S_ISCHR()`, `S_ISBLK()`, etc. - Boolean functions to test file types
- `S_ISDOOR()`, `S_ISPORT()`, `S_ISWHT()` - Always return False (unsupported types)

### String Conversion (L156-166)
- `filemode(mode)` - Convert mode integer to Unix-style permission string (e.g., "-rwxrwxrwx")
- Uses `_filemode_table` (L128-154) for character mapping

## Architecture
- Pure Python implementation with optional C fallback (L192-195)
- Designed for cross-platform compatibility with Unix-style semantics
- Windows-specific extensions for FILE_ATTRIBUTE constants
- Follows Python standard library stat module interface

## Critical Invariants
- File type constants are mutually exclusive bitmasks
- Permission bits follow standard Unix octal notation
- Mode parameter expected as integer from `os.stat().st_mode`
- `_filemode_table` order matters for proper socket detection (L130 comment)