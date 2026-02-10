# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/pathlib.py
@source-hash: bb172ea6ff01dfe5
@generated: 2026-02-09T18:10:07Z

## Object-oriented Filesystem Paths

Core Python `pathlib` module providing cross-platform path manipulation classes. Located in `packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/pathlib.py`.

### Primary Classes

**Pure Path Classes (No I/O Operations):**
- `PurePath` (L292-794): Base abstract path class with path manipulation operations, string representation, and comparison methods
- `PurePosixPath` (L801-808): POSIX-specific pure path implementation
- `PureWindowsPath` (L811-818): Windows-specific pure path implementation

**Filesystem Path Classes (With I/O Operations):**
- `Path` (L824-1411): Concrete path class that extends PurePath with filesystem operations
- `PosixPath` (L1413-1423): POSIX-specific concrete path implementation  
- `WindowsPath` (L1425-1435): Windows-specific concrete path implementation

### Key Architecture Patterns

**Path Parsing & Storage:**
- `_parse_path()` (L388-405): Parses path strings into drive, root, and tail components
- `_load_parts()` (L407-418): Lazy loading of parsed path components
- Uses `__slots__` for memory efficiency with cached properties (`_str`, `_drv`, `_root`, `_tail_cached`)

**Pattern Matching & Globbing:**
- `_make_selector()` (L82-103): Factory for creating glob pattern selectors
- `_WildcardSelector` (L191-221): Handles basic wildcard pattern matching
- `_RecursiveWildcardSelector` (L223-238): Handles `**` recursive patterns
- `_DoubleRecursiveWildcardSelector` (L241-256): Handles multiple `**` patterns with deduplication

**Cross-Platform Flavors:**
- `_flavour` attribute determines OS-specific behavior (posixpath vs ntpath)
- `_is_case_sensitive()` (L58-59): Cached case sensitivity detection
- Automatic platform detection in `__new__()` methods

### Critical Methods & Properties

**Path Construction:**
- `__init__()` (L358-378): Accepts multiple path arguments, handles PurePath and string inputs
- `with_segments()` (L380-385): Creates new path instances (customizable in subclasses)
- `_from_parsed_parts()` (L420-427): Internal constructor from parsed components

**Path Properties:**
- `parts` (L703-709), `name` (L584-589), `suffix` (L592-603), `stem` (L619-626)
- `parent` (L732-739), `parents` (L742-746): Parent directory access via `_PathParents` sequence

**Path Operations:**
- `joinpath()` (L711-717) and `__truediv__()` (L719-723): Path joining via `/` operator
- `relative_to()` (L663-688): Compute relative paths with optional `walk_up` parameter
- `match()` (L779-793): Pattern matching against glob patterns

**File I/O (Path class only):**
- `open()` (L1005-1013): File opening with encoding detection
- `read_text()`/`write_text()` (L1022-1048): Text file operations
- `read_bytes()`/`write_bytes()` (L1015-1037): Binary file operations
- `iterdir()` (L1050-1057), `glob()` (L1081-1095), `rglob()` (L1097-1110): Directory traversal

**File System Queries:**
- `exists()` (L852-868), `is_dir()` (L870-884), `is_file()` (L886-901): Path existence checks
- `stat()`/`lstat()` (L835-847): File metadata access
- Multiple `is_*()` methods for file type detection (L903-992)

**File System Operations:**
- `mkdir()` (L1306-1321): Directory creation with parents support
- `touch()` (L1284-1304): File creation/timestamp update
- `unlink()`/`rmdir()` (L1336-1351): File/directory removal
- `rename()`/`replace()` (L1353-1377): File moving operations

### Platform-Specific Features

**Windows Support:**
- `_WIN_RESERVED_NAMES` (L34-38): Windows reserved filename detection
- `is_reserved()` (L763-777): Checks for Windows reserved names
- Windows error code handling (L40-50)

**Cross-Platform Compatibility:**
- Automatic separator conversion between Windows/POSIX in `__init__()` (L362-366)
- `as_posix()` (L450-454): Force forward slash representation
- `as_uri()` (L464-482): File URI generation with platform-specific handling

### Error Handling

**Ignored Errors:**
- `_ignore_error()` (L52-54): Filters common filesystem errors (ENOENT, ENOTDIR, etc.)
- Used throughout I/O operations to handle missing files gracefully

### Performance Optimizations

- Extensive use of `@functools.cache` and `@functools.lru_cache` decorators
- Lazy property loading for parsed path components
- String interning in path parsing (L404)
- Memory-efficient `__slots__` usage