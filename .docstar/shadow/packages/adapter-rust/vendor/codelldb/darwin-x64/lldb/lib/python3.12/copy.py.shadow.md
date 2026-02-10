# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/copy.py
@source-hash: cbd25547933176fc
@generated: 2026-02-09T18:08:17Z

## Core Purpose
Standard Python `copy` module providing generic shallow and deep copying operations for arbitrary Python objects. This is a vendor copy within the LLDB debugger's Python environment.

## Main API Functions

### `copy(x)` (L61-98)
Performs shallow copying using a dispatch-based approach:
1. Checks `_copy_dispatch` table for type-specific copiers
2. Handles type objects specially via `_copy_immutable` 
3. Falls back to `__copy__` method if defined on object
4. Uses pickle protocol (`__reduce_ex__`, `__reduce__`) as final fallback
5. Reconstructs object using `_reconstruct` helper

### `deepcopy(x, memo=None)` (L118-168) 
Performs deep copying with cycle detection:
- Uses `memo` dict to track already-copied objects by ID
- Follows similar dispatch pattern as `copy()` but recursively copies contents
- Checks `_deepcopy_dispatch` table first
- Falls back to `__deepcopy__` method, then pickle protocol
- Calls `_keep_alive()` to prevent GC issues with temporary objects

## Core Data Structures

### `_copy_dispatch` (L100-116)
Dispatch table mapping types to shallow copy functions:
- Immutable types → `_copy_immutable` (returns same object)
- Collections (list, dict, set, bytearray) → use built-in `.copy()` methods

### `_deepcopy_dispatch` (L170-229) 
Dispatch table for deep copy operations:
- Atomic types → `_deepcopy_atomic` (L172-189)
- Collections → specialized functions (`_deepcopy_list`, `_deepcopy_tuple`, `_deepcopy_dict`)
- Methods → `_deepcopy_method` (L225-227)

## Key Helper Functions

### `_reconstruct(x, memo, func, args, ...)` (L247-290)
Universal object reconstruction function supporting:
- Constructor args deep-copying when `memo` present
- State restoration via `__setstate__` or direct `__dict__` update  
- List/dict iteration for container reconstruction
- Handles both shallow and deep copy contexts

### `_keep_alive(x, memo)` (L231-245)
Prevents garbage collection of temporary objects during deep copying by storing references in memo dict keyed by memo's own ID.

## Architecture
- **Dispatch Pattern**: Both copy functions use type-based dispatch tables for performance
- **Protocol Support**: Integrates with pickle protocol (`__reduce__`, `__reduce_ex__`) and copy protocol (`__copy__`, `__deepcopy__`)
- **Cycle Detection**: Deep copy uses object ID memoization to handle recursive references
- **Fallback Chain**: Clear hierarchy from built-in handlers → custom methods → pickle protocol

## Error Handling
- `Error` exception class (L55-56) with backward-compatible `error` alias (L57)
- Raises descriptive errors for uncopyable objects