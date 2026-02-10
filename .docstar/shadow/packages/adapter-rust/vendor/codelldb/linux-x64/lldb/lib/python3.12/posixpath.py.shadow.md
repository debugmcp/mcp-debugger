# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/posixpath.py
@source-hash: b75ea9ed24b7cef9
@generated: 2026-02-09T18:09:55Z

**Primary Purpose:**
POSIX pathname manipulation module providing cross-platform filesystem path operations. Serves as the `os.path` implementation for POSIX-compliant systems (Unix/Linux/macOS), handling both string and bytes path representations.

**Key Constants (L16-23):**
- `sep = '/'` - Path separator for POSIX systems
- `pathsep = ':'` - PATH environment variable separator  
- `curdir = '.'`, `pardir = '..'` - Current/parent directory markers
- `devnull = '/dev/null'` - Null device path

**Core Path Analysis Functions:**
- `normcase(s)` (L52-54): No-op for POSIX (case-sensitive filesystem)
- `isabs(s)` (L60-64): Tests if path starts with '/' separator
- `split(p)` (L100-109): Splits into (head, tail) at final '/'
- `splitext(p)` (L117-126): Splits into (root, extension) at final '.'
- `splitdrive(p)` (L131-135): Always returns ('', path) on POSIX
- `splitroot(p)` (L138-164): Handles special case of double-slash '//' paths per POSIX spec
- `basename(p)` (L169-174): Returns final path component
- `dirname(p)` (L179-187): Returns directory portion

**Path Construction/Resolution:**
- `join(a, *p)` (L71-92): Joins path components with '/' separator, handling absolute path override
- `abspath(path)` (L408-417): Converts to absolute path using current working directory
- `normpath(path)` (L377-405): Normalizes by removing '.', '..', and redundant separators
- `realpath(filename, *, strict=False)` (L423-428): Resolves symbolic links to canonical path
- `_joinrealpath(path, rest, strict, seen)` (L432-492): Internal symlink resolution with loop detection

**Path Expansion:**
- `expanduser(path)` (L256-310): Expands '~' and '~user' using HOME env var or pwd module
- `expandvars(path)` (L320-366): Expands $var and ${var} shell variables using regex patterns

**File System Queries:**
- `lexists(path)` (L201-207): Tests existence including broken symlinks via lstat
- `ismount(path)` (L213-244): Detects mount points by comparing device/inode with parent
- `isjunction(path)` (L192-196): Always returns False (Windows-specific concept)

**Path Relationships:**
- `relpath(path, start=None)` (L497-530): Computes relative path between two locations
- `commonpath(paths)` (L538-573): Finds longest common path prefix, validates absolute/relative consistency

**Architecture Patterns:**
- Uses `os.fspath()` for PathLike protocol support throughout
- `_get_sep(path)` (L41-45): Returns appropriate separator for string vs bytes
- Dual string/bytes support with type-aware constants
- Error handling delegates to `genericpath._check_arg_types()` for consistent messaging
- Imports from `genericpath` module for shared functionality
- Optional C implementation fallback pattern for `normpath` (L373-376)

**Critical Invariants:**
- All functions handle both str and bytes path types consistently
- Symlink resolution prevents infinite loops via `seen` dict tracking
- Path separators adapted based on input type (str '/' vs bytes b'/')
- POSIX double-slash '//' handling follows standard specification