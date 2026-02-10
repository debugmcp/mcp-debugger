# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/_weakrefset.py
@source-hash: 91895a451d06e9f5
@generated: 2026-02-09T18:07:32Z

## Primary Purpose
A weak reference set implementation that automatically removes items when they are garbage collected. This is a separated module required by abc.py during startup to avoid circular import dependencies.

## Key Classes and Functions

### _IterationGuard (L11-34)
Context manager that prevents concurrent modification during iteration by:
- Registering itself in the WeakSet's `_iterating` set on entry (L21-25)
- Deferring removals until iteration completes (L27-34)
- Using weak reference to parent container to avoid cycles (L17-19)

### WeakSet (L36-205)
Main weak reference set implementation with sophisticated removal handling:

**Core State Management:**
- `data`: Internal set storing weak references (L38)
- `_pending_removals`: List of items to remove when safe (L48)
- `_iterating`: Set of active iteration guards (L49)
- `_remove`: Callback for automatic cleanup (L39-46)

**Key Methods:**
- `__init__` (L37-51): Sets up removal callback using closure to avoid cycles
- `_commit_removals` (L53-61): Processes pending removals in batch
- `__iter__` (L63-70): Protected iteration with _IterationGuard
- `add` (L85-88): Adds weak reference with removal callback
- Set operations: `union`, `intersection`, `difference`, etc. (L147-197)

## Dependencies
- `_weakref.ref`: Core weak reference implementation
- `types.GenericAlias`: For generic type support (L205)

## Architecture Patterns

**Deferred Removal Pattern:**
All mutating operations check `_pending_removals` and call `_commit_removals()` before proceeding to maintain consistency during concurrent iteration.

**Weak Reference Lifecycle:**
Items are stored as `ref(item, self._remove)` where `_remove` automatically handles cleanup when objects are garbage collected. The callback uses a weak reference to self to prevent cycles.

**Thread Safety Considerations:**
Uses set operations which are relatively thread-safe, with iteration guards providing additional protection against concurrent modification.

## Critical Invariants
1. `len(self)` returns `len(self.data) - len(self._pending_removals)` (L72-73)
2. During iteration, removals are deferred to `_pending_removals`
3. All mutating operations must process pending removals first
4. Weak references prevent memory leaks and cycles