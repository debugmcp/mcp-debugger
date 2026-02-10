# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/weakref.py
@source-hash: 56f8d313fb74019e
@generated: 2026-02-09T18:14:31Z

## Primary Purpose
Core Python weakref module implementation providing weak reference support for Python objects. Implements PEP 205 specification for memory management without creating reference cycles.

## Key Classes and Functions

### WeakMethod (L38-90)
Custom weakref.ref subclass that creates weak references to bound methods. Solves the lifetime problem where bound methods are immediately garbage collected since they're temporary objects.

**Key features:**
- `__new__` (L46-66): Extracts object and function from bound method, creates callback chain
- `__call__` (L68-73): Reconstructs bound method from weakly-referenced components
- `__eq__`/`__ne__` (L75-87): Compares both object and function references
- Uses `_alive` flag to track validity state

### WeakValueDictionary (L92-333)
Dictionary that holds weak references to values, automatically removing entries when values are garbage collected.

**Core mechanisms:**
- `_remove` callback (L105-114): Handles automatic cleanup when values die
- `_pending_removals` (L116): Defers cleanup during iteration to avoid modification errors
- `_commit_removals` (L121-131): Processes deferred removals atomically
- All mutation operations check and commit pending removals first

**Key methods:**
- `__getitem__` (L133-140): Returns actual object or raises KeyError if dead
- `__setitem__` (L164-167): Wraps values in KeyedRef with cleanup callback
- Iteration methods (L209-250): Use _IterationGuard to manage concurrent modification
- `valuerefs`/`itervaluerefs` (L228-241, L301-313): Direct access to weak references

### KeyedRef (L335-354)
Specialized ref subclass that stores an additional key attribute. Used by WeakValueDictionary to avoid creating separate callback functions for each entry.

### WeakKeyDictionary (L356-537)
Dictionary that holds weak references to keys instead of values. Entries automatically removed when keys are garbage collected.

**Differences from WeakValueDictionary:**
- Uses `_dirty_len` flag (L383) to optimize length calculations
- `_scrub_removals` (L405-408): Cleans up pending removals list
- Key-based operations create temporary ref objects for lookups

### finalize (L540-674)
Class-based finalizer system for executing cleanup code when objects are garbage collected.

**Architecture:**
- `_Info` nested class (L565-566): Stores finalizer metadata
- `_registry` (L559): Maps finalizer objects to their info
- `_exitfunc` (L642-674): Runs remaining finalizers at program exit
- Thread-safe registration with atexit module

**Key methods:**
- `__init__` (L568-583): Registers finalizer with object's weakref
- `__call__` (L585-590): Executes finalizer function once
- `detach` (L592-598): Removes finalizer and returns original data
- `alive` property (L609-611): Checks if finalizer is still active

## Dependencies
- `_weakref` module: Core C implementation (ref, proxy, getweakrefcount, etc.)
- `_weakrefset`: WeakSet implementation and _IterationGuard
- `_collections_abc`: Abstract base classes for mapping interfaces
- Standard modules: sys, itertools, copy (lazily imported)

## Architecture Patterns
- **Callback-based cleanup**: All weak reference containers use callback functions for automatic cleanup
- **Deferred removal**: Pending removal lists prevent modification during iteration
- **Atomic operations**: Uses _remove_dead_weakref for thread-safe cleanup
- **Guard-based iteration**: _IterationGuard prevents container modification during iteration
- **Registry pattern**: finalize uses centralized registry for managing finalizers

## Critical Invariants
- Weak reference callbacks must not create reference cycles
- Pending removals must be committed before mutation operations
- Finalizers execute at most once
- Dead weak references never equal live ones
- All public APIs handle dead references gracefully