# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/shelve.py
@source-hash: b978c6f0ffa901b0
@generated: 2026-02-09T18:10:00Z

## Purpose
Provides persistent dictionary-like storage for Python objects using pickle serialization over dbm databases. The module enables storing arbitrary Python objects (not just strings) as values while maintaining string keys.

## Core Classes

### _ClosedDict (L66-74)
Marker class implementing MutableMapping that raises ValueError on any operation. Used to replace closed shelf instances to prevent accidental access after closure.

### Shelf (L77-173)
Base persistent dictionary implementation with pickle serialization:
- `__init__(dict, protocol=None, writeback=False, keyencoding="utf-8")` (L84-92): Initializes with backing dictionary, pickle protocol, writeback caching, and key encoding
- `__getitem__(key)` (L109-117): Retrieves and unpickles values, with optional writeback caching
- `__setitem__(key, value)` (L119-125): Pickles and stores values, updates cache if writeback enabled
- `__delitem__(key)` (L127-132): Removes from backing dict and cache
- `sync()` (L164-172): Flushes writeback cache to persistent storage and syncs backing dict
- `close()` (L140-155): Syncs, closes backing dict, replaces with _ClosedDict marker
- Context manager support via `__enter__`/`__exit__` (L134-138)

Key behaviors:
- All keys encoded to bytes using keyencoding before storage
- Values pickled/unpickled transparently 
- Optional writeback cache for mutable object modification patterns
- Automatic cleanup in `__del__` (L157-162)

### BsdDbShelf (L175-215)
Shelf subclass adding BSD DB navigation methods:
- `set_location(key)` (L192-195): Sets cursor position and returns key-value pair
- `first()`/`last()` (L207-215): Navigate to first/last entries
- `next()`/`previous()` (L197-205): Sequential navigation
All methods decode keys and unpickle values consistently.

### DbfilenameShelf (L218-227)
Convenience Shelf subclass that opens dbm database from filename in constructor, using `dbm.open(filename, flag)`.

## Module Functions

### open(filename, flag='c', protocol=None, writeback=False) (L230-242)
Primary entry point returning DbfilenameShelf instance. Parameters match dbm.open() flag semantics plus pickle protocol and writeback options.

## Key Dependencies
- `pickle`: Object serialization (DEFAULT_PROTOCOL, Pickler, Unpickler)
- `io.BytesIO`: In-memory binary streams for pickle operations
- `collections.abc`: MutableMapping interface
- `dbm`: Database backend (imported in DbfilenameShelf)

## Critical Patterns
- **Copy semantics**: `d[key]` returns copies, not references to stored objects
- **Writeback caching**: Optional performance/convenience trade-off for mutable objects
- **Key encoding**: String keys transparently encoded to bytes for storage
- **Resource management**: Context manager pattern with automatic cleanup
- **Graceful closure**: Handles errors during interpreter shutdown