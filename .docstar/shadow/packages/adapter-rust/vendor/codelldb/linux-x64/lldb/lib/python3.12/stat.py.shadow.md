# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/stat.py
@source-hash: 052af0327eae6941
@generated: 2026-02-09T18:10:05Z

## Purpose and Responsibility

This module provides constants and utility functions for interpreting file system stat information returned by `os.stat()` and `os.lstat()`. It serves as a cross-platform abstraction layer for Unix-style file permissions, file types, and metadata interpretation.

## Key Constants and Functions

### Stat Tuple Indices (L8-17)
Constants defining positions in the stat tuple:
- `ST_MODE` through `ST_CTIME` - Index positions for accessing stat tuple elements

### Mode Extraction Functions (L21-31)
- `S_IMODE(mode)` (L21-25) - Extracts file permission bits (0o7777 mask)
- `S_IFMT(mode)` (L27-31) - Extracts file type bits (0o170000 mask)

### File Type Constants (L36-46)
Unix file type bit patterns:
- `S_IFDIR`, `S_IFCHR`, `S_IFBLK`, `S_IFREG`, etc. - Standard Unix file type constants
- Platform-specific fallbacks (`S_IFDOOR`, `S_IFPORT`, `S_IFWHT`) set to 0

### File Type Test Functions (L50-88)
Boolean predicates for file type detection:
- `S_ISDIR(mode)` through `S_ISSOCK(mode)` (L50-76) - Test for standard file types
- `S_ISDOOR(mode)`, `S_ISPORT(mode)`, `S_ISWHT(mode)` (L78-88) - Always return False (platform fallbacks)

### Permission Constants (L92-110)
Unix permission bit definitions:
- Special bits: `S_ISUID`, `S_ISGID`, `S_ISVTX` (set-user-ID, set-group-ID, sticky bit)
- Owner/group/other permission masks and individual bits
- Unix V7 compatibility aliases (`S_IREAD`, `S_IWRITE`, `S_IEXEC`)

### File Flags (L114-125)
BSD-style file flag constants for advanced file attributes (UF_* and SF_* prefixes)

### Mode Display Function (L156-166)
- `filemode(mode)` (L156-166) - Converts numeric mode to human-readable string (e.g., "-rwxrwxrwx")
- Uses `_filemode_table` (L128-154) - Lookup table for mode-to-character conversion

### Windows File Attributes (L172-188)
Windows-specific `FILE_ATTRIBUTE_*` constants for interpreting `st_file_attributes`

## Architecture and Dependencies

- **C Implementation Fallback** (L192-195): Attempts to import optimized C implementation from `_stat` module
- **Cross-platform Design**: Provides Unix semantics with Windows compatibility layer
- **Standalone Module**: No external dependencies beyond standard library

## Critical Patterns

1. **Bit Masking Pattern**: All file type and permission tests use bitwise operations
2. **Fallback Strategy**: Platform-specific constants default to safe values (0 or False)
3. **Table-Driven Display**: `filemode()` uses declarative table for efficient string generation
4. **Import Override**: C implementation can replace Python functions transparently