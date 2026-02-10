# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/shelve.py
@source-hash: b978c6f0ffa901b0
@generated: 2026-02-09T18:07:20Z

## Purpose
Python shelve module providing persistent dictionary-like storage for arbitrary Python objects using pickle serialization over dbm databases.

## Key Classes

### _ClosedDict (L66-74)
Marker class for closed shelf instances. All operations raise ValueError to prevent access to closed shelves.

### Shelf (L77-173)
Base class implementing persistent dictionary interface with pickle serialization.
- `__init__(L84-92)`: Initializes with dictionary backend, protocol, writeback cache, and key encoding
- `__getitem__(L109-117)`: Deserializes values from pickle, uses cache if writeback enabled
- `__setitem__(L119-125)`: Serializes values to pickle and stores in backend dict
- `__delitem__(L127-132)`: Removes from backend and cache
- `close(L140-155)`: Syncs cache, closes backend, replaces with _ClosedDict
- `sync(L164-172)`: Writes cache entries back to persistent storage
- Context manager support via `__enter__/__exit__(L134-138)`

### BsdDbShelf (L175-215)
Shelf subclass for BSD DB interface with additional navigation methods:
- `set_location(L192-195)`, `next(L197-200)`, `previous(L202-205)`, `first(L207-210)`, `last(L212-215)`: Navigate database cursor positions

### DbfilenameShelf (L218-227)
Shelf implementation using generic dbm interface, initialized with filename rather than dict object.

## Key Functions

### open(L230-242)
Primary entry point - creates DbfilenameShelf instance with specified filename, flags, protocol, and writeback options.

## Architecture Patterns

**Pickle Serialization**: All values serialized/deserialized using pickle module with configurable protocol version
**Key Encoding**: String keys encoded to bytes using UTF-8 (configurable in Shelf.__init__)
**Writeback Cache**: Optional caching system to handle mutable object modifications transparently
**Dictionary Abstraction**: Wraps various dbm backends with consistent MutableMapping interface

## Critical Invariants

- Keys must be strings, internally encoded as bytes
- Values can be any pickle-serializable Python object  
- Writeback cache trades memory for convenience with mutable objects
- Access returns COPIES of stored objects, not references
- Backend dict must support bytes keys and values

## Dependencies
- `pickle` module for serialization (DEFAULT_PROTOCOL, Pickler, Unpickler)
- `collections.abc` for MutableMapping interface
- `io.BytesIO` for in-memory binary streams
- `dbm` module (imported in DbfilenameShelf.__init__)

## Usage Warnings
- Without writeback=True, modifying returned mutable objects has no effect on persistent storage
- Writeback cache can consume significant memory and slow close() operations
- Manual sync() required for intermediate cache flushes when using writeback