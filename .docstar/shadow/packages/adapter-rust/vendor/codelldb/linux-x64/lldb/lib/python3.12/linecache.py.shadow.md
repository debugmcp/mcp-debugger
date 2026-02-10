# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/linecache.py
@source-hash: f0d2e4e57807b7cf
@generated: 2026-02-09T18:09:44Z

## Primary Purpose
Python source file line caching module that provides efficient access to source code lines from files and modules. Caches file contents with metadata to avoid repeated file I/O operations and supports both immediate and lazy loading strategies.

## Core Data Structure
- **cache** (L18): Global dictionary mapping filenames to either lazy thunks `(get_lines_func,)` or loaded tuples `(size, mtime, lines, fullname)`

## Key Functions

### Public API Functions
- **getline(filename, lineno, module_globals=None)** (L26-33): Returns a single line from cached file, 1-based indexing, empty string if out of bounds
- **getlines(filename, module_globals=None)** (L36-49): Returns all lines as list, handles lazy loading and memory errors
- **clearcache()** (L21-23): Clears entire cache dictionary
- **checkcache(filename=None)** (L52-77): Validates cache entries against filesystem, removes stale entries based on size/mtime changes

### Internal Functions  
- **updatecache(filename, module_globals=None)** (L80-146): Core cache population logic, handles file reading with encoding detection via tokenize.open(), searches sys.path for relative files
- **lazycache(filename, module_globals)** (L149-181): Sets up deferred loading using module loaders, returns boolean success indicator

## Architecture Patterns

### Cache Entry States
1. **Lazy**: Single-element tuple containing callable `(get_lines_func,)`
2. **Loaded**: 4-tuple `(size, mtime, lines, fullname)` with filesystem metadata

### Loading Strategy Priority
1. Check existing cache entries
2. Attempt lazy loader resolution via `__spec__.loader` or `__loader__` 
3. Direct file access with os.stat()
4. sys.path search for relative filenames
5. Encoding-aware reading via tokenize.open()

### Error Handling
- Memory pressure: clearcache() on MemoryError (L47-48)
- File access failures: return empty list rather than propagate exceptions
- Invalid filenames: reject angle-bracket wrapped names like `<string>` (L88, L167)

## Dependencies
- **tokenize**: For encoding-aware file reading (L138)
- **functools**: For partial function creation in lazy loading (L179)
- **sys, os**: For path operations and filesystem access

## Critical Invariants
- Line numbers are 1-based in getline() but 0-based in internal lists
- Cache entries maintain filesystem sync via size/mtime validation
- Empty return values indicate errors rather than exceptions for most operations
- Lazy entries preserve callable until first access