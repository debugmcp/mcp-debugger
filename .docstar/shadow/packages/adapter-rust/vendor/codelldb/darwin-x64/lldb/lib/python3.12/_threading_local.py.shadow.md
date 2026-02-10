# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/_threading_local.py
@source-hash: e1bf3dae66d0bfa6
@generated: 2026-02-09T18:07:34Z

## Purpose
Pure Python implementation of thread-local storage that provides isolated data storage per thread. Alternative to C-based threading.local when native support unavailable.

## Key Classes & Functions

### _localimpl (L146-187)
Internal implementation class managing thread-local dictionaries:
- `key` (L154): Unique string identifier for storing weak references in thread objects
- `dicts` (L156): Maps thread IDs to (weak_thread_ref, thread_dict) tuples
- `get_dict()` (L158-162): Retrieves existing thread-local dict, raises KeyError if none
- `create_dict()` (L164-187): Creates new thread dict with cleanup callbacks via weak references

### _patch() (L190-201)
Context manager that temporarily patches a local object's __dict__ with thread-specific dictionary:
- Acquires thread-local dict or creates new one
- Calls __init__ for new threads with stored args/kwargs
- Uses locallock for thread safety during dict swapping

### local (L204-239)
Main thread-local storage class:
- `__slots__` (L205): Restricts to '_local__impl' and '__dict__' attributes
- `__new__()` (L207-219): Creates instance with _localimpl, validates no args unless custom __init__
- `__getattribute__()` (L221-223): Patches dict before attribute access
- `__setattr__()` (L225-231): Patches dict before setting, protects __dict__ from direct assignment
- `__delattr__()` (L233-239): Patches dict before deletion, protects __dict__ from deletion

## Dependencies
- `weakref.ref` (L131): For cleanup callbacks when threads/locals are garbage collected
- `contextlib.contextmanager` (L132): For _patch context manager
- `threading.current_thread, RLock` (L242): Delayed import to avoid circular dependencies

## Key Patterns
- **Weak reference cleanup**: Uses weak refs with callbacks to automatically clean up thread dicts when threads die
- **Dict patching**: Temporarily replaces object's __dict__ with thread-specific version during operations
- **Lazy initialization**: Creates thread dicts on-demand when first accessed
- **Circular import avoidance**: Defers threading module import to end of file

## Critical Invariants
- Each thread gets isolated dict storage via `_patch()` mechanism
- `__dict__` attribute is read-only to users but internally swapped per thread
- Cleanup callbacks prevent memory leaks from dead threads
- Subclass `__init__` called once per thread with original args/kwargs