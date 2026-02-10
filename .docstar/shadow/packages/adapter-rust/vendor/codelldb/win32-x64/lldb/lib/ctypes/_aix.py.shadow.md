# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/ctypes/_aix.py
@source-hash: 540e2821fa36981b
@generated: 2026-02-09T18:10:36Z

## Primary Purpose
AIX-specific implementation of `ctypes.util.find_library()` that handles AIX's unique dual library format system (XCOFF archives vs SVR4 shared objects). Provides runtime library location for Python's ctypes module on AIX systems.

## Architecture Overview
AIX supports two dlopen() styles:
- **SVR4 style**: Standard `.so` files in filesystem paths
- **AIX/XCOFF style**: Archive members in `.a` files using `base(member)` syntax

The module prioritizes AIX archive format, falling back to SVR4 `.so` files.

## Key Constants & Variables
- `AIX_ABI` (L57): Current architecture bit-size (32/64) derived from `sizeof(c_void_p) * 8`

## Core Functions

### Library Discovery Pipeline
- `find_library(name)` (L287-327): **Main entry point**. Searches for library in archive format first, then `.so` format
- `find_shared(paths, name)` (L262-285): Searches directory paths for archives containing suitable members
- `get_libpaths()` (L236-260): Builds library search paths from environment (`LD_LIBRARY_PATH`, `LIBPATH`) and executable headers

### Archive Analysis (using `/usr/bin/dump -H`)
- `get_ld_headers(file)` (L97-115): Parses loader section headers from executables/archives via subprocess
- `get_ld_header(p)` (L74-82): Extracts header lines starting with path patterns
- `get_ld_header_info(p)` (L84-95): Collects numeric-prefixed info lines following headers
- `get_shared(ld_headers)` (L117-131): Extracts shareable objects (lines containing `[member]` syntax)

### Member Selection Logic
- `get_member(name, members)` (L208-234): **Primary member selector** with priority: generic `libXXX.so` → versioned → legacy
- `get_one_match(expr, lines)` (L133-144): Returns single regex match from member list, strips brackets
- `get_version(name, members)` (L170-206): Finds highest-versioned member using GNU LIBTOOL conventions
- `get_legacy(members)` (L147-168): Handles AIX legacy naming (`shr.o`, `shr_64.o`, `shr4.o`)

### Utility Functions
- `_last_version(libnames, sep)` (L61-72): Sorts libraries by version numbers, returns highest

## Dependencies
- **External**: `/usr/bin/dump` system utility for archive inspection
- **Internal**: `subprocess.Popen` for system calls, `ctypes` for ABI detection, `re` for pattern matching

## Critical Patterns

### Search Priority (in get_member)
1. Exact match: `lib{name}.so` or `lib{name}64.so` (64-bit)
2. Versioned match: `lib{name}.so.X.Y.Z` patterns
3. Legacy AIX: `shr.o`, `shr_64.o`, `shr4.o` variants

### Path Resolution
- Skips `/lib` (symbolic link to `/usr/lib`)
- Combines environment paths with executable's embedded paths
- Uses ABI-specific filtering (`-X{AIX_ABI}` flag)

## Return Formats
- **Archive member**: `"libname.a(member.so)"` format for dlopen()
- **Shared object**: `"libname.so"` filename only
- **Not found**: `None`

## Notable Constraints
- AIX-specific: Only functional on AIX systems with `/usr/bin/dump`
- ABI-aware: Filters results by 32/64-bit compatibility
- Single match requirement: `get_one_match` returns None for ambiguous results