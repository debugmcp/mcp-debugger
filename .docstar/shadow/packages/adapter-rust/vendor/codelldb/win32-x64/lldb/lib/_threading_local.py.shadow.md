# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/_threading_local.py
@source-hash: e1bf3dae66d0bfa6
@generated: 2026-02-09T18:12:45Z

## Thread-Local Storage Implementation

This file provides a pure Python implementation of thread-local storage, serving as a fallback when the C implementation in `threading.local` is not available. The module is part of Python's standard library threading infrastructure.

### Primary Components

**`_localimpl` class (L146-187)**: Core implementation managing per-thread dictionaries
- Stores thread-local data using weak references to avoid memory leaks
- Key attributes: `key` (unique identifier), `dicts` (thread ID to dict mapping), `localargs`, `locallock`
- `get_dict()` (L158): Retrieves existing thread-local dict, raises KeyError if none exists
- `create_dict()` (L164): Creates new thread-local dict with cleanup callbacks for garbage collection

**`local` class (L204-240)**: Main user-facing interface for thread-local objects
- Uses `__slots__` to restrict attributes to `_local__impl` and `__dict__`
- `__new__()` (L207): Factory method that creates `_localimpl` instance and initializes thread dict
- Overrides `__getattribute__`, `__setattr__`, `__delattr__` to use `_patch` context manager
- Prevents direct modification of `__dict__` attribute

**`_patch` context manager (L190-201)**: Critical synchronization mechanism
- Temporarily replaces object's `__dict__` with thread-specific dictionary
- Handles thread-local dict creation and initialization on first access
- Uses `RLock` for thread safety during attribute operations

### Key Architectural Patterns

- **Weak reference cleanup**: Uses `ref()` with callbacks to automatically clean up thread-local data when threads or local objects are deleted (L183-186)
- **Lazy initialization**: Thread-local dicts are created on first access per thread
- **Context manager synchronization**: All attribute access goes through `_patch` to ensure thread safety
- **Unique key generation**: Uses object ID to create collision-resistant keys for thread storage (L154)

### Dependencies

- `weakref.ref`: For automatic cleanup of thread-local data
- `contextlib.contextmanager`: For `_patch` implementation
- `threading.current_thread`, `threading.RLock`: Imported at bottom to avoid circular imports (L242)

### Critical Constraints

- `__dict__` attribute is read-only to prevent corruption of thread-local storage
- Initialization arguments only supported if subclass overrides `__init__`
- `__slots__` in subclasses are shared across threads, not thread-local
- Module uses delayed import pattern to work around potential circular import issues with threading module