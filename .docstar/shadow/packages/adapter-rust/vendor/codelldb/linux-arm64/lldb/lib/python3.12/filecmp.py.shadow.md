# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/filecmp.py
@source-hash: 803d8494d5ae72f9
@generated: 2026-02-09T18:08:42Z

## File Purpose
Python standard library module providing utilities for comparing files and directories. Implements efficient file comparison with caching and comprehensive directory structure comparison through phased analysis.

## Key Components

### Core Functions
- **`cmp(f1, f2, shallow=True)`** (L30-68): Main file comparison function with caching. Supports shallow (stat-based) or deep (content-based) comparison. Uses internal cache `_cache` for performance optimization.
- **`clear_cache()`** (L26-28): Clears the global file comparison cache stored in `_cache`.
- **`cmpfiles(a, b, common, shallow=True)`** (L260-278): Compares multiple files between two directories, returning tuple of (equal_files, different_files, funny_files).

### Core Class
- **`dircmp`** (L88-258): Comprehensive directory comparison class using lazy evaluation through phases:
  - **Phase 0** (L136-142): List directory contents, filtering by hide/ignore lists
  - **Phase 1** (L144-149): Compute common, left_only, right_only files
  - **Phase 2** (L151-186): Categorize common items as dirs/files/funny
  - **Phase 3** (L188-190): Compare common files using `cmpfiles`
  - **Phase 4** (L192-201): Create subdirectory comparison instances
  - **`__getattr__`** (L251-255): Implements lazy evaluation via methodmap dispatch

### Internal Helpers
- **`_sig(st)`** (L70-73): Extracts file signature (type, size, mtime) from stat object
- **`_do_cmp(f1, f2)`** (L75-84): Performs actual byte-by-byte file comparison
- **`_cmp(a, b, sh)`** (L287-291): Wrapper for cmp() returning 0/1/2 for equal/different/error
- **`_filter(flist, skip)`** (L296-297): Filters file list removing items in skip list

### Configuration
- **`DEFAULT_IGNORES`** (L23-24): Default list of ignored directory names (VCS dirs, cache dirs)
- **`BUFSIZE`** (L21): Buffer size for file reading (8KB)
- **`_cache`** (L20): Global cache dictionary for file comparison results

## Key Patterns
- **Lazy evaluation**: `dircmp` uses `__getattr__` with methodmap to compute attributes only when accessed
- **Phased analysis**: Directory comparison broken into discrete phases for modularity
- **Caching strategy**: File comparisons cached with size limit (100 entries) and automatic clearing
- **Error handling**: Graceful handling of stat failures and file access errors
- **Recursive structure**: `dircmp` creates child instances for subdirectory comparison

## Dependencies
- Standard library: `os`, `stat`, `itertools.filterfalse`, `types.GenericAlias`
- File system operations through `os.stat`, `os.listdir`, file I/O

## Critical Invariants
- Cache entries invalidated when file stat signatures change
- Only regular files compared for content equality
- Case-insensitive filename handling via `os.path.normcase`
- Recursive subdirectory comparison preserves parent's hide/ignore settings