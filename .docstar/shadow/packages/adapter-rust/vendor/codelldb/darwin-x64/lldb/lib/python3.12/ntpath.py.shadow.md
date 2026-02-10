# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/ntpath.py
@source-hash: ffa7f85c0382a6e9
@generated: 2026-02-09T18:08:01Z

**Primary Purpose**: Windows NT/95 pathname manipulation module providing path operations specific to Windows filesystems. Part of Python's os.path interface for Windows platforms.

## Core Constants (L11-18)
Path separators and system-specific constants:
- `sep = '\\'`, `altsep = '/'` - Primary and alternative path separators
- `pathsep = ';'` - PATH environment variable separator
- `curdir = '.'`, `pardir = '..'` - Current and parent directory markers
- `devnull = 'nul'` - Null device path

## Key Path Analysis Functions

**splitroot()** (L179-228): Core path decomposition into (drive, root, tail) components. Handles:
- UNC paths (`\\server\share`)
- Drive letters (`C:`)
- Device paths (`\\.\device`, `\\?\UNC\server\share`)
- Relative paths

**splitdrive()** (L156-176): Wrapper around splitroot() returning (drive, path) tuple for backward compatibility.

**isabs()** (L87-103): Tests path absoluteness considering Windows-specific cases:
- UNC paths starting with `\\`
- Drive-relative paths with colon separator
- Contains legacy bug comment (L100) about `/x` paths

## Path Construction & Normalization

**join()** (L107-150): Intelligent path joining handling drive changes, absolute path overrides, and UNC path construction. Uses splitroot() for robust component analysis.

**normcase()** (L51-78): Case normalization with two implementations:
- Preferred: Uses Windows API `LCMapStringEx` (L51-68)
- Fallback: Simple string operations (L70-78)

**normpath()** (L527-561): Path normalization removing redundant separators and resolving `.`/`..` components. Attempts native `nt._path_normpath` first, falls back to Python implementation.

## Advanced Path Resolution

**realpath()** (L692-752): Resolves symbolic links and returns canonical absolute path. Includes:
- `_readlink_deep()` (L601-641): Recursive link resolution with cycle detection
- `_getfinalpathname_nonstrict()` (L643-690): Partial path resolution when full resolution fails
- Special handling for `nul` device (L700, L708)

**abspath()** (L588-593): Absolute path conversion using native `nt._getfullpathname` with fallback to `_abspath_fallback()` (L564-578).

## User/Environment Expansion

**expanduser()** (L350-395): Expands `~` and `~user` constructs using:
- `USERPROFILE` environment variable (preferred)
- `HOMEDRIVE` + `HOMEPATH` combination
- User directory guessing for `~user` syntax

**expandvars()** (L411-517): Complex variable expansion supporting:
- `$var`, `${var}` Unix-style variables
- `%var%` Windows-style variables  
- Escape sequences (`$$`, `%%`)
- Quote handling for literal strings

## Utility Functions

**split()** (L236-249): Splits into (head, tail) using splitroot() and separator detection.

**basename()** (L268-270), **dirname()** (L275-277): Extract filename and directory components.

**relpath()** (L758-801): Computes relative path between two locations with drive matching validation.

**commonpath()** (L814-860): Finds longest common path prefix with case-insensitive comparison.

## File System Queries

**ismount()** (L321-338): Mount point detection using `nt._getvolumepathname` when available.

**isjunction()** (L283-294): Junction point detection using `st_reparse_tag` attribute when supported.

**lexists()** (L299-305): Path existence check using `os.lstat()` (works for broken symlinks).

**isdevdrive()** (L879-889): Windows Dev Drive detection using native `nt._path_isdevdrive`.

## Dependencies
- **os, sys, stat**: Standard library modules
- **genericpath**: Cross-platform path operations (imported with `from genericpath import *`)
- **nt module**: Windows-specific native implementations (optional imports with fallbacks)
- **_winapi**: Windows API bindings for case normalization

## Architecture Notes
- Dual-mode design: bytes vs string path handling throughout
- Graceful degradation: Native Windows functions with Python fallbacks
- Error handling: Comprehensive exception catching with type validation via `genericpath._check_arg_types()`