# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/linecache.py
@source-hash: f0d2e4e57807b7cf
@generated: 2026-02-09T18:12:52Z

## Python Source Line Cache Module

**Primary Purpose**: Caches lines from Python source files to optimize repeated access, particularly for modules imported during execution. Handles both filesystem-based and loader-based source retrieval.

**Core Architecture**: 
- Global `cache` dict (L18) maps filenames to either lazy thunks or resolved tuples `(size, mtime, lines, fullname)`
- Two-phase loading: lazy registration via module loaders, then on-demand resolution

**Key Functions**:

- **`getline(filename, lineno, module_globals=None)`** (L26-33): Main API for retrieving single lines, 1-indexed with bounds checking
- **`getlines(filename, module_globals=None)`** (L36-49): Core retrieval function, handles cache hits and delegates to `updatecache()` on misses
- **`clearcache()`** (L21-23): Complete cache invalidation
- **`checkcache(filename=None)`** (L52-77): Validates cache entries against filesystem stats, removes stale entries
- **`updatecache(filename, module_globals=None)`** (L80-146): Cache population logic with fallback chain:
  1. Lazy loader resolution (L99-115)  
  2. Module search path traversal (L122-134)
  3. Direct file reading with `tokenize.open()` (L138-139)
- **`lazycache(filename, module_globals)`** (L149-182): Registers deferred source loading via PEP302 loaders

**Critical Patterns**:
- Cache entry discrimination: single-element tuples are lazy thunks, 4-tuples are resolved entries
- Memory pressure handling: `MemoryError` triggers full cache clear (L47-48)
- Encoding-aware file reading via `tokenize.open()` (L138)
- Newline normalization for last line (L142-143)

**Dependencies**: `functools`, `sys`, `os`, `tokenize`

**Constraints**:
- Skips synthetic filenames (enclosed in `<>`) (L88, L167)
- Only searches `sys.path` for relative filenames (L119-120)
- Loader-based caching requires `__spec__` or `__loader__` in module globals (L170-176)