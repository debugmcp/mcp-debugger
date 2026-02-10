# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/posixpath.py
@source-hash: b75ea9ed24b7cef9
@generated: 2026-02-09T18:13:24Z

## Purpose
POSIX path manipulation module that provides cross-platform pathname operations following Unix/Linux conventions. This is Python's standard `posixpath` module, used as `os.path` on POSIX systems. Located within the LLDB debugger distribution for CodeLLDB adapter.

## Path Constants (L16-23)
Core path separators and defaults:
- `sep = '/'` - Path component separator
- `pathsep = ':'` - PATH environment variable separator  
- `curdir = '.'`, `pardir = '..'` - Current/parent directory markers
- `extsep = '.'` - File extension separator
- `devnull = '/dev/null'` - Null device path
- `altsep = None` - No alternative separator on POSIX

## Core Path Functions

### Path Analysis
- `isabs(s)` (L60-64): Tests if path is absolute (starts with '/')
- `normcase(s)` (L52-54): No-op on POSIX (case-sensitive filesystem)
- `_get_sep(path)` (L41-45): Returns appropriate separator for bytes/str

### Path Manipulation  
- `join(a, *p)` (L71-92): Joins path components with '/', handles absolute paths by discarding previous components
- `split(p)` (L100-109): Splits into (head, tail) at final separator
- `splitext(p)` (L117-126): Delegates to `genericpath._splitext` for extension splitting
- `splitdrive(p)` (L131-135): Returns empty drive (no drive concept on POSIX)
- `splitroot(p)` (L138-164): Handles special POSIX root cases (/, //, ///)

### Path Components
- `basename(p)` (L169-174): Returns final path component  
- `dirname(p)` (L179-187): Returns directory portion

### Path Resolution
- `abspath(path)` (L408-417): Converts to absolute path using current directory
- `realpath(filename, *, strict=False)` (L423-428): Resolves symlinks via `_joinrealpath`
- `_joinrealpath(path, rest, strict, seen)` (L432-492): Recursive symlink resolution with loop detection
- `normpath(path)` (L377-405): Normalizes paths (removes .., ., //) with fallback implementation

### Path Expansion
- `expanduser(path)` (L256-310): Expands ~ to home directory using pwd module or $HOME
- `expandvars(path)` (L320-366): Expands $var and ${var} using regex patterns (`_varprog`, `_varprogb`)

### Path Testing
- `lexists(path)` (L201-207): Tests existence including broken symlinks via `os.lstat`
- `ismount(path)` (L213-244): Detects mount points by comparing device IDs with parent
- `isjunction(path)` (L192-196): Always returns False (junctions don't exist on POSIX)

### Path Relationships  
- `relpath(path, start=None)` (L497-530): Computes relative path between two absolute paths
- `commonpath(paths)` (L538-573): Finds longest common path prefix, validates absolute/relative consistency

## Dependencies
- `os`, `sys`, `stat` - Core system modules
- `genericpath` - Shared path utilities (imported via `from genericpath import *`)
- `pwd` - User database access (imported conditionally in `expanduser`)
- `re` - Regex compilation for variable expansion (lazy import)

## Key Patterns
- Consistent `os.fspath()` normalization at function entry
- Bytes vs string path handling throughout
- Lazy regex compilation for variable expansion
- Exception handling with graceful fallbacks
- Symlink loop detection in `realpath` via `seen` dict

## Platform Support
- `supports_unicode_filenames = (sys.platform == 'darwin')` (L495)
- Special VxWorks handling in `expanduser` (L302)
- Attempts to import optimized `posix._path_normpath` before fallback (L373-376)