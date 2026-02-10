# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/stat.py
@source-hash: 052af0327eae6941
@generated: 2026-02-09T18:07:25Z

## Primary Purpose
Python standard library module providing constants and utility functions for interpreting file system metadata returned by `os.stat()` and `os.lstat()`. This is the pure Python fallback implementation that gets overridden by the C implementation `_stat` when available (L192-195).

## Core Components

### Stat Tuple Indices (L8-17)
Constants defining positions in the stat result tuple:
- `ST_MODE`, `ST_INO`, `ST_DEV`, `ST_NLINK`, `ST_UID`, `ST_GID`, `ST_SIZE`, `ST_ATIME`, `ST_MTIME`, `ST_CTIME`

### Mode Manipulation Functions (L21-31)
- `S_IMODE(mode)` (L21-25): Extracts permission bits (mask 0o7777)
- `S_IFMT(mode)` (L27-31): Extracts file type bits (mask 0o170000)

### File Type Constants (L36-46)
Unix file type bit patterns:
- `S_IFDIR` (0o040000), `S_IFCHR` (0o020000), `S_IFBLK` (0o060000), `S_IFREG` (0o100000)
- `S_IFIFO` (0o010000), `S_IFLNK` (0o120000), `S_IFSOCK` (0o140000)
- Platform-specific fallbacks: `S_IFDOOR`, `S_IFPORT`, `S_IFWHT` (all set to 0)

### File Type Test Functions (L50-88)
Boolean predicates for file types:
- `S_ISDIR`, `S_ISCHR`, `S_ISBLK`, `S_ISREG`, `S_ISFIFO`, `S_ISLNK`, `S_ISSOCK` (L50-76)
- `S_ISDOOR`, `S_ISPORT`, `S_ISWHT` (L78-88): Always return False (platform stubs)

### Permission Constants (L92-110)
Unix permission bits and masks:
- Special bits: `S_ISUID` (0o4000), `S_ISGID` (0o2000), `S_ISVTX` (0o1000)
- Owner/group/other permission masks and individual bits
- Legacy Unix V7 synonyms: `S_IREAD`, `S_IWRITE`, `S_IEXEC`

### File Flags Constants (L114-125)
BSD/macOS file attribute flags using hexadecimal notation:
- User flags: `UF_NODUMP`, `UF_IMMUTABLE`, `UF_APPEND`, `UF_OPAQUE`, `UF_NOUNLINK`, `UF_COMPRESSED`, `UF_HIDDEN`
- System flags: `SF_ARCHIVED`, `SF_IMMUTABLE`, `SF_APPEND`, `SF_NOUNLINK`, `SF_SNAPSHOT`

### File Mode String Conversion (L128-166)
- `_filemode_table` (L128-154): Lookup table for converting mode bits to ls-style strings
- `filemode(mode)` (L156-166): Converts numeric mode to string like "-rwxrwxrwx"

### Windows File Attributes (L172-188)
Constants for Windows `FILE_ATTRIBUTE_*` values used in `st_file_attributes` member.

## Key Patterns
- Mixed octal (0o) and hexadecimal (0x) notation for different constant categories
- Bitwise operations throughout for mode manipulation
- Fallback pattern: Pure Python implementation overridden by C module if available
- Cross-platform compatibility with platform-specific stubs

## Dependencies
- Attempts to import from `_stat` C extension module (L193)
- No other external dependencies

## Critical Notes
- Socket file type detection relies on `S_IFSOCK == S_IFREG | S_IFDIR` relationship (L130 comment)
- Platform-specific constants (doors, ports, whiteouts) are stubbed to 0/False
- Module designed for wildcard import (`from stat import *`)