# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/_weakrefset.py
@source-hash: 91895a451d06e9f5
@generated: 2026-02-09T18:12:47Z

## Primary Purpose
Implements a WeakSet data structure that stores weak references to objects, allowing automatic garbage collection of unreferenced items. This is a minimal implementation separated from the main weakref module to avoid circular dependencies during Python startup.

## Key Classes and Functions

### _IterationGuard (L11-34)
Context manager that delays removal operations during set iteration to prevent iterator invalidation. Uses a weak reference to the container to avoid cycles (L19). Registers itself in the container's `_iterating` set on entry (L24) and triggers pending removals on exit (L33).

### WeakSet (L36-205)
Main weak reference set implementation that mimics Python's built-in set interface.

**Core Structure:**
- `data`: Internal set storing weak references (L38)
- `_remove`: Callback function for automatic cleanup when referenced objects are deleted (L39-46)
- `_pending_removals`: Queue of items to remove during iteration (L48)
- `_iterating`: Set of active iteration guards (L49)

**Key Methods:**
- `__init__(data=None)` (L37-51): Initializes with optional data, sets up cleanup callback
- `_commit_removals()` (L53-61): Processes pending removals queue
- `__iter__()` (L63-70): Protected iteration using _IterationGuard, yields live objects only
- `__len__()` (L72-73): Returns count minus pending removals
- `__contains__(item)` (L75-80): Membership test using weak reference lookup
- `add(item)` (L85-88): Adds weak reference with cleanup callback
- `pop()` (L98-108): Removes and returns arbitrary live item, handles dead references

**Set Operations:**
All standard set operations implemented with weak reference semantics:
- Difference: `difference()` (L130-133), `__sub__` alias (L134)
- Intersection: `intersection()` (L147-148), `__and__` alias (L149) 
- Union: `union()` (L195-196), `__or__` alias (L197)
- Symmetric difference: `symmetric_difference()` (L178-181), `__xor__` alias (L182)
- Subset/superset comparisons: `issubset()` (L159), `issuperset()` (L166)

## Dependencies
- `_weakref.ref`: Core weak reference implementation
- `types.GenericAlias`: For generic type support (L205)

## Architectural Patterns
- **Deferred cleanup**: Removals are deferred during iteration and batched for efficiency
- **Weak reference callbacks**: Automatic cleanup when referenced objects are deleted
- **Context manager protection**: _IterationGuard prevents concurrent modification during iteration
- **Cycle avoidance**: Uses weak references in callback closure to prevent memory leaks

## Critical Invariants
- `_pending_removals` must be processed before most operations to maintain consistency
- `_iterating` set tracks active iterators to coordinate safe removal timing
- All items stored as weak references in `data` set, never strong references
- Callback function uses weak self-reference to avoid keeping WeakSet alive