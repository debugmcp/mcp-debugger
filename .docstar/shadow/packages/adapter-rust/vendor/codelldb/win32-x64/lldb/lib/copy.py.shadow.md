# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/copy.py
@source-hash: cbd25547933176fc
@generated: 2026-02-09T18:14:26Z

## Core Purpose
Standard Python `copy` module providing shallow and deep copying operations for arbitrary Python objects. Part of the Python standard library, handles object duplication with cycle detection and customization hooks.

## Key Functions

### `copy(x)` (L61-97)
Performs shallow copying using dispatch table pattern:
- First checks `_copy_dispatch` table for type-specific copiers (L69-71)
- Falls back to `__copy__` method if available (L77-79)
- Uses pickle reduction protocol (`__reduce_ex__`, `__reduce__`) as final fallback (L81-93)
- Returns original object for immutable types, new container for mutable types

### `deepcopy(x, memo=None, _nil=[])` (L118-168)
Performs recursive deep copying with cycle detection:
- Uses `memo` dict to track already-copied objects by `id()` to prevent infinite recursion (L124-130)
- Similar dispatch pattern to `copy()` but checks `_deepcopy_dispatch` table (L134-136)
- Supports `__deepcopy__` method for custom deep copy behavior (L141-143)
- Memoizes results to maintain object identity relationships (L165-167)

### `_reconstruct(x, memo, func, args, ...)` (L247-290)
Generic reconstruction function used by both copy methods:
- Calls constructor function with deep-copied args if needed (L251-253)
- Handles object state restoration via `__setstate__` or direct `__dict__` update (L257-271)
- Processes list/dict iterators for container types (L273-289)

## Type-Specific Handlers

### Dispatch Tables
- `_copy_dispatch` (L100): Maps types to shallow copy functions
- `_deepcopy_dispatch` (L170): Maps types to deep copy functions

### Immutable Types (L102-109, L172-189)
Both tables map immutable types to identity functions that return the original object:
- Basic types: `int`, `float`, `str`, `tuple`, `frozenset`, etc.
- Function types: `types.FunctionType`, `types.BuiltinFunctionType`
- Special objects: `types.NoneType`, `types.EllipsisType`

### Mutable Container Handlers
- `_deepcopy_list` (L191-197): Creates new list, deep copies each element
- `_deepcopy_tuple` (L200-214): Optimized tuple copying with identity preservation
- `_deepcopy_dict` (L217-222): Deep copies both keys and values
- `_deepcopy_method` (L225-226): Handles bound method copying

## Key Patterns

### Dispatch-Based Architecture
Uses type-to-function mapping for extensible copying behavior, allowing efficient type-specific optimizations.

### Cycle Detection
Deep copy uses object identity tracking via `memo[id(x)]` to handle recursive data structures without infinite loops.

### Protocol Support
Integrates with Python's pickle protocol (`__reduce__`, `__reduce_ex__`) and custom copy protocols (`__copy__`, `__deepcopy__`).

### Memory Management
`_keep_alive(x, memo)` (L231-245) ensures temporary objects remain referenced during copying to prevent premature garbage collection.

## Dependencies
- `types`: Access to built-in type objects
- `weakref`: Weak reference support
- `copyreg`: Pickle dispatch table integration

## Error Handling
- `Error` exception class (L55) for copy-related failures
- Graceful fallback chain from specialized to generic copying methods