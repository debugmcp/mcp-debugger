# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/_weakrefset.py
@source-hash: 91895a451d06e9f5
@generated: 2026-02-09T18:09:22Z

## Primary Purpose
Implements `WeakSet` - a set-like container that holds weak references to objects, allowing them to be garbage collected even while in the set. Separated from main `weakref` module to avoid circular dependencies during Python startup (L1-3).

## Key Classes and Functions

### _IterationGuard (L11-34)
Context manager that prevents object removal during iteration by:
- Registering itself in the container's `_iterating` set (L24)
- Deferring removals via `_commit_removals()` when exiting (L33)
- Using weak reference to container to avoid cycles (L19)

### WeakSet (L36-205)
Thread-safe set implementation using weak references with deferred removal pattern:

**Core State (L37-51):**
- `data`: Set of weak references to actual objects (L38)
- `_remove`: Callback for weak reference cleanup (L39-46)
- `_pending_removals`: Queue for deferred removals during iteration (L48)
- `_iterating`: Set tracking active iterators (L49)

**Key Methods:**
- `__iter__` (L63-70): Uses `_IterationGuard` to safely iterate, yielding strong refs
- `__len__` (L72-73): Returns count minus pending removals
- `__contains__` (L75-80): Checks membership using weak reference
- `add` (L85-88): Commits pending removals, adds weak ref with callback
- `_commit_removals` (L53-61): Processes deferred removal queue

**Set Operations:**
- Standard set operations (`union`, `intersection`, `difference`, etc.) with weak reference handling
- Operator overloads (`__or__`, `__and__`, `__sub__`, `__xor__`) map to corresponding methods
- Comparison operations convert other collections to weak reference sets

## Critical Patterns

**Deferred Removal System:**
During iteration, objects are queued in `_pending_removals` rather than immediately removed from `data`, preventing iteration corruption.

**Weak Reference Callback:**
The `_remove` closure (L39-46) handles automatic cleanup when referenced objects are garbage collected, respecting the iteration guard.

**Thread Safety:**
Relies on Python set operations being thread-safe, with the iteration guard providing additional protection during traversal.

## Dependencies
- `_weakref.ref`: Core weak reference implementation
- `types.GenericAlias`: For generic type hinting support (L205)