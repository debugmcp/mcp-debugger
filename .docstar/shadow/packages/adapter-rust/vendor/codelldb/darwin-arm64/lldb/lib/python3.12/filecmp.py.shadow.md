# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/filecmp.py
@source-hash: 803d8494d5ae72f9
@generated: 2026-02-09T18:07:09Z

## Python filecmp Module - File and Directory Comparison Utilities

**Primary Purpose**: Provides utilities for comparing files and directories with caching and hierarchical analysis capabilities. Part of Python standard library for file system comparison operations.

### Core Functions

**File Comparison**
- `cmp(f1, f2, shallow=True)` (L30-68): Main file comparison function with caching
  - Returns boolean indicating file equality
  - Shallow mode compares stat signatures (type, size, mtime) only
  - Deep mode performs byte-by-byte comparison via `_do_cmp()`
  - Uses global `_cache` dict with 100-entry limit and auto-clearing
  
- `_do_cmp(f1, f2)` (L75-84): Performs actual byte-by-byte file comparison
  - Reads files in 8KB chunks (`BUFSIZE`)
  - Returns boolean, handles files of different sizes efficiently

**Directory Comparison**
- `cmpfiles(a, b, common, shallow=True)` (L260-278): Batch file comparison
  - Returns 3-tuple: (equal_files, different_files, funny_files)
  - Uses `_cmp()` helper that maps comparison results to indices 0/1/2

### Key Classes

**dircmp** (L88-257): Comprehensive directory comparison class
- **Constructor** (L124-134): Takes two directories plus optional ignore/hide lists
- **Phase-based analysis**: Lazy evaluation via `__getattr__` and `methodmap` (L245-255)
  - Phase 0 (L136-142): List and filter directory contents
  - Phase 1 (L144-149): Compute common, left-only, right-only files
  - Phase 2 (L151-186): Categorize as files, dirs, or "funny" items
  - Phase 3 (L188-190): Compare common files using `cmpfiles()`
  - Phase 4 (L192-201): Recursively create subdirectory comparisons
- **Reporting**: Multiple report methods (L208-243) for different verbosity levels
- **Attributes**: Extensive set of comparison results exposed as properties

### Utility Functions

- `clear_cache()` (L26-28): Clears global comparison cache
- `_sig(st)` (L70-73): Extracts file signature (mode, size, mtime) from stat object
- `_filter(flist, skip)` (L296-297): Filters file list using skip list

### Configuration

- `DEFAULT_IGNORES` (L23-24): Standard VCS and cache directories to ignore
- `_cache` (L20): Global cache for file comparisons, limited to 100 entries
- `BUFSIZE = 8*1024` (L21): Buffer size for file reading operations

### Dependencies

- `os`, `stat`: File system operations and stat constants
- `itertools.filterfalse`: Functional filtering
- `types.GenericAlias`: Generic type support (L257)

### Architecture Notes

- Implements lazy evaluation pattern in `dircmp` class via `__getattr__` override
- Uses caching strategy with size limits to balance memory and performance
- Handles cross-platform path normalization via `os.path.normcase`
- Robust error handling for file access issues (OSError, ValueError)
- Self-recursive design for subdirectory analysis
- Demo functionality available when run as main module (L302-315)