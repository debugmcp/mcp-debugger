# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/pathlib.py
@source-hash: bb172ea6ff01dfe5
@generated: 2026-02-09T18:07:30Z

## Purpose and Responsibility

Python's pathlib module providing object-oriented filesystem path manipulation. This is the complete standard library implementation, offering both pure path manipulation without I/O and concrete filesystem operations.

## Key Classes

### Pure Path Classes (No I/O Operations)
- **PurePath (L292-794)**: Abstract base class for path manipulation without filesystem access. Auto-selects platform-appropriate subclass in constructor.
  - Slots-based for memory efficiency with extensive caching (`_str`, `_hash`, `_parts_normcase_cached`, etc.)
  - Core methods: `__str__()`, `__truediv__()` (/ operator), `joinpath()`, `with_name()`, `with_suffix()`
  - Path parsing via `_parse_path()` (L388) and `_load_parts()` (L407)

- **PurePosixPath (L801-808)**: POSIX-specific pure path implementation
- **PureWindowsPath (L811-818)**: Windows-specific pure path implementation

### Concrete Path Classes (With I/O Operations)
- **Path (L824-1410)**: Main filesystem-accessing class, inherits from PurePath
  - File operations: `open()`, `read_text()`, `write_text()`, `read_bytes()`, `write_bytes()`
  - Directory operations: `mkdir()`, `rmdir()`, `iterdir()`, `glob()`, `rglob()`, `walk()`
  - File system queries: `exists()`, `is_file()`, `is_dir()`, `stat()`, `lstat()`
  - Path resolution: `absolute()`, `resolve()`, `expanduser()`

- **PosixPath (L1413-1424)**: Concrete POSIX path implementation  
- **WindowsPath (L1425-1435)**: Concrete Windows path implementation

## Supporting Classes

### Globbing Infrastructure
- **_Selector (L151-172)**: Base class for glob pattern matching
- **_WildcardSelector (L191-221)**: Handles `*` and `?` patterns using compiled regex
- **_RecursiveWildcardSelector (L223-239)**: Handles `**` recursive patterns
- **_DoubleRecursiveWildcardSelector (L241-257)**: De-duplicates results from multiple `**` patterns
- **_TerminatingSelector (L174-178)**: Terminal selector for glob matching
- **_ParentSelector (L180-189)**: Handles `..` parent directory patterns

### Utility Classes
- **_PathParents (L263-290)**: Sequence-like access to logical path ancestors

## Key Functions

### Path Parsing and Construction
- `_parse_path()` (L388-405): Parses path strings into drive, root, and tail components
- `_from_parsed_parts()` (L420-427): Constructs path from parsed components
- `_format_parsed_parts()` (L429-435): Formats parsed parts back to string

### Globbing Support
- `_make_selector()` (L82-103): Factory for creating appropriate selector instances
- `_compile_pattern()` (L106-109): Compiles single glob patterns to regex
- `_compile_pattern_lines()` (L112-148): Compiles multi-line patterns with newline/separator swapping

### Utility Functions
- `_ignore_error()` (L52-54): Determines if filesystem errors should be ignored
- `_is_case_sensitive()` (L57-59): Cached case sensitivity detection per filesystem flavor

## Important Constants and Configuration

### Windows-Specific
- `_WIN_RESERVED_NAMES` (L34-38): Windows reserved filenames (CON, PRN, COM1-9, etc.)
- `_WINERROR_*` constants (L40-42): Windows-specific error codes

### Error Handling
- `_IGNORED_ERRNOS` (L45): POSIX error codes to ignore (ENOENT, ENOTDIR, EBADF, ELOOP)
- `_IGNORED_WINERRORS` (L47-50): Windows error codes to ignore

### Pattern Matching
- `_FNMATCH_SLICE` (L74): Slice object to strip fnmatch prefix/suffix
- `_SWAP_SEP_AND_NEWLINE` (L75-78): Translation tables for glob pattern processing

## Architectural Decisions

### Lazy Loading and Caching
Path components (_drv, _root, _tail) are parsed on first access and cached. String representations and case-normalized versions are cached for performance.

### Platform Abstraction
Uses `_flavour` attribute (os.path, ntpath, or posixpath) to delegate platform-specific operations while maintaining unified API.

### Globbing Implementation
Novel approach swapping path separators with newlines to prevent `*` from matching across path boundaries, enabling efficient regex-based glob matching.

### Slots-Based Memory Optimization
Extensive use of `__slots__` reduces memory overhead, critical for path-heavy applications.

## Critical Invariants

1. Path objects are immutable - all modification methods return new instances
2. Platform-specific classes cannot be instantiated on wrong platforms (enforced in `__new__`)
3. Glob patterns cannot contain absolute paths (raises NotImplementedError)
4. Empty patterns in glob/match operations raise ValueError
5. Case sensitivity determined by filesystem flavor, cached per flavor type