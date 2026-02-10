# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/posixpath.py
@source-hash: b75ea9ed24b7cef9
@generated: 2026-02-09T18:07:22Z

## Primary Purpose
Posix-specific path manipulation module that provides cross-platform pathname operations. This is Python's standard library implementation for Unix-like systems, aliased as `os.path` on Posix platforms. Handles both string and bytes path types throughout.

## Key Constants and Configuration (L16-23)
- Path separators: `sep = '/'`, `pathsep = ':'`, `altsep = None`
- Special directories: `curdir = '.'`, `pardir = '..'`, `devnull = '/dev/null'`
- File extension separator: `extsep = '.'`
- Default PATH: `defpath = '/bin:/usr/bin'`

## Core Path Utilities

### Path Analysis Functions
- `_get_sep(path)` (L41-45): Returns appropriate separator (`/` or `b'/'`) based on path type
- `normcase(s)` (L52-54): No-op on Posix, just converts to fspath
- `isabs(s)` (L60-64): Tests if path starts with separator
- `isjunction(path)` (L192-196): Always returns False (junctions don't exist on Posix)

### Path Decomposition
- `split(p)` (L100-109): Splits into (head, tail) at last separator
- `splitext(p)` (L117-126): Delegates to genericpath._splitext for extension splitting
- `splitdrive(p)` (L131-135): Returns empty drive, full path (drives don't exist on Posix)
- `splitroot(p)` (L138-164): Handles special case of double leading slashes per POSIX spec
- `basename(p)` (L169-174): Returns final path component
- `dirname(p)` (L179-187): Returns directory portion

### Path Construction
- `join(a, *p)` (L71-92): Joins path components, handling absolute path override behavior
- `abspath(path)` (L408-417): Converts to absolute path using getcwd() if needed
- `relpath(path, start=None)` (L497-530): Computes relative path between two locations

### Path Resolution
- `normpath(path)` (L377-405): Normalizes path by resolving `.` and `..` components, prefers C implementation from posix module
- `realpath(filename, *, strict=False)` (L423-428): Resolves symlinks recursively
- `_joinrealpath(path, rest, strict, seen)` (L432-492): Core symlink resolution with loop detection

### Path Expansion
- `expanduser(path)` (L256-310): Expands `~` and `~user` using HOME env var or pwd module
- `expandvars(path)` (L320-366): Expands `$var` and `${var}` using regex patterns, supports both string and bytes

### File System Queries
- `lexists(path)` (L201-207): Tests existence including broken symlinks using lstat
- `ismount(path)` (L213-244): Detects mount points by comparing device/inode with parent

### Path Comparison
- `commonpath(paths)` (L538-573): Finds longest common path prefix, validates mixed absolute/relative paths

## Dependencies
- `os`, `sys`, `stat` modules for system operations
- `genericpath` module for shared functionality (imported with `*`)
- Optional `pwd` module for user directory expansion
- Optional `re` module for variable expansion (lazy loaded)

## Architecture Notes
- Consistent handling of string vs bytes paths throughout using `os.fspath()`
- Type-aware separator selection via `_get_sep()`
- Error handling preserves original exceptions while adding context
- Symlink loop detection in realpath using seen dictionary
- Regex compilation cached in global variables for expandvars
- Platform-specific behavior: `supports_unicode_filenames = (sys.platform == 'darwin')`

## Critical Invariants
- All functions normalize inputs with `os.fspath()` 
- Maintains path type (string/bytes) consistency in returns
- Absolute paths in join() override all previous components
- Empty components and `.` are filtered in path operations
- Symlink resolution tracks visited paths to prevent infinite loops