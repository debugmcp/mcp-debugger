# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/_threading_local.py
@source-hash: e1bf3dae66d0bfa6
@generated: 2026-02-09T18:07:00Z

## Primary Purpose
Pure Python implementation of thread-local storage, providing the `local` class that manages thread-specific data. This is a fallback implementation used when the faster C implementation from the `threading` module is unavailable.

## Key Classes and Functions

### `_localimpl` (L146-188)
Core implementation class managing thread-local dictionaries:
- **Purpose**: Handles storage and retrieval of per-thread data dictionaries
- **Key attributes**: `key` (unique identifier), `dicts` (thread ID to dict mapping), `localargs`, `locallock`
- **`get_dict()`** (L158): Retrieves existing dict for current thread, raises KeyError if none exists
- **`create_dict()`** (L164): Creates new thread-local dict with cleanup callbacks for garbage collection

### `_patch()` (L190-202)
Context manager that temporarily patches the `__dict__` attribute:
- **Purpose**: Ensures thread-local dict is active during attribute operations
- **Behavior**: Gets/creates thread dict, acquires lock, patches `__dict__`, calls `__init__` if needed

### `local` (L204-240)
Main thread-local storage class:
- **`__new__()`** (L207): Creates instance with `_localimpl`, validates initialization args
- **`__getattribute__()`** (L221): Intercepts all attribute access through `_patch()`
- **`__setattr__()`** (L225): Intercepts attribute setting, protects `__dict__` from modification
- **`__delattr__()`** (L233): Intercepts attribute deletion, protects `__dict__` from deletion

## Dependencies
- `weakref.ref`: For cleanup callbacks when threads/objects are garbage collected
- `contextlib.contextmanager`: For the `_patch()` context manager
- `threading.current_thread`, `threading.RLock`: Imported at bottom to avoid circular imports

## Architectural Decisions
- **Circular import avoidance**: Threading module imports delayed to bottom (L242) to prevent circular dependencies
- **Weak references**: Used for automatic cleanup when threads or local objects are destroyed
- **Slot-based storage**: Uses `__slots__` for memory efficiency
- **Lock protection**: RLock ensures thread safety during dict operations
- **Unique key generation**: Uses object ID to create unique thread attribute keys

## Critical Invariants
- Each thread gets its own isolated dictionary via `_localimpl.dicts`
- `__dict__` attribute is read-only to users but internally managed
- Subclass `__init__` methods are called once per thread when dict is created
- Slots in subclasses are shared across threads (not thread-local)

## Usage Patterns
- Direct instantiation: `mydata = local()` then `mydata.attr = value`
- Subclassing for defaults and methods with per-thread initialization
- Automatic cleanup via weak references prevents memory leaks