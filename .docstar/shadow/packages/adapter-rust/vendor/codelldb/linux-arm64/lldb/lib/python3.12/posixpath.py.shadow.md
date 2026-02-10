# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/posixpath.py
@source-hash: b75ea9ed24b7cef9
@generated: 2026-02-09T18:09:22Z

## Python POSIX Path Operations Module

**Primary Purpose:** Provides cross-platform pathname operations for POSIX systems, serving as the `os.path` implementation on Unix-like platforms. Handles both string and bytes path types with proper encoding considerations.

### Core Path Constants (L16-23)
- `sep = '/'` - Path separator
- `pathsep = ':'` - PATH environment variable separator  
- `curdir = '.'`, `pardir = '..'` - Current/parent directory markers
- `extsep = '.'` - Extension separator
- `devnull = '/dev/null'` - Null device path

### Key Functions

**Path Analysis:**
- `isabs(s)` (L60-64): Tests if path is absolute (starts with '/')
- `normcase(s)` (L52-54): No-op on POSIX (case-sensitive filesystem)
- `_get_sep(path)` (L41-45): Returns appropriate separator for string/bytes paths

**Path Manipulation:**
- `join(a, *p)` (L71-92): Joins path components with '/', absolute paths discard previous parts
- `split(p)` (L100-109): Splits into (head, tail) at last separator
- `splitext(p)` (L117-126): Delegates to `genericpath._splitext()` for extension splitting
- `splitdrive(p)` (L131-135): Returns empty drive + full path (no drives on POSIX)
- `splitroot(p)` (L138-164): Handles special POSIX root cases (/, //, ///)

**Path Components:**
- `basename(p)` (L169-174): Returns filename portion after last separator
- `dirname(p)` (L179-187): Returns directory portion before last separator

**Path Resolution:**
- `normpath(path)` (L377-405): Eliminates '.', '..', and redundant separators
- `abspath(path)` (L408-417): Returns absolute path by joining with cwd if relative
- `realpath(filename)` (L423-428): Resolves symbolic links via `_joinrealpath()`
- `_joinrealpath(path, rest, strict, seen)` (L432-492): Core symlink resolution with loop detection

**Path Expansion:**
- `expanduser(path)` (L256-310): Expands '~' and '~user' using pwd module or $HOME
- `expandvars(path)` (L320-366): Expands $var and ${var} using regex matching

**Path Testing:**
- `lexists(path)` (L201-207): Tests existence including broken symlinks via lstat
- `ismount(path)` (L213-244): Detects mount points by comparing device/inode with parent
- `isjunction(path)` (L192-196): Always returns False (no junctions on POSIX)

**Path Relationships:**
- `relpath(path, start)` (L497-530): Computes relative path using commonprefix
- `commonpath(paths)` (L538-573): Finds longest common path prefix, validates mixed absolute/relative

### Dependencies
- `os`, `sys`, `stat` - Core system modules
- `genericpath` - Cross-platform path utilities (imported via `from genericpath import *`)
- `pwd` - User database access (imported conditionally in expanduser)
- `re` - Regex for variable expansion (imported conditionally in expandvars)

### Architecture Notes
- **Dual Type Support:** All functions handle both str and bytes paths using `os.fspath()` normalization
- **Error Handling:** Graceful fallbacks for missing modules (pwd) and invalid operations
- **Optimization:** Conditional imports and cached regex compilation for expandvars
- **POSIX Compliance:** Handles special '//' root case per POSIX specification (L162-164)

### Module-Level Variables
- `_varprog`, `_varprogb` (L317-318): Lazily compiled regex patterns for variable expansion
- `supports_unicode_filenames` (L495): Platform detection for Unicode support