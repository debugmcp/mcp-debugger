# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/filecmp.py
@source-hash: 803d8494d5ae72f9
@generated: 2026-02-09T18:09:45Z

## Purpose
Python standard library module for comparing files and directories. Provides utilities for shallow/deep file comparison with caching, and comprehensive directory comparison with hierarchical reporting.

## Core Functions

### File Comparison
- `cmp(f1, f2, shallow=True)` (L30-68): Main file comparison function with caching
  - Returns True if files are identical, False otherwise
  - `shallow=True`: compares only stat signatures (type, size, mtime)
  - `shallow=False`: performs byte-by-byte content comparison
  - Uses global `_cache` dict for performance optimization
  - Cache limited to 100 entries, cleared when exceeded

- `_sig(st)` (L70-73): Creates file signature tuple from stat object (type, size, mtime)
- `_do_cmp(f1, f2)` (L75-84): Performs actual byte-by-byte file comparison using 8KB buffer
- `_cmp(a, b, sh)` (L287-291): Internal wrapper returning 0=equal, 1=different, 2=error

### Directory Comparison
- `cmpfiles(a, b, common, shallow=True)` (L260-278): Compares list of common files between two directories
  - Returns tuple of (equal_files, different_files, funny_files)

## Core Class

### dircmp (L88-257)
Comprehensive directory comparison class with lazy attribute computation.

**Initialization** (L124-134):
- Takes two directory paths, optional ignore/hide lists
- `ignore` defaults to `DEFAULT_IGNORES` (VCS and cache dirs)
- `hide` defaults to current/parent directory entries

**Computation Phases** (executed lazily via `__getattr__`):
- `phase0()` (L136-142): Lists and filters directory contents
- `phase1()` (L144-149): Computes common, left_only, right_only files
- `phase2()` (L151-186): Categorizes common items as dirs/files/funny
- `phase3()` (L188-190): Compares common files using `cmpfiles()`
- `phase4()` (L192-201): Creates recursive dircmp instances for subdirectories

**Key Attributes** (computed on-demand):
- `left_list, right_list`: Filtered directory contents
- `common, left_only, right_only`: File categorization
- `common_dirs, common_files, common_funny`: Type-based categorization
- `same_files, diff_files, funny_files`: File comparison results
- `subdirs`: Dict of dircmp instances for recursive comparison

**Reporting Methods**:
- `report()` (L208-231): Prints comparison summary
- `report_partial_closure()` (L233-237): Reports on self + immediate subdirs
- `report_full_closure()` (L239-243): Fully recursive reporting

## Global Configuration
- `_cache = {}` (L20): Global file comparison cache
- `BUFSIZE = 8*1024` (L21): Buffer size for file reading
- `DEFAULT_IGNORES` (L23-24): Standard VCS and cache directories to ignore
- `clear_cache()` (L26-28): Clears global comparison cache

## Utilities
- `_filter(flist, skip)` (L296-297): Filters list removing items in skip
- `demo()` (L302-312): Command-line demo function with optional recursive flag

## Design Patterns
- Lazy evaluation via `__getattr__` and `methodmap` (L245-255)
- Caching with size limits and automatic cleanup
- Recursive directory traversal with inheritance of ignore/hide settings
- Graceful error handling for stat failures and file access issues