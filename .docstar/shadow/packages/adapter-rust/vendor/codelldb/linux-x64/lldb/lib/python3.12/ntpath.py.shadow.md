# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/ntpath.py
@source-hash: ffa7f85c0382a6e9
@generated: 2026-02-09T18:09:55Z

## Purpose
Windows path manipulation module providing pathname operations for Windows NT/95 systems. Part of Python's standard library, accessed via `os.path` on Windows platforms.

## Key Constants (L11-18)
- `sep = '\\'`: Primary path separator
- `altsep = '/'`: Alternative path separator  
- `pathsep = ';'`: Path list separator
- `curdir = '.'`, `pardir = '..'`: Current/parent directory markers
- `defpath = '.;C:\\bin'`: Default PATH value
- `devnull = 'nul'`: Null device path

## Core Path Functions

### Case & Format Normalization
- `normcase()` (L51-78): Converts paths to lowercase, forward slashes to backslashes. Uses Windows locale-aware case mapping if `_winapi` available, falls back to simple `.lower()`.
- `normpath()` (L527-561): Normalizes paths by removing redundant separators and resolving `.` and `..` components. Uses native `nt._path_normpath` if available.

### Path Analysis
- `isabs()` (L87-103): Tests if path is absolute. Handles UNC paths, drive letters, and root paths. Contains legacy bug note about `/x` paths.
- `splitdrive()` (L156-176): Splits path into drive/UNC portion and remainder
- `splitroot()` (L179-228): More detailed split into drive, root separator, and tail
- `split()` (L236-249): Splits into directory and basename components
- `basename()` (L268-270), `dirname()` (L275-277): Extract final component or directory portion

### Path Construction
- `join()` (L107-151): Joins path components, handling drive changes and absolute path overrides
- `abspath()` (L588-593): Returns absolute path using `nt._getfullpathname` or fallback implementation
- `relpath()` (L758-801): Computes relative path between two locations

### Advanced Path Operations
- `realpath()` (L692-752): Resolves symbolic links and junction points. Complex implementation handling Windows-specific reparse points and UNC paths.
- `expanduser()` (L350-395): Expands `~` to user home directory using `USERPROFILE`, `HOMEDRIVE`, `HOMEPATH`
- `expandvars()` (L411-517): Expands shell variables in `$var`, `${var}`, `%var%` formats

### File System Queries
- `lexists()` (L299-305): Tests path existence including broken symlinks
- `ismount()` (L321-338): Detects mount points, drive roots, UNC shares using `_getvolumepathname`
- `isjunction()` (L283-294): Tests for NTFS junction points using reparse tag inspection

### Utility Functions
- `commonpath()` (L814-860): Finds longest common path prefix, case-insensitive
- `_get_bothseps()` (L35-39): Returns both separator types for given path type
- `_readlink_deep()` (L601-641): Recursively follows symlinks with cycle detection

## Platform Integration
- Extensive use of `nt` module functions when available (`_getfullpathname`, `_getfinalpathname`, `_path_*` functions)
- Graceful fallback to generic implementations when native functions unavailable
- Handles both string and bytes path representations consistently

## Error Handling Patterns
- Uses `os.fspath()` for path normalization
- Comprehensive Windows error code handling in `realpath()` implementations
- Type checking via `genericpath._check_arg_types()`

## Notable Features
- Dev Drive detection via `isdevdrive()` (L879-889)
- Unicode filename support always enabled (L756)
- Complex reparse point and symlink resolution logic
- Case-insensitive path comparisons throughout