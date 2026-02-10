# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/_threading_local.py
@source-hash: e1bf3dae66d0bfa6
@generated: 2026-02-09T18:09:22Z

## Purpose
Pure Python implementation of thread-local storage, providing a fallback when native thread-local support isn't available. This is the reference implementation for `threading.local` class.

## Core Architecture

### _localimpl (L146-187)
Internal implementation class managing thread-local dictionaries:
- **key** (L154): Unique string identifier for thread attributes
- **dicts** (L156): Maps thread IDs to (weak_ref, local_dict) pairs
- **get_dict()** (L158-162): Retrieves existing thread-local dict or raises KeyError
- **create_dict()** (L164-187): Creates new thread-local dict with cleanup callbacks

Uses weak references to handle cleanup when threads or local objects are destroyed. The cleanup callbacks (L170-182) prevent memory leaks by removing thread attributes and local dicts when their owners are garbage collected.

### _patch() (L190-201)
Context manager that temporarily patches the local object's `__dict__`:
- Gets or creates thread-local dict via _localimpl
- Calls `__init__` for new threads with stored args/kwargs (L197-198)
- Thread-safely swaps object's `__dict__` using RLock (L199-200)

### local (L204-239)
Main thread-local class with restricted `__slots__`:
- **__new__()** (L207-219): Creates instance with _localimpl, validates initialization args
- **__getattribute__()** (L221-223): Wraps all attribute access with _patch()
- **__setattr__()** (L225-231): Prevents `__dict__` modification, wraps with _patch()
- **__delattr__()** (L233-239): Prevents `__dict__` deletion, wraps with _patch()

## Key Design Patterns

**Thread Isolation**: Each thread gets its own dictionary namespace while sharing the same object instance.

**Lazy Initialization**: Thread-local dicts created on first access per thread.

**Weak Reference Cleanup**: Automatic cleanup prevents memory leaks when threads or objects are destroyed.

**Circular Import Avoidance**: Threading module imports deferred to bottom (L242) to prevent circular dependencies.

## Dependencies
- **weakref.ref**: For cleanup callbacks
- **contextlib.contextmanager**: For _patch() decorator
- **threading**: current_thread, RLock (imported at module end)

## Critical Invariants
- Each thread maintains separate `__dict__` namespace
- Slots in subclasses are shared across threads (not thread-local)
- `__init__` called once per thread for subclass instances
- `__dict__` attribute is read-only to users