# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/ntpath.py
@source-hash: ffa7f85c0382a6e9
@generated: 2026-02-09T18:12:58Z

## Purpose
Windows NT/95 pathname manipulation module providing cross-platform path operations with Windows-specific semantics. Part of Python's standard library os.path interface for Windows systems.

## Key Constants (L11-18)
Path separators and defaults:
- `sep = '\\'`, `altsep = '/'` - Primary and alternative path separators
- `pathsep = ';'` - Environment PATH separator  
- `curdir = '.'`, `pardir = '..'` - Current and parent directory markers
- `devnull = 'nul'` - Null device path

## Core Path Functions

### Case Normalization
- `normcase(s)` (L51-78) - Converts paths to lowercase with backslashes. Uses Windows API `LCMapStringEx` if available, falls back to basic string operations.

### Path Testing
- `isabs(s)` (L87-103) - Tests absolute paths (UNC, device, drive+root patterns)
- `ismount(path)` (L321-338) - Detects mount points using `_getvolumepathname` when available
- `isjunction(path)` (L283-294) - Tests for NTFS junctions via reparse tags

### Path Splitting/Joining
- `join(path, *paths)` (L107-150) - Intelligent path joining with drive/UNC handling
- `splitdrive(p)` (L156-176) - Separates drive/UNC from path portion
- `splitroot(p)` (L179-228) - Three-way split: drive, root, tail with UNC support
- `split(p)` (L236-249) - Splits into head/tail at final separator

### Path Resolution
- `abspath(path)` (L588-593) - Uses native `_getfullpathname` with fallback (L564-578)
- `realpath(path, strict=False)` (L692-752) - Resolves symlinks and final paths with extensive Windows error handling
- `normpath(path)` (L527-561) - Normalizes separators and removes redundant components

### User/Variable Expansion  
- `expanduser(path)` (L350-395) - Expands ~ using USERPROFILE/HOMEDRIVE+HOMEPATH
- `expandvars(path)` (L411-517) - Expands $var, ${var}, %var% with shell-like rules

### Utility Functions
- `relpath(path, start=None)` (L758-801) - Computes relative paths with drive validation
- `commonpath(paths)` (L814-860) - Finds longest common prefix, case-insensitive

## Dependencies
- Standard: `os`, `sys`, `stat`, `genericpath` 
- Windows-specific: `_winapi`, `nt` module functions for native implementations
- Graceful fallbacks when Windows APIs unavailable

## Architecture Patterns
- Dual string/bytes support throughout with type-specific separators
- Try/except blocks for Windows API availability with pure Python fallbacks  
- Heavy use of `os.fspath()` for path-like object normalization
- Case-insensitive comparisons via `normcase()` and `.casefold()`

## Critical Invariants
- Drive letters are case-insensitive but preserved from original input
- UNC paths require special handling in multiple functions
- Path separators normalized but alternative separators accepted as input
- Relative paths never cross drive boundaries