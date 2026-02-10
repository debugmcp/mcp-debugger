# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/_weakrefset.py
@source-hash: 91895a451d06e9f5
@generated: 2026-02-09T18:07:03Z

## Purpose
Core implementation of `WeakSet` - a set-like container holding weak references to objects. Separated into its own module for early import by abc.py during Python startup. Provides thread-safe iteration with deferred garbage collection cleanup.

## Key Classes

### _IterationGuard (L11-34)
Context manager that protects WeakSet during iteration by deferring removal operations.
- `__init__(self, weakcontainer)` (L17-19): Stores weak reference to container to avoid cycles
- `__enter__(self)` (L21-25): Registers guard in container's `_iterating` set
- `__exit__(self, e, t, b)` (L27-33): Removes guard and commits pending removals if no other iterators active

### WeakSet (L36-205)
Main weak reference set implementation mimicking Python's built-in set interface.

**Core State:**
- `data` (L38): Internal set storing weak references (not objects directly)
- `_remove` (L39-46): Callback function for automatic cleanup when objects are garbage collected
- `_pending_removals` (L48): List of items to remove after iteration completes
- `_iterating` (L49): Set of active _IterationGuard instances

**Key Methods:**
- `__init__(self, data=None)` (L37-51): Initializes with cleanup callback using closure pattern
- `_commit_removals(self)` (L53-61): Processes all pending removals after iteration ends
- `__iter__(self)` (L63-70): Thread-safe iteration using _IterationGuard context manager
- `__len__(self)` (L72-73): Returns count minus pending removals
- `__contains__(self, item)` (L75-80): Membership testing via weak reference lookup

**Set Operations:**
- `add(self, item)` (L85-88): Adds weak reference with removal callback
- `remove(self, item)` (L110-113): Removes item, raises KeyError if missing
- `discard(self, item)` (L115-118): Removes item silently if present
- `pop(self)` (L98-108): Removes and returns arbitrary item, handling dead references
- Set arithmetic operations (L130-197): union (`|`), intersection (`&`), difference (`-`), symmetric difference (`^`)

## Dependencies
- `_weakref.ref`: Core weak reference implementation
- `types.GenericAlias`: Enables generic type hints (L205)

## Architectural Patterns

**Deferred Cleanup**: During iteration, removals are deferred to `_pending_removals` list and processed when iteration completes, preventing modification-during-iteration errors.

**Weak Reference Callbacks**: Each added item gets weak reference with `_remove` callback that handles automatic cleanup when objects are garbage collected.

**Thread Safety**: Uses context manager pattern with _IterationGuard to coordinate between multiple iterators, though not fully thread-safe for concurrent modifications.

**Cycle Avoidance**: Careful use of weak references in callbacks and guards to prevent reference cycles that would defeat garbage collection.

## Critical Invariants
1. All items in `data` are weak references, never direct object references
2. During iteration, removals must be deferred to maintain iterator stability  
3. `_commit_removals()` must be called before mutations when `_pending_removals` is non-empty
4. Weak reference callbacks must not create strong references back to the WeakSet