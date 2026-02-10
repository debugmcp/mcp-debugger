# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/shelve.py
@source-hash: b978c6f0ffa901b0
@generated: 2026-02-09T18:07:59Z

## Purpose and Responsibility

Python shelve module providing persistent dictionary-like storage using pickle serialization. Enables storing arbitrary Python objects as values while maintaining dbm-style key-value persistence. Core abstraction layer between in-memory dictionaries and persistent storage backends.

## Key Classes and Functions

**_ClosedDict (L66-74)**: Sentinel class implementing MutableMapping that raises ValueError on all operations. Used as placeholder when shelf is closed to prevent further access attempts.

**Shelf (L77-173)**: Primary implementation providing persistent dictionary interface with pickle serialization.
- `__init__` (L84-92): Initializes with backing dict, pickle protocol, writeback mode, and key encoding
- `__getitem__` (L109-117): Deserializes values from backing store, handles writeback caching
- `__setitem__` (L119-125): Serializes values using pickle, manages cache when writeback enabled
- `__delitem__` (L127-132): Removes from both backing store and cache
- `sync` (L164-172): Flushes writeback cache to persistent storage
- `close` (L140-156): Synchronizes changes, closes backing store, replaces with _ClosedDict

**BsdDbShelf (L175-215)**: Specialized shelf for BSD DB interface adding navigation methods:
- `set_location`, `next`, `previous`, `first`, `last` (L192-215): Iterator-style access methods specific to BSD DB

**DbfilenameShelf (L218-227)**: Convenience wrapper using dbm module as backing store. Auto-opens dbm database from filename.

**open (L230-243)**: Module-level factory function creating DbfilenameShelf instances. Primary public entry point.

## Key Dependencies

- `pickle`: Object serialization/deserialization (DEFAULT_PROTOCOL, Pickler, Unpickler)
- `io.BytesIO`: In-memory binary streams for pickle operations
- `collections.abc.MutableMapping`: Abstract base class for dict-like interface
- `dbm`: Generic database interface (imported in DbfilenameShelf)

## Critical Architecture Patterns

**Writeback Mode**: Optional caching mechanism where accessed objects remain in memory until explicit sync/close. Trades memory usage for transparent mutability of stored objects.

**Key Encoding**: UTF-8 encoding/decoding layer between string keys and bytes required by backing stores.

**Layered Storage**: Abstract Shelf class delegates to pluggable backing dictionary implementations (dbm, bsddb, etc).

**Resource Management**: Context manager support and defensive cleanup in `__del__` with shutdown-safe error handling.

## Important Invariants

- Keys must be strings, internally encoded as UTF-8 bytes
- Values must be pickle-serializable
- Writeback cache synchronization required for mutable object modifications to persist
- Backing store closure handled gracefully with _ClosedDict substitution
- All navigation methods in BsdDbShelf return (key, value) tuples with unpickled values