# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/linecache.py
@source-hash: f0d2e4e57807b7cf
@generated: 2026-02-09T18:08:16Z

## Purpose
Python source code line caching system that reads and caches lines from source files, with fallback to module search path lookup. Part of Python's standard library debugging/introspection infrastructure.

## Core Architecture

### Global Cache (L18)
- `cache` dict: Maps filenames to either lazy thunks `(callable,)` or loaded entries `(size, mtime, lines, fullname)`
- Two-state design: lazy entries defer loading until accessed, loaded entries contain file metadata + content

### Primary Interface Functions

**getline(filename, lineno, module_globals=None) (L26-33)**
- Single line retrieval with 1-based indexing
- Returns empty string for out-of-bounds access
- Delegates to `getlines()` for cache management

**getlines(filename, module_globals=None) (L36-49)**
- Main entry point for multi-line access
- Handles lazy cache entries by checking `len(entry) != 1` 
- Falls back to `updatecache()` with MemoryError recovery

### Cache Management

**clearcache() (L21-23)**
- Complete cache invalidation

**checkcache(filename=None) (L52-77)**
- Validates cache entries against filesystem state
- Compares size/mtime, removes stale entries
- Skips lazy entries and loader-based entries (mtime=None)
- Operates on single file or entire cache

**updatecache(filename, module_globals=None) (L80-146)**
- Core cache population logic
- Handles special filenames `<...>` by returning empty list
- Three-phase file resolution:
  1. Direct stat attempt (L93)
  2. Lazy loader resolution via `lazycache()` (L99-115)
  3. sys.path search for relative filenames (L122-134)
- Uses `tokenize.open()` for proper encoding handling
- Ensures lines end with newlines

### Lazy Loading System

**lazycache(filename, module_globals) (L149-182)**
- Registers deferred loading thunks using module loaders
- Extracts loader from `__spec__.loader` or `__loader__`
- Creates `functools.partial(get_source, name)` callable
- Returns boolean indicating successful lazy registration

## Dependencies
- `functools`: For partial application in lazy loading
- `sys`: Module search path access
- `os`: Filesystem operations and path manipulation  
- `tokenize`: Encoding-aware file reading

## Key Patterns
- **Dual-state cache entries**: Distinguishes lazy vs loaded via tuple length
- **Graceful degradation**: Multiple fallback strategies for file resolution
- **Encoding safety**: Uses `tokenize.open()` for proper Unicode handling
- **Memory management**: MemoryError recovery with cache clearing