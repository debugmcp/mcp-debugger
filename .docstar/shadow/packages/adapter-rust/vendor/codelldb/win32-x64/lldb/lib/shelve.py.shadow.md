# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/shelve.py
@source-hash: b978c6f0ffa901b0
@generated: 2026-02-09T18:13:08Z

## Purpose
Provides persistent dictionary-like storage using pickle serialization over various database backends. Implements shelf objects that allow storing arbitrary Python objects (values) with string keys in a persistent manner.

## Core Classes

### `_ClosedDict` (L66-74)
Sentinel class that replaces shelf dictionary after closure. All operations raise `ValueError` with "invalid operation on closed shelf" message. Prevents access to closed shelf instances.

### `Shelf` (L77-173)
Base shelf implementation providing persistent dictionary interface with pickle serialization.

**Key Methods:**
- `__init__(dict, protocol=None, writeback=False, keyencoding="utf-8")` (L84-92): Initializes with backing dictionary, pickle protocol, writeback cache, and key encoding
- `__getitem__(key)` (L109-117): Retrieves and unpickles values, caches if writeback enabled
- `__setitem__(key, value)` (L119-125): Pickles and stores values, updates cache if writeback enabled
- `sync()` (L164-172): Writes cached entries back to persistent storage, clears cache
- `close()` (L140-155): Syncs data, closes backing dict, replaces with `_ClosedDict`

**Key Features:**
- UTF-8 key encoding/decoding for string keys
- Optional writeback caching for mutable object handling
- Context manager support (`__enter__`/`__exit__`)
- Graceful cleanup in `__del__` with initialization check

### `BsdDbShelf` (L175-215)
Shelf subclass for BSD DB interfaces, adds cursor-style navigation methods:
- `set_location(key)` (L192-195): Set cursor position
- `first()/last()` (L207-215): Navigate to extremes  
- `next()/previous()` (L197-205): Sequential navigation
All methods return (key, unpickled_value) tuples.

### `DbfilenameShelf` (L218-227)
Convenience shelf using generic `dbm` module. Initializes by opening dbm database from filename parameter.

## Module Interface

### `open()` Function (L230-242)
Primary entry point returning `DbfilenameShelf` instance. Parameters match `dbm.open()` plus pickle protocol and writeback options.

## Dependencies
- `pickle`: Object serialization (DEFAULT_PROTOCOL, Pickler, Unpickler)
- `io.BytesIO`: In-memory binary streams for pickle operations  
- `collections.abc`: Abstract base classes for mapping interface
- `dbm`: Generic database interface (imported in DbfilenameShelf)

## Critical Design Patterns
- **Writeback Caching**: Optional caching mechanism to handle mutable object modifications
- **Key Encoding**: Transparent UTF-8 encoding/decoding for string keys stored as bytes
- **Graceful Degradation**: Robust error handling during closure and cleanup
- **Multiple Backend Support**: Abstract base allows different database implementations

## Important Invariants
- Keys are always strings, internally stored as UTF-8 encoded bytes
- Values are arbitrary Python objects serialized via pickle
- Writeback cache maintains object identity until sync/close
- Closed shelves become `_ClosedDict` instances that reject all operations