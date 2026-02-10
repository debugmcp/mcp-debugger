# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/filecmp.py
@source-hash: 803d8494d5ae72f9
@generated: 2026-02-09T18:08:22Z

## filecmp - File and Directory Comparison Utilities

**Primary Purpose**: Standard library module providing efficient file and directory comparison utilities with caching support for performance optimization.

### Core Functions

- **`cmp(f1, f2, shallow=True)` (L30-68)**: Primary file comparison function with intelligent caching. Supports shallow comparison (stat-based) or deep comparison (content-based). Uses `_cache` dict for memoization with size limit of 100 entries.

- **`cmpfiles(a, b, common, shallow=True)` (L260-278)**: Batch comparison of common files between two directories. Returns tuple of (equal_files, different_files, funny_files).

- **`clear_cache()` (L26-28)**: Clears global comparison cache `_cache`.

### Key Classes

- **`dircmp` (L88-256)**: Sophisticated directory comparison class with lazy evaluation pattern. Uses `methodmap` (L245-249) and `__getattr__` (L251-255) for on-demand computation of comparison phases:
  - `phase0()` (L136): Lists directory contents with filtering
  - `phase1()` (L144): Computes common/unique filenames
  - `phase2()` (L151): Categorizes items as files/directories/funny
  - `phase3()` (L188): Compares file contents
  - `phase4()` (L192): Recursively creates subdirectory comparisons
  - Supports recursive reporting via `report_full_closure()` (L239)

### Internal Utilities

- **`_sig(st)` (L70-73)**: Creates file signature tuple (type, size, mtime) for comparison caching
- **`_do_cmp(f1, f2)` (L75-84)**: Performs actual byte-by-byte file comparison using BUFSIZE chunks (8KB)
- **`_cmp(a, b, sh)` (L287-291)**: Wrapper returning comparison result codes (0=equal, 1=different, 2=error)
- **`_filter(flist, skip)` (L296-297)**: Filters file lists against ignore/hide patterns

### Key Constants & Configuration

- **`DEFAULT_IGNORES` (L23-24)**: Standard VCS and cache directories to ignore
- **`BUFSIZE = 8*1024` (L21)**: Buffer size for file reading operations
- **`_cache` (L20)**: Global comparison cache dictionary

### Architectural Patterns

- **Lazy Evaluation**: `dircmp` uses `methodmap` to compute attributes only when accessed
- **Caching Strategy**: LRU-style cache with size limit and stat-based invalidation
- **Recursive Design**: Supports deep directory tree comparison via self-referential subdirectory creation
- **Error Handling**: Graceful handling of OSError/ValueError in file operations (L163-172)

### Dependencies

- Standard library: `os`, `stat`, `itertools.filterfalse`, `types.GenericAlias`
- No external dependencies