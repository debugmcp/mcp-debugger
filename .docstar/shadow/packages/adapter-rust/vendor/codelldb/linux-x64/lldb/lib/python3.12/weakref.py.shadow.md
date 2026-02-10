# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/weakref.py
@source-hash: 56f8d313fb74019e
@generated: 2026-02-09T18:10:24Z

## Python weakref module - Weak reference support

Standard library module providing weak reference functionality per PEP 205. Enables object references that don't prevent garbage collection of the referenced object.

### Core Imports and Exports
- Imports from `_weakref` C extension: `ref`, `proxy`, utilities (L12-20)
- Imports `WeakSet` from `_weakrefset` (L22)
- Key exports: `WeakKeyDictionary`, `WeakValueDictionary`, `WeakMethod`, `finalize` (L30-33)

### WeakMethod Class (L38-90)
Specialized weak reference for bound methods, solving the lifetime problem where bound methods are immediately garbage collected. 

**Key features:**
- `__new__` method extracts `__self__` and `__func__` from bound method (L46-66)
- Maintains separate weak refs to object and function via `_func_ref` and `_alive` flag
- Custom equality/inequality operators check both object and function refs (L75-87)
- Returns reconstructed bound method on call or None if either ref is dead (L68-73)

### WeakValueDictionary Class (L92-333)
Dictionary where values are held by weak references, automatically removing entries when values are garbage collected.

**Core mechanics:**
- `data` dict stores `KeyedRef` objects as values (L118)
- `_remove` callback handles async cleanup, using `_pending_removals` during iteration (L105-114)
- `_commit_removals` processes pending deletions atomically (L121-131)
- All mutation methods call `_commit_removals` first to maintain consistency

**Key methods:**
- `__setitem__` wraps values in `KeyedRef` with removal callback (L164-167)
- `copy`/`__deepcopy__` use `_IterationGuard` for safe iteration (L169-192)
- `items`/`keys`/`values` yield only live references (L209-250)
- Union operators `__or__`/`__ror__` support dict merging (L319-332)

### KeyedRef Class (L335-354)
Specialized reference subclass that stores an associated key, used internally by `WeakValueDictionary` to avoid creating callback closures for each entry.

### WeakKeyDictionary Class (L356-537)
Dictionary where keys are held by weak references, automatically removing entries when keys are garbage collected.

**Key differences from WeakValueDictionary:**
- Uses `ref(key)` as internal dict keys instead of wrapping values (L412, L428)
- `_dirty_len` flag tracks when length calculation needs update (L383, L411)
- `_scrub_removals` cleans up stale pending removals (L405-408)
- Length calculation subtracts pending removals count (L417-422)

### finalize Class (L540-674)
Provides object finalization callbacks that run when objects are garbage collected, with support for atexit cleanup.

**Architecture:**
- Uses global `_registry` dict mapping finalizer instances to `_Info` objects (L559)
- `_Info` inner class stores weakref, callback, args, and metadata (L565-566)
- Finalizers act as registry keys to avoid reference cycles (L554-556)

**Key methods:**
- `__init__` registers callback and sets up atexit handler on first use (L568-583)
- `__call__` executes and removes finalizer if still alive (L585-590)
- `detach`/`peek` allow inspection/removal without execution (L592-606)
- `_exitfunc` class method runs remaining finalizers at program exit (L642-674)

**Exit handling:**
- Disables GC during shutdown finalization to prevent new finalizers (L650-652)
- Processes finalizers in creation order, handling exceptions gracefully (L654-669)
- Sets `_shutdown` flag to prevent execution after program exit begins (L672)

### Architectural Patterns
- Extensive use of weak reference callbacks for automatic cleanup
- `_IterationGuard` context manager prevents mutation during iteration
- Atomic removal operations handle concurrent access from GC
- Deferred cleanup via pending removal lists for iteration safety