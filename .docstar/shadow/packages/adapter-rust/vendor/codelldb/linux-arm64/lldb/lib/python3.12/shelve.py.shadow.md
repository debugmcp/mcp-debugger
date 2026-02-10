# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/shelve.py
@source-hash: b978c6f0ffa901b0
@generated: 2026-02-09T18:09:05Z

## Purpose
Provides persistent dictionary-like storage for Python objects using pickle serialization. Manages "shelves" that store arbitrary pickled Python objects with string keys, backed by dbm-style databases.

## Core Classes

### _ClosedDict (L66-74)
Marker class that raises ValueError for all dictionary operations on closed shelves. Used as a sentinel to prevent access to closed shelf instances.

### Shelf (L77-173)
**Primary shelf implementation** providing persistent dictionary interface:
- **Constructor** (L84-92): Accepts dict backend, pickle protocol, writeback mode, and key encoding
- **Dictionary Interface** (L94-132): Implements MutableMapping with automatic pickle/unpickle
  - `__getitem__` (L109-117): Deserializes values from backend, caches if writeback enabled
  - `__setitem__` (L119-125): Serializes values to backend using pickle
  - `__delitem__` (L127-132): Removes from both backend and cache
- **Context Manager** (L134-138): Supports `with` statement, auto-closes on exit
- **Resource Management** (L140-162): 
  - `close()` syncs cache and replaces dict with _ClosedDict
  - `__del__` handles cleanup if __init__ succeeded
- **Writeback System** (L164-172): `sync()` flushes cache to backend when writeback enabled

Key architectural decisions:
- Values always copied on retrieval (unless writeback caching enabled)
- UTF-8 key encoding for string-to-bytes conversion
- Cache-based writeback system for mutable object modifications

### BsdDbShelf (L175-215)
**Berkeley DB specific shelf** extending Shelf with cursor navigation:
- Adds `first()`, `last()`, `next()`, `previous()`, `set_location()` methods (L192-215)
- All methods return (key, value) tuples with automatic deserialization
- Requires BsdDB-compatible backend with cursor support

### DbfilenameShelf (L218-227)
**Convenience wrapper** that opens dbm database from filename and creates Shelf instance. Constructor (L225-227) imports dbm module and delegates to parent.

## Module Interface

### open() function (L230-242)
**Primary entry point** - creates DbfilenameShelf from filename with standard dbm flags ('c' = create/open). Returns shelf ready for dictionary-style operations.

## Dependencies
- `pickle`: Object serialization (DEFAULT_PROTOCOL, Pickler, Unpickler)
- `io.BytesIO`: In-memory binary streams for pickle operations
- `collections.abc`: Abstract base classes for MutableMapping
- `dbm`: Database backend (imported in DbfilenameShelf)

## Critical Invariants
1. Keys must be strings (encoded as UTF-8 bytes for storage)
2. Values are always pickled before storage
3. Retrieved values are copies unless writeback=True
4. Cache must be synced before close() when writeback enabled
5. Closed shelves become _ClosedDict instances to prevent access