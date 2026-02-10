# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/filecmp.py
@source-hash: 803d8494d5ae72f9
@generated: 2026-02-09T18:12:57Z

## Purpose
Python standard library module providing utilities for comparing files and directories. Implements file comparison with caching and comprehensive directory comparison with recursive capabilities.

## Key Functions

### File Comparison
- **`cmp(f1, f2, shallow=True)`** (L30-68): Core file comparison function with intelligent caching
  - Supports shallow (stat-based) and deep (content-based) comparison
  - Uses `_cache` dict for memoization with automatic cleanup at 100 entries
  - Returns `False` for non-regular files, handles stat signature comparison
  - Delegates to `_do_cmp()` for actual content comparison

- **`_sig(st)`** (L70-73): Creates file signature tuple `(file_type, size, mtime)` from stat object
- **`_do_cmp(f1, f2)`** (L75-84): Binary file content comparison using 8KB buffer chunks
- **`clear_cache()`** (L26-28): Empties the comparison cache

### Directory Operations  
- **`cmpfiles(a, b, common, shallow=True)`** (L260-278): Batch file comparison across directories
  - Returns tuple: `(equal_files, different_files, funny_files)`
  - Uses `_cmp()` helper for classification into 0/1/2 result codes

## Core Class

### `dircmp` (L88-257)
Comprehensive directory comparison class with lazy attribute evaluation via `__getattr__`.

**Key Attributes (computed on-demand):**
- `left_list, right_list`: Filtered directory contents  
- `common, left_only, right_only`: Set-based file categorization
- `common_dirs, common_files, common_funny`: Type-based classification
- `same_files, diff_files, funny_files`: Comparison results
- `subdirs`: Nested `dircmp` instances for recursive comparison

**Phase Methods:**
- `phase0()` (L136-142): Directory listing with filtering
- `phase1()` (L144-149): Common file identification using case-insensitive mapping
- `phase2()` (L151-186): File type classification with robust error handling
- `phase3()` (L188-190): File content comparison via `cmpfiles()`
- `phase4()` (L192-201): Recursive subdirectory `dircmp` creation
- `phase4_closure()` (L203-206): Deep recursive traversal

**Reporting:**
- `report()` (L208-231): Basic difference summary
- `report_partial_closure()` (L233-237): One-level recursive reporting  
- `report_full_closure()` (L239-243): Full recursive reporting

## Architecture Patterns

- **Lazy Evaluation**: `methodmap` dict (L245-249) maps attributes to phase methods, triggered by `__getattr__`
- **Caching Strategy**: Global `_cache` with size-based eviction to prevent memory leaks
- **Error Resilience**: Comprehensive exception handling for OS errors and edge cases
- **Recursive Design**: Self-referential subdirectory creation using `self.__class__`

## Dependencies & Constants
- **External**: `os`, `stat`, `itertools.filterfalse`, `types.GenericAlias`
- **Constants**: `BUFSIZE = 8*1024`, `DEFAULT_IGNORES` for VCS directories
- **Module**: Includes CLI demo function (L302-315) with getopt parsing