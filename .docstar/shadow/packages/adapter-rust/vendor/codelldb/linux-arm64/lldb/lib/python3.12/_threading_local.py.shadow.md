# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/_threading_local.py
@source-hash: e1bf3dae66d0bfa6
@generated: 2026-02-09T18:10:24Z

## Purpose
Pure Python implementation of thread-local storage, providing the `threading.local` class for Python versions without compiled thread-local support. Manages per-thread data isolation where each thread maintains its own independent attribute dictionary.

## Key Components

### `_localimpl` (L146-187)
Internal implementation managing thread-local dictionaries:
- **Attributes**: Uses `__slots__` for `key`, `dicts`, `localargs`, `locallock`, `__weakref__`
- **`__init__`** (L150-156): Creates unique string key and empty `dicts` mapping
- **`get_dict`** (L158-162): Retrieves current thread's dictionary, raises KeyError if missing
- **`create_dict`** (L164-187): Creates new per-thread dictionary with cleanup callbacks
  - Sets up weak references for automatic cleanup when thread or localimpl dies
  - Stores thread reference and local dict in `self.dicts[thread_id]`

### `_patch` (L190-201) 
Context manager that temporarily patches `__dict__`:
- Retrieves or creates thread-local dictionary via `_localimpl`
- Calls `__init__` on first access per thread with stored `localargs`
- Acquires lock and temporarily replaces object's `__dict__` with thread-local version

### `local` (L204-239)
Main thread-local class:
- **`__slots__`**: `_local__impl`, `__dict__`
- **`__new__`** (L207-219): 
  - Validates no init args unless custom `__init__` defined
  - Creates `_localimpl` instance with RLock
  - Stores initialization arguments for per-thread replay
- **Attribute access methods** (L221-239): All wrap operations with `_patch()`:
  - `__getattribute__`, `__setattr__`, `__delattr__`
  - Prevents `__dict__` modification (read-only)

## Architecture Patterns
- **Weak reference cleanup**: Automatic removal of thread data when threads die
- **Lazy initialization**: Thread dictionaries created on first access
- **Context manager patching**: Temporarily swaps `__dict__` for thread-safe access
- **Deferred imports**: Threading module imported at bottom (L242) to avoid circular dependencies

## Critical Invariants
- Each thread gets isolated attribute storage via unique dictionaries
- `__init__` called exactly once per thread with original arguments
- `__dict__` attribute is read-only to users but internally swapped
- Cleanup callbacks prevent memory leaks from dead threads
- Thread safety ensured via RLock during dictionary swapping

## Dependencies
- `weakref.ref`: For automatic cleanup callbacks
- `contextlib.contextmanager`: For `_patch` decorator
- `threading.current_thread`, `threading.RLock`: Deferred import at end of file