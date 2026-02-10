# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/pathlib.py
@source-hash: bb172ea6ff01dfe5
@generated: 2026-02-09T18:08:30Z

Python's object-oriented filesystem path library providing cross-platform path manipulation and I/O operations. This is a vendored copy from Python 3.12 stdlib within the CodeLLDB debugger distribution.

## Core Architecture

**Path Hierarchy**: Two-tier design separating pure path manipulation from filesystem I/O:
- `PurePath` (L292-794): Abstract base for platform-agnostic path operations without filesystem access
- `Path` (L824-1411): Concrete implementation with filesystem I/O capabilities

**Platform Specialization**:
- `PurePosixPath` (L801-809): Unix-style path handling with `/` separators
- `PureWindowsPath` (L811-819): Windows-style path handling with `\` separators and drive letters
- `PosixPath` (L1413-1424): POSIX filesystem operations
- `WindowsPath` (L1425-1435): Windows filesystem operations

## Key Components

**Path Parsing & Storage** (L302-340):
- `_raw_paths`: Original unnormalized path strings
- `_drv`, `_root`, `_tail_cached`: Parsed components (drive, root, path segments)
- Lazy evaluation with caching for performance optimization

**Globbing System** (L65-257):
- `_make_selector()` (L82-103): Factory for pattern matching selectors
- `_WildcardSelector` (L191-221): Basic glob pattern matching
- `_RecursiveWildcardSelector` (L223-238): `**` recursive matching
- `_DoubleRecursiveWildcardSelector` (L241-256): De-duplicated multi-`**` patterns

**Pattern Compilation** (L106-148):
- `_compile_pattern()` (L106-109): Single component pattern compilation
- `_compile_pattern_lines()` (L112-148): Multi-component pattern with newline separator swapping

## Core Methods

**Path Construction**:
- `__init__()` (L358-378): Accepts strings, PathLike objects, handles separator conversion
- `with_segments()` (L380-385): Factory method for creating new path instances
- `_parse_path()` (L387-405): Platform-specific path parsing using `os.path.splitroot()`

**Path Properties**:
- `parts` (L703-709): Tuple of path components including drive/root
- `name`, `stem`, `suffix`, `suffixes` (L584-616): Filename component access
- `parent`, `parents` (L732-746): Hierarchical navigation using `_PathParents` sequence

**Path Operations**:
- `joinpath()` / `__truediv__()` (L711-729): Path concatenation with `/` operator
- `relative_to()` (L663-688): Compute relative paths with optional `walk_up`
- `match()` (L779-793): Glob pattern matching using compiled regex

**I/O Operations** (Path class):
- File content: `read_text()`, `write_text()`, `read_bytes()`, `write_bytes()` (L1015-1048)
- Directory traversal: `iterdir()`, `glob()`, `rglob()`, `walk()` (L1050-1155)
- File system queries: `exists()`, `is_file()`, `is_dir()`, `stat()` (L835-992)
- File operations: `touch()`, `mkdir()`, `unlink()`, `chmod()` (L1284-1351)

## Platform Handling

**Case Sensitivity**: `_is_case_sensitive()` (L57-59) with caching determines filesystem case handling

**Error Handling**: `_ignore_error()` (L52-54) standardizes cross-platform error suppression using:
- Unix: ENOENT, ENOTDIR, EBADF, ELOOP
- Windows: _WINERROR_* constants (L40-50)

**Reserved Names**: Windows reserved filename detection (L34-38, L763-777)

## Performance Optimizations

- Extensive use of `@functools.cache` and `@functools.lru_cache` decorators
- Lazy property evaluation with `_cached` suffixes
- String interning in path parsing (L404)
- Optimized absolute path detection for POSIX (L754-761)

## Integration Points

- `os.PathLike` registration (L798) for stdlib compatibility  
- Context manager support with deprecation warnings (L1169-1184)
- `os.fspath()` protocol support (L447-448)
- Platform-specific method delegation to `_flavour` (ntpath/posixpath)

The module provides comprehensive cross-platform filesystem abstraction with efficient caching, robust error handling, and extensive glob pattern support.