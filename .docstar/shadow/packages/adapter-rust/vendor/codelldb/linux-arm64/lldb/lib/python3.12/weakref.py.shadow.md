# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/weakref.py
@source-hash: 56f8d313fb74019e
@generated: 2026-02-09T18:10:36Z

## Purpose
Python's weakref module implementation providing weak reference support as specified in PEP 205. This is part of the standard library's core weak reference functionality, enabling objects to be referenced without preventing garbage collection.

## Key Components

### Core Imports and Exports (L12-34)
- Imports fundamental weak reference types from `_weakref`: `ref`, `proxy`, `getweakrefcount`, `getweakrefs`, etc.
- Imports `WeakSet` and `_IterationGuard` from `_weakrefset`
- Defines `ProxyTypes` tuple combining `ProxyType` and `CallableProxyType` (L28)
- Exports comprehensive API through `__all__` (L30-33)

### WeakMethod Class (L38-90)
Custom `weakref.ref` subclass that creates weak references to bound methods, solving the problem that bound methods are typically short-lived objects.

**Key Features:**
- `__new__(cls, meth, callback=None)` (L46-66): Creates weak refs to both the method's object (`__self__`) and function (`__func__`)
- `__call__()` (L68-73): Reconstructs the bound method if both object and function are still alive
- `__eq__/__ne__` (L75-87): Custom equality comparison considering both object and function references
- Uses `_alive` flag and self-weakref trick to avoid reference cycles (L53-66)

### WeakValueDictionary Class (L92-333)
Dictionary that holds weak references to its values, automatically removing entries when values are garbage collected.

**Key Architecture:**
- `__init__` (L104-119): Sets up removal callback using `_remove_dead_weakref` for thread-safe cleanup
- `_commit_removals()` (L121-131): Processes pending removals atomically
- Uses `KeyedRef` instances to store values with associated keys (L167, L284, L297)
- `_pending_removals` list tracks keys to be removed during iteration (L109, L116)
- `_iterating` set prevents concurrent modification during iteration (L117, L173, L187)

**Core Methods:**
- Item access methods (`__getitem__`, `__setitem__`, `__delitem__`) handle pending removals
- Iterator methods (`items`, `keys`, `values`) use `_IterationGuard` for safe concurrent access
- `itervaluerefs()`/`valuerefs()` (L228-241, L301-313) return weak reference objects directly

### KeyedRef Class (L335-354)
Specialized `weakref.ref` subclass that includes a key attribute, used by `WeakValueDictionary` to avoid creating separate callback functions for each entry.

### WeakKeyDictionary Class (L356-537)
Dictionary that holds weak references to its keys, complementing `WeakValueDictionary`.

**Key Differences from WeakValueDictionary:**
- Uses keys as weak references: `self.data[ref(key, self._remove)] = value` (L428)
- `_dirty_len` flag tracks when length calculation needs adjustment (L383, L411, L418)
- `_scrub_removals()` (L405-408) cleans up pending removals list
- Different removal semantics since dead weak references never equal live ones (L388-391)

### finalize Class (L540-674)
Provides object finalization callbacks that run when objects are garbage collected, similar to destructors.

**Architecture:**
- Uses class-level `_registry` dict to map finalizer objects to `_Info` instances (L559)
- `_Info` inner class (L565-566) stores weakref, callback function, args, kwargs, and metadata
- `_index_iter` provides ordering for exit-time finalization (L561)
- Registers with `atexit` for cleanup during program shutdown (L572-574)

**Key Methods:**
- `__init__` (L568-583): Creates finalizer with weak reference to target object
- `__call__` (L585-590): Executes callback and marks finalizer as dead
- `detach()`/`peek()` (L592-606): Provide access to finalizer state without triggering
- `_exitfunc()` (L642-674): Class method handling shutdown finalization with GC management

## Critical Patterns

### Thread Safety
- Uses `_remove_dead_weakref` atomic operation for safe concurrent removal
- `_IterationGuard` prevents modification during iteration
- Pending removals pattern defers cleanup during iteration

### Memory Management
- Self-weakref trick in `WeakMethod` prevents reference cycles (L65)
- Finalizer objects have no state (`__slots__ = ()`) to avoid cycles (L558)
- GC is disabled during shutdown finalization to prevent interference (L650-652)

### Callback Architecture
- Removal callbacks use `selfref=ref(self)` pattern to avoid keeping container alive
- `KeyedRef` optimization reduces callback function creation overhead
- Finalizer callbacks can create new finalizers, handled by `_dirty` flag (L655-657)

## Dependencies
- `_weakref`: Core C extension providing basic weak reference types
- `_weakrefset`: Provides `WeakSet` and iteration guard utilities
- `_collections_abc`: Abstract base classes for container protocols
- `sys`, `itertools`, `copy`: Standard library utilities