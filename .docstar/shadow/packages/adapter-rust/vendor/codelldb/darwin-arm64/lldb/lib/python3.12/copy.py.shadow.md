# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/copy.py
@source-hash: cbd25547933176fc
@generated: 2026-02-09T18:07:01Z

## Primary Purpose
Python's standard library copy module implementing shallow and deep copying operations for arbitrary Python objects. This is a vendor-provided copy within the LLDB debugger environment.

## Core Public API
- `copy(x)` (L61-98): Performs shallow copy by creating new compound object with same object references
- `deepcopy(x, memo=None, _nil=[])` (L118-168): Performs deep copy by recursively copying all nested objects
- `Error` (L55-56): Exception class for copy operation failures

## Key Implementation Components

### Dispatch Systems
- `_copy_dispatch` (L100): Registry mapping types to shallow copy functions
- `_deepcopy_dispatch` (L170): Registry mapping types to deep copy functions

### Type-Specific Handlers
- `_copy_immutable(x)` (L102-103): Returns object unchanged for immutable types
- `_deepcopy_atomic(x, memo)` (L172-173): Returns object unchanged for atomic types
- `_deepcopy_list(x, memo, deepcopy=deepcopy)` (L191-198): Deep copies lists
- `_deepcopy_tuple(x, memo, deepcopy=deepcopy)` (L200-215): Optimized tuple deep copying with immutability detection
- `_deepcopy_dict(x, memo, deepcopy=deepcopy)` (L217-223): Deep copies dictionaries
- `_deepcopy_method(x, memo)` (L225-227): Copies instance methods

### Memory Management
- `_keep_alive(x, memo)` (L231-245): Prevents temporary objects from being garbage collected during deep copy
- `_reconstruct(x, memo, func, args, ...)` (L247-290): General object reconstruction supporting state restoration and iterators

## Copy Strategy Hierarchy
1. Built-in dispatch table lookup
2. Class-specific `__copy__`/`__deepcopy__` methods
3. Pickle protocol (`__reduce_ex__`, `__reduce__`)
4. Fallback error for uncopyable objects

## Architecture Notes
- Uses memo dictionary (object id → copy mapping) to handle circular references in deepcopy
- Leverages pickle protocol for objects without explicit copy support
- Optimizes immutable types by returning original objects
- Supports custom copy behavior via dunder methods