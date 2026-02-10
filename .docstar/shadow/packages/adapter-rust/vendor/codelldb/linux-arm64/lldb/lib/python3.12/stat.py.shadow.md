# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/stat.py
@source-hash: 052af0327eae6941
@generated: 2026-02-09T18:09:09Z

## Python stat module constants and utilities

Core purpose: Provides constants and utility functions for interpreting file status information returned by `os.stat()` and `os.lstat()`. This is a standard Python library module vendored for LLDB's Python environment.

### Key Constants

**Stat tuple indices (L8-17):** Constants for accessing fields in stat tuples returned by os.stat():
- `ST_MODE`, `ST_INO`, `ST_DEV`, `ST_NLINK`, `ST_UID`, `ST_GID`, `ST_SIZE`, `ST_ATIME`, `ST_MTIME`, `ST_CTIME`

**File type constants (L36-46):** Octal masks for identifying file types:
- `S_IFDIR` (0o040000), `S_IFREG` (0o100000), `S_IFLNK` (0o120000), etc.
- Platform-specific fallbacks set to 0: `S_IFDOOR`, `S_IFPORT`, `S_IFWHT`

**Permission constants (L92-110):** Unix permission bits in octal:
- Special bits: `S_ISUID`, `S_ISGID`, `S_ISVTX`
- Owner/group/other read/write/execute permissions
- Legacy Unix V7 synonyms: `S_IREAD`, `S_IWRITE`, `S_IEXEC`

**File flags (L114-125):** BSD-style file flags for extended attributes (UF_*/SF_* prefixes)

**Windows attributes (L172-188):** `FILE_ATTRIBUTE_*` constants for Windows file attributes

### Key Functions

**Mode extraction (L21-31):**
- `S_IMODE(mode)`: Returns permission bits (mode & 0o7777)
- `S_IFMT(mode)`: Returns file type bits (mode & 0o170000)

**File type testers (L50-88):** Boolean functions testing file types:
- `S_ISDIR()`, `S_ISREG()`, `S_ISLNK()`, `S_ISSOCK()`, etc.
- Platform-specific testers (`S_ISDOOR`, `S_ISPORT`, `S_ISWHT`) always return False

**Mode formatting (L156-166):**
- `filemode(mode)`: Converts mode to ls-style string (e.g., "-rwxrwxrwx")
- Uses lookup table `_filemode_table` (L128-154) for efficient conversion

### Architecture Notes

- Pure Python implementation with optional C fallback (L192-195)
- Designed for cross-platform compatibility with platform-specific constants
- Follows Unix stat conventions with Windows extensions
- Module suggests wildcard import pattern (`from stat import *`)

### Dependencies

- Attempts to import faster C implementation from `_stat` module if available
- No other external dependencies

### Critical Invariants

- File type constants are mutually exclusive bit patterns
- Permission constants follow standard Unix octal conventions
- Mode extraction functions use proper bit masking
- File type detection relies on exact bit pattern matching