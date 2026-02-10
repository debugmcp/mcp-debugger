# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/weakref.py
@source-hash: 56f8d313fb74019e
@generated: 2026-02-09T18:08:25Z

## Primary Purpose
Python's weak reference support implementation (PEP 205). Provides weak references to objects that don't prevent garbage collection, along with specialized dictionary types and finalization utilities for memory management and cleanup.

## Key Dependencies
- `_weakref`: Core weak reference implementation (L12-20)
- `_weakrefset`: WeakSet and _IterationGuard utilities (L22)
- `_collections_abc`: Abstract base classes for mapping interfaces (L24)
- `sys`, `itertools`: Standard library utilities (L25-26)

## Core Classes

### WeakMethod (L38-90)
Simulates weak references to bound methods, solving the lifetime problem where bound methods are immediately garbage collected.
- `__new__` (L46-66): Creates weak refs to both object and function components
- `__call__` (L68-73): Reconstructs the bound method if both components are alive
- `__eq__`/`__ne__` (L75-87): Compares both object and function references
- Uses `_alive` flag and callback mechanism to track method lifecycle

### WeakValueDictionary (L92-333)
Dictionary that weakly references values. Values are automatically removed when no strong references exist.
- `__init__` (L104-119): Sets up removal callback and pending removal tracking
- `_commit_removals` (L121-131): Processes delayed removals atomically
- `_remove` callback (L105): Handles asynchronous garbage collection cleanup
- `_pending_removals`: Deferred cleanup list for iteration safety (L116)
- `_iterating`: Set tracking active iterations to prevent modification (L117)
- Uses `KeyedRef` instances to store values with associated keys

### KeyedRef (L335-354)
Specialized weak reference that includes a key attribute for efficient WeakValueDictionary callbacks.
- `__new__` (L347-350): Creates ref with attached key
- Avoids creating closure functions for each dictionary entry

### WeakKeyDictionary (L356-537)
Dictionary that weakly references keys. Entries are removed when key objects are garbage collected.
- `__init__` (L367-385): Sets up removal callback and state tracking
- `_commit_removals` (L387-403): Cleans up dead key references
- `_scrub_removals` (L405-408): Removes already-deleted keys from pending list
- `_dirty_len`: Flag indicating length calculation needs cleanup (L383)
- Key operations use `ref(key)` as internal dictionary keys

### finalize (L540-674)
Finalizer system for cleanup when objects are garbage collected.
- `_registry`: Global registry mapping finalizers to _Info objects (L559)
- `_Info` nested class (L565-566): Stores weakref, function, args, kwargs, atexit flag
- `__init__` (L568-583): Registers finalizer with atexit handling
- `__call__` (L585-590): Executes cleanup function once
- `_exitfunc` (L642-674): Runs remaining finalizers at program exit
- Uses `_shutdown` flag to prevent execution during interpreter shutdown

## Key Patterns
- Callback-based cleanup: All weak reference types use callbacks for automatic cleanup
- Deferred removal: Operations are deferred during iteration to maintain consistency
- _IterationGuard context manager: Prevents concurrent modification during iteration
- Atomic operations: Uses `_remove_dead_weakref` for thread-safe cleanup
- Registry pattern: `finalize` uses global registry for lifecycle management

## Critical Invariants
- Weak references don't prevent garbage collection of referenced objects
- Cleanup callbacks must not create reference cycles
- Iteration safety requires deferred modifications via pending removal lists
- Finalizers execute in reverse creation order at exit