# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/weakref.py
@source-hash: 56f8d313fb74019e
@generated: 2026-02-09T18:07:33Z

## Primary Purpose
Python's weakref module implementation providing weak reference support per PEP 205. Enables references to objects without preventing garbage collection, with specialized collections and finalization mechanisms.

## Core Dependencies
- `_weakref` module: Core weak reference functionality (L12-20)
- `_weakrefset`: WeakSet implementation and iteration guards (L22)
- `_collections_abc`: Abstract base classes for collections (L24)

## Key Classes and Functions

### WeakMethod (L38-90)
Custom `weakref.ref` subclass for bound methods. Solves the lifetime problem where bound methods are immediately garbage collected.
- `__new__` (L46-66): Creates weak references to both object and function components
- `__call__` (L68-73): Reconstructs bound method from weak references
- `__eq__`/`__ne__` (L75-87): Equality comparison accounting for liveness

### WeakValueDictionary (L92-333)
Mapping that holds weak references to values. Values are automatically removed when no strong references exist.
- `__init__` (L104-119): Sets up removal callback and deferred cleanup system
- `_commit_removals` (L121-131): Processes pending removals atomically
- Deferred cleanup pattern: All operations check `_pending_removals` before proceeding
- Thread-safe removal via `_atomic_removal` from `_weakref` module

### KeyedRef (L335-354)
Specialized weak reference storing an associated key, used internally by WeakValueDictionary to avoid closure creation overhead.

### WeakKeyDictionary (L356-538)
Mapping that holds weak references to keys. Keys are automatically removed when no strong references exist.
- Different removal strategy than WeakValueDictionary: uses `_dirty_len` flag for length tracking
- `_scrub_removals` (L405-408): Cleans stale entries from pending removals list

### finalize (L540-674)
Finalization system for executing cleanup code when objects are garbage collected.
- Class-level registry pattern: `_registry` maps finalizer instances to `_Info` objects
- `_Info` nested class (L565-566): Stores weakref, function, args, kwargs, and metadata
- `_exitfunc` (L642-674): Executes remaining finalizers at program shutdown with GC disabled
- `_select_for_exit` (L635-639): Orders finalizers by creation index for deterministic shutdown

## Architectural Patterns

### Deferred Cleanup Pattern
Both dictionary classes use pending removal lists to defer cleanup during iteration, preventing modification during traversal.

### Self-Reference Avoidance
WeakMethod uses self-weakref trick (L56, L65) to prevent reference cycles in callbacks.

### Registry Pattern
`finalize` class uses class-level registry with instance keys to avoid reference cycles while maintaining state.

### Atomic Operations
Uses `_remove_dead_weakref` for thread-safe dictionary modifications during GC callbacks.

## Critical Invariants
- Weak references never prevent garbage collection of referenced objects
- Callback functions must not create strong references to the container
- Finalizers execute in reverse creation order during shutdown
- Dictionary operations are atomic with respect to GC-triggered removals