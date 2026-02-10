# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/linecache.py
@source-hash: f0d2e4e57807b7cf
@generated: 2026-02-09T18:08:45Z

**Primary Purpose:** Python source file line caching system that maintains an in-memory cache of source code lines for modules and files. Part of Python's standard library for debugging and introspection tools.

**Core Architecture:**
- Global `cache` dict (L18) stores filename mappings to either lazy thunks or loaded file data tuples
- Cache entries use format `(size, mtime, lines, fullname)` for loaded files or `(get_lines_func,)` for lazy entries
- Implements lazy loading pattern where source is only retrieved when actually needed

**Public API Functions:**
- `getline(filename, lineno, module_globals=None)` (L26-33): Retrieves single line by number, returns empty string if out of bounds
- `getlines(filename, module_globals=None)` (L36-49): Returns all lines for a file, handles cache misses via `updatecache`
- `clearcache()` (L21-23): Empties entire cache
- `checkcache(filename=None)` (L52-77): Validates cache entries against filesystem, removes stale entries
- `lazycache(filename, module_globals)` (L149-182): Seeds cache with lazy loader for deferred source retrieval

**Cache Management:**
- `updatecache(filename, module_globals=None)` (L80-146): Core cache population logic
  - Handles file system lookup via `os.stat` and `sys.path` traversal (L122-134)
  - Uses `tokenize.open` for proper encoding handling (L138)
  - Falls back to module loader via PEP302 `get_source` method (L99-115)
  - Ensures lines end with newlines (L142-143)

**Key Dependencies:**
- `os` for filesystem operations and stat checking
- `sys.path` for module search path traversal  
- `tokenize.open` for encoding-aware file reading
- `functools.partial` for lazy loading implementation

**Notable Patterns:**
- Dual cache entry types: lazy thunks vs. loaded tuples, distinguished by length check
- Graceful degradation: returns empty lists/strings on errors rather than raising
- Memory pressure handling: clears entire cache on `MemoryError` (L47-48)
- Module loader integration: supports both `__spec__.loader` and legacy `__loader__` patterns

**Critical Constraints:**
- Filenames wrapped in `<>` are treated as non-cacheable (L88, L167)
- Cache invalidation based on file size and mtime changes (L76)
- Lazy entries bypass filesystem stat checks during validation (L69-70)