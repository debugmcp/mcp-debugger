# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/pathlib.py
@source-hash: bb172ea6ff01dfe5
@generated: 2026-02-09T18:13:07Z

## Purpose
Object-oriented filesystem path library providing cross-platform path manipulation and filesystem operations. Core module of Python's pathlib, supporting both pure path operations (no I/O) and concrete filesystem interactions.

## Key Classes

### Pure Path Classes (Path Manipulation Only)
- **PurePath (L292-794)**: Abstract base class for OS-agnostic path manipulation without filesystem I/O
  - Handles path parsing, normalization, and string operations
  - Uses lazy loading for path components via `_load_parts()` (L407-418)
  - Key properties: `parts`, `name`, `suffix`, `stem`, `parent`, `parents`
  - Pattern matching via `match()` (L779-793)

- **PurePosixPath (L801-808)**: POSIX-specific pure path implementation
- **PureWindowsPath (L811-818)**: Windows-specific pure path implementation

### Concrete Path Classes (With Filesystem I/O)
- **Path (L824-1410)**: Base class for filesystem operations, extends PurePath
  - File operations: `open()`, `read_text()`, `write_text()`, `read_bytes()`, `write_bytes()`
  - Directory operations: `iterdir()`, `mkdir()`, `rmdir()`, `glob()`, `rglob()`, `walk()`
  - File system queries: `exists()`, `is_file()`, `is_dir()`, `stat()`, `lstat()`
  - Path resolution: `resolve()`, `absolute()`, `expanduser()`

- **PosixPath (L1413-1423)**: POSIX-specific concrete path
- **WindowsPath (L1425-1435)**: Windows-specific concrete path

## Globbing System
Complex pattern matching infrastructure:
- **_Selector (L151-171)**: Base selector for glob pattern matching
- **_WildcardSelector (L191-220)**: Handles `*` and `?` patterns
- **_RecursiveWildcardSelector (L223-238)**: Handles `**` recursive patterns  
- **_DoubleRecursiveWildcardSelector (L241-256)**: Deduplicates multiple `**` patterns
- **_make_selector() (L82-103)**: Factory for creating appropriate selector types

## Architecture Patterns

### Lazy Property Loading
Path components (`drive`, `root`, `_tail`) are parsed and cached on first access using `_load_parts()` and stored in slots for memory efficiency.

### Flavour System
OS-specific behavior controlled via `_flavour` attribute pointing to either `posixpath` or `ntpath` modules, enabling cross-platform compatibility.

### Caching Strategy
Extensive caching of computed values (`_str_normcase_cached`, `_parts_normcase_cached`, `_lines_cached`) for performance optimization.

## Critical Constants
- **_WIN_RESERVED_NAMES (L34-38)**: Windows reserved filenames (CON, PRN, AUX, etc.)
- **_IGNORED_ERRNOS (L45)**: Error codes to suppress during filesystem operations
- **_FNMATCH_SLICE (L74)**: Slice for extracting glob patterns from fnmatch translations

## Key Utilities
- **_ignore_error() (L52-54)**: Determines if filesystem errors should be ignored
- **_is_case_sensitive() (L58-59)**: Cached case sensitivity detection
- **_compile_pattern() (L107-109)**: Compiles glob patterns to regex
- **_PathParents (L263-289)**: Sequence-like access to logical parent paths

## Dependencies
Core dependencies: `os`, `ntpath`, `posixpath`, `fnmatch`, `re`, `stat`, `urllib.parse`
Uses `os.PathLike` protocol registration (L798) for integration with standard library.