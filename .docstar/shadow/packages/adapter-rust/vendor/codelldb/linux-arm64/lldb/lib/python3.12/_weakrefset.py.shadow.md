# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/_weakrefset.py
@source-hash: 91895a451d06e9f5
@generated: 2026-02-09T18:08:31Z

## Purpose
Implements `WeakSet` - a set-like container that holds weak references to objects, automatically removing them when the referenced objects are garbage collected. Separated from main weakref module for early loading during Python startup.

## Key Classes

### `_IterationGuard` (L11-34)
Context manager that protects weak containers during iteration by deferring removals until iteration completes.
- `__init__(L17-19)`: Stores weak reference to container to avoid cycles
- `__enter__(L21-25)`: Registers guard in container's `_iterating` set
- `__exit__(L27-34)`: Removes guard and commits pending removals if no other iterators active

### `WeakSet` (L36-205)
Thread-safe set implementation using weak references with deferred removal during iteration.

**Core State:**
- `data` (L38): Internal set storing weak references
- `_remove` (L39-46): Callback for automatic removal when objects are GC'd
- `_pending_removals` (L48): List of items to remove after iteration
- `_iterating` (L49): Set of active iteration guards

**Key Methods:**
- `__init__(L37-51)`: Sets up internal structures and optional initial data
- `_commit_removals(L53-61)`: Processes pending removals queue
- `__iter__(L63-70)`: Protected iteration yielding live objects only
- `add(L85-88)`: Adds weak reference with removal callback
- Set operations: `union(L195)`, `intersection(L147)`, `difference(L130)`, etc.

## Architecture Patterns

**Deferred Removal Pattern**: During iteration, removals are queued in `_pending_removals` rather than modifying the underlying set immediately, preventing iteration corruption.

**Weak Reference Management**: All objects stored as weak references with automatic cleanup callbacks that respect the iteration deferral mechanism.

**Thread Safety**: Leverages Python set thread-safety and careful weak reference handling for concurrent access protection.

## Dependencies
- `_weakref.ref`: Core weak reference implementation
- `types.GenericAlias`: For generic type support

## Critical Invariants
- Objects must be weakly referenceable (raises TypeError in `__contains__` L78 if not)
- Pending removals always committed before mutating operations
- Iterator guards prevent data structure modification during iteration
- Weak reference callbacks handle both immediate and deferred removal scenarios