# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/posixpath.py
@source-hash: b75ea9ed24b7cef9
@generated: 2026-02-09T18:08:00Z

## POSIX Path Operations Module

Standard Python library module providing POSIX-compliant pathname manipulation functions. This is the Unix/Linux implementation of `os.path` operations, handling both string and bytes path types with forward slash separators.

### Key Constants (L13-23)
- Path separators and special values: `sep='/'`, `pathsep=':'`, `curdir='.'`, `pardir='..'`, `extsep='.'`
- Platform-specific: `altsep=None`, `devnull='/dev/null'`, `defpath='/bin:/usr/bin'`

### Core Path Analysis Functions

**`normcase(s)` (L52-54)**: No-op on POSIX systems - returns path unchanged after `os.fspath()` conversion.

**`isabs(s)` (L60-64)**: Tests if path is absolute by checking if it starts with separator (`/`).

**`splitdrive(p)` (L131-135)**: Returns empty drive and full path (drives don't exist on POSIX).

**`splitroot(p)` (L138-164)**: Splits into drive (always empty), root (`/` or `//`), and tail. Handles special POSIX case of double leading slashes.

### Path Construction Functions

**`join(a, *p)` (L71-92)**: Joins path components with `/`. Absolute components discard previous parts. Includes type compatibility check on line 81 and error handling for mixed types.

**`split(p)` (L100-109)**: Splits into (head, tail) at last `/`. Strips trailing slashes from head except for root.

**`splitext(p)` (L117-126)**: Delegates to `genericpath._splitext()` with POSIX-specific separators.

**`basename(p)` (L169-174)**: Returns final component after last `/`.

**`dirname(p)` (L179-187)**: Returns directory portion, same logic as `split()` head.

### Path Resolution Functions

**`normpath(path)` (L377-405)**: Normalizes paths by removing `.`, `..`, and duplicate slashes. Tries to import optimized C implementation first (L373-374).

**`abspath(path)` (L408-417)**: Returns absolute path by joining with current working directory if relative.

**`realpath(filename, *, strict=False)` (L423-428)**: Resolves symbolic links recursively using `_joinrealpath()` helper.

**`_joinrealpath(path, rest, strict, seen)` (L432-492)**: Internal recursive function for resolving symlinks with cycle detection via `seen` dict. Handles strict mode for error reporting.

### Path Testing Functions

**`lexists(path)` (L201-207)**: Tests existence including broken symlinks using `os.lstat()`.

**`ismount(path)` (L213-244)**: Detects mount points by comparing device IDs and inodes with parent directory.

**`isjunction(path)` (L192-196)**: Always returns `False` - junctions don't exist in POSIX.

### Path Expansion Functions

**`expanduser(path)` (L256-310)**: Expands `~` and `~user` using HOME environment variable or passwd database. Handles bytes/string types and missing users gracefully.

**`expandvars(path)` (L320-366)**: Expands `$var` and `${var}` using regex patterns. Caches compiled regexes in globals `_varprog`/`_varprogb` (L317-318).

### Utility Functions

**`relpath(path, start=None)` (L497-530)**: Computes relative path from start to path using `commonprefix()`.

**`commonpath(paths)` (L538-573)**: Finds longest common path prefix. Validates all paths are same type (absolute/relative).

**`_get_sep(path)` (L41-45)**: Returns appropriate separator for string or bytes paths.

### Dependencies
- Core: `os`, `sys`, `stat`, `genericpath` 
- Conditional: `pwd` (for user expansion), `re` (for variable expansion), `posix._path_normpath` (optimized normpath)

### Platform Support
- `supports_unicode_filenames = (sys.platform == 'darwin')` (L495)
- Special handling for VxWorks platform in `expanduser()` (L302)

Exports 39 functions via `__all__` (L31-38) for use as `os.path` module.