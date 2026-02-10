# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/pathlib.py
@source-hash: bb172ea6ff01dfe5
@generated: 2026-02-09T18:09:06Z

## Core Purpose
Object-oriented filesystem path manipulation library providing abstract and concrete path classes with cross-platform semantics. Implements PEP 428 for modern filesystem path operations.

## Architecture Overview
Two-tier hierarchy: **Pure paths** (no I/O) and **Concrete paths** (filesystem access).

**Pure Path Classes:**
- `PurePath` (L292-794): Abstract base for path manipulation without filesystem I/O
- `PurePosixPath` (L801-808): POSIX-specific pure path implementation  
- `PureWindowsPath` (L811-818): Windows-specific pure path implementation

**Concrete Path Classes:**
- `Path` (L824-1411): Base class adding filesystem operations to PurePath
- `PosixPath` (L1413-1423): POSIX concrete path (inherits Path + PurePosixPath)
- `WindowsPath` (L1425-1435): Windows concrete path (inherits Path + PureWindowsPath)

## Key Components

**Path Parsing & Storage:**
- `_parse_path()` (L388-405): Splits paths into drive/root/tail components
- `_load_parts()` (L407-418): Lazy parsing of raw path strings
- Cached components: `_drv`, `_root`, `_tail_cached` for performance

**Globbing System:**
- `_make_selector()` (L82-103): Factory for pattern matching selectors
- `_WildcardSelector` (L191-221): Handles standard glob patterns
- `_RecursiveWildcardSelector` (L223-238): Handles `**` recursive patterns  
- `_DoubleRecursiveWildcardSelector` (L241-256): Handles multiple `**` with deduplication

**Pattern Matching:**
- `_compile_pattern_lines()` (L112-148): Compiles glob patterns to regex
- Uses newline/separator swapping technique for path-aware matching

## Critical Methods

**Path Construction:**
- `__new__()` (L343-351, L1164-1167): Auto-selects platform-specific subclass
- `with_segments()` (L380-385): Creates new path from segments
- `_from_parsed_parts()` (L420-427): Constructs from parsed components

**Path Properties:**
- `parts` (L703-709): Sequence access to path components
- `drive`/`root`/`anchor` (L552-581): Path component accessors
- `name`/`suffix`/`stem` (L584-626): Filename manipulation

**Filesystem Operations (Path class):**
- `stat()`/`lstat()` (L835-847): File status information
- `exists()`/`is_dir()`/`is_file()` (L852-901): Path type checking
- `glob()`/`rglob()` (L1081-1110): Pattern-based file discovery
- `walk()` (L1112-1155): Directory tree traversal
- File I/O: `read_text()`/`write_text()` (L1022-1048)

## Platform Abstraction
Uses `_flavour` attribute (ntpath/posixpath) for OS-specific operations:
- Path separators and normalization
- Case sensitivity handling via `_is_case_sensitive()` (L57-59)
- Reserved name checking for Windows (L34-38, L763-777)

## Error Handling
- `_ignore_error()` (L52-54): Handles common filesystem errors
- `_IGNORED_ERRNOS`/`_IGNORED_WINERRORS` (L44-50): Platform-specific error codes
- Graceful degradation for broken symlinks and permission issues

## Performance Optimizations
- Extensive use of `@functools.cache` and `@functools.lru_cache`
- Lazy property evaluation with cached results
- String interning for path components
- `__slots__` for memory efficiency

## Notable Patterns
- Template method pattern in selector hierarchy
- Lazy evaluation for expensive operations
- Defensive programming with comprehensive error handling
- Cross-platform compatibility through flavour abstraction