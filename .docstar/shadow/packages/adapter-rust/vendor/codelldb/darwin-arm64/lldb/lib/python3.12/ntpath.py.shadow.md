# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/ntpath.py
@source-hash: ffa7f85c0382a6e9
@generated: 2026-02-09T18:07:20Z

## Purpose
Windows NT path manipulation module providing POSIX-like path operations adapted for Windows filesystem conventions. Part of Python's standard library, typically accessed via `os.path` on Windows systems.

## Core Constants (L11-18)
Path separators and special paths for Windows:
- `sep = '\\'`, `altsep = '/'` - Primary and alternative path separators
- `pathsep = ';'` - Path list separator for Windows
- `curdir = '.'`, `pardir = '..'` - Current and parent directory indicators
- `devnull = 'nul'` - Windows null device

## Key Path Processing Functions

### Case and Path Normalization
- `normcase(s)` (L51-78) - Converts paths to lowercase and normalizes separators. Uses Windows locale-aware case conversion via `_LCMapStringEx` if available, falls back to simple `.lower()`.
- `normpath(path)` (L524-561) - Normalizes path by eliminating double slashes, resolving `.` and `..` components. Uses native `nt._path_normpath` if available.

### Path Analysis
- `isabs(s)` (L87-103) - Tests if path is absolute. Handles UNC paths, drive letters, and root-relative paths. Contains legacy bug note for `/x` paths.
- `splitdrive(p)` (L156-176) - Splits path into drive/UNC and remainder components
- `splitroot(p)` (L179-228) - More detailed path splitting into drive, root, and tail components. Handles UNC paths, device paths (`\\?\`), and drive letters.

### Path Construction and Decomposition  
- `join(path, *paths)` (L107-150) - Joins path components using Windows path logic. Handles drive changes, absolute path overrides, and UNC path construction.
- `split(p)` (L236-249) - Splits path into head/tail at final separator
- `basename(p)` (L268-270), `dirname(p)` (L275-277) - Extract final component and directory portion

### Path Resolution
- `abspath(path)` (L588-593) - Returns absolute path using native `nt._getfullpathname` if available, otherwise falls back to `_abspath_fallback` (L564-578)
- `realpath(path, *, strict=False)` (L692-752) - Resolves symbolic links and returns canonical path. Complex implementation handling Windows reparse points, UNC prefixes, and error recovery.

### Special Windows Features
- `isjunction(path)` (L283-294) - Tests for NTFS junctions using reparse tag detection
- `ismount(path)` (L321-338) - Detects mount points including drive roots, UNC shares, and mounted volumes using `nt._getvolumepathname`
- `isdevdrive(path)` (L879-889) - Determines if path is on Windows Dev Drive (newer Windows feature)

### Environment Variable Expansion
- `expanduser(path)` (L350-395) - Expands `~` and `~user` constructs using Windows environment variables (`USERPROFILE`, `HOMEDRIVE`, `HOMEPATH`)
- `expandvars(path)` (L411-517) - Expands shell variables in formats `$var`, `${var}`, and `%var%` with Windows-specific handling

### Utility Functions
- `relpath(path, start=None)` (L758-801) - Computes relative path between two locations with drive awareness
- `commonpath(paths)` (L814-860) - Finds longest common path prefix, case-insensitive with separator normalization
- `lexists(path)` (L299-305) - Tests path existence including broken symbolic links

## Import Strategy
Uses conditional imports to prefer native Windows implementations (`nt` module functions) over generic implementations when available (L867-873, L876-889).

## Dependencies
- `os`, `sys`, `stat` - Standard library modules
- `genericpath` - Cross-platform path utilities (imported with `*`)
- `nt` module functions - Native Windows path operations when available
- `_winapi` - Windows API functions for case normalization

## Architecture Notes
- Dual-mode support for bytes and string paths throughout
- Extensive error handling for Windows-specific edge cases
- Performance optimization through native function usage when available
- Legacy compatibility maintained (e.g., isabs bug note L100)