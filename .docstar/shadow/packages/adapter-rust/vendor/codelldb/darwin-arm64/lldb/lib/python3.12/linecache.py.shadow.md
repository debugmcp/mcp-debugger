# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/linecache.py
@source-hash: f0d2e4e57807b7cf
@generated: 2026-02-09T18:07:09Z

## Primary Purpose
Python source file line caching system that provides efficient access to source code lines from imported modules. Handles fallback lookups through module search paths and supports lazy loading via module loaders.

## Core Data Structure
- **cache** (L18): Global dictionary mapping filenames to cache entries. Entries can be either:
  - Lazy thunk: `(callable,)` - single-element tuple with source retrieval function
  - Loaded entry: `(size, mtime, lines, fullname)` - file metadata and cached lines

## Key Functions

### Public API
- **getline(filename, lineno, module_globals=None)** (L26-33): Returns single line from cached file, handles bounds checking
- **getlines(filename, module_globals=None)** (L36-49): Returns all lines from cached file, triggers cache updates
- **clearcache()** (L21-23): Empties entire cache
- **checkcache(filename=None)** (L52-77): Validates cache entries against filesystem, removes stale entries

### Internal Operations
- **updatecache(filename, module_globals=None)** (L80-146): Core cache population logic with multiple fallback strategies:
  1. Direct file access via os.stat() (L93)
  2. Lazy loader resolution (L99-115) 
  3. sys.path search for relative files (L122-134)
  4. File reading with tokenize.open() for encoding detection (L138-141)

- **lazycache(filename, module_globals)** (L149-182): Registers deferred source loading using module's `__loader__.get_source()` method

## Key Dependencies
- **tokenize**: For encoding-aware file reading
- **functools**: For partial function creation in lazy loading
- **sys**: For module search path access
- **os**: For filesystem operations and path manipulation

## Architecture Patterns
- **Lazy evaluation**: Cache entries can defer actual file loading until needed
- **Multiple fallback strategies**: Progressive attempts from direct access to module loader to sys.path search
- **Graceful degradation**: Returns empty lists/strings on any failure rather than raising exceptions
- **Encoding safety**: Uses tokenize.open() to handle various Python file encodings

## Critical Behaviors
- Cache entries are validated by file size and modification time (L76)
- Special filename patterns `<...>` are treated as non-cacheable (L88, L167)
- Memory errors trigger complete cache clearing (L47-48)
- Lines always end with newlines, added if missing (L142-143)
- Module globals enable loader-based source retrieval for imported modules