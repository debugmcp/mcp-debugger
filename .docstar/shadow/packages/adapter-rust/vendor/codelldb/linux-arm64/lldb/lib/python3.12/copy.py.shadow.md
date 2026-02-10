# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/copy.py
@source-hash: cbd25547933176fc
@generated: 2026-02-09T18:08:37Z

**Purpose**: Python's standard library copy module providing generic shallow and deep copying operations for arbitrary Python objects.

## Core Functions

**copy(x) (L61-98)**: Performs shallow copying using dispatch table lookup, custom `__copy__` methods, or pickle protocol fallback. Returns new compound objects containing references to original nested objects.

**deepcopy(x, memo=None) (L118-168)**: Performs deep copying with cycle detection via memo dictionary. Recursively copies all nested objects, handling circular references by tracking object IDs.

## Exception Handling
**Error (L55-56)**: Custom exception for uncopyable objects. Legacy alias `error` provided for backward compatibility (L57).

## Dispatch Tables

**_copy_dispatch (L100)**: Maps types to shallow copy functions:
- Immutable types → `_copy_immutable` (returns self) (L102-109)  
- Mutable collections → native copy methods (L111-114)

**_deepcopy_dispatch (L170)**: Maps types to deep copy functions:
- Atomic types → `_deepcopy_atomic` (returns self) (L172-189)
- Collections → specialized deepcopy functions (L191-227)

## Key Deep Copy Handlers

**_deepcopy_list (L191-198)**: Creates new list, memoizes immediately, then recursively deepcopies elements.

**_deepcopy_tuple (L200-215)**: Optimizes by returning original tuple if no nested objects changed after deepcopy.

**_deepcopy_dict (L217-223)**: Creates new dict, memoizes, then recursively deepcopies keys and values.

**_deepcopy_method (L225-227)**: Special handling for bound methods by copying the underlying function and bound instance.

## Utility Functions

**_keep_alive (L231-245)**: Prevents garbage collection of temporary objects during deepcopy by storing references in memo at memo's own ID.

**_reconstruct (L247-290)**: Universal object reconstruction function handling both shallow and deep copying scenarios. Supports state restoration via `__setstate__`, slot state, list/dict extension.

## Architecture Notes

- Uses pickle protocol as fallback (`__reduce_ex__`, `__reduce__`) for unknown types
- Memo dictionary prevents infinite recursion and ensures object identity preservation  
- Dispatch table pattern enables efficient type-specific copying strategies
- Supports custom copying via `__copy__` and `__deepcopy__` methods
- Integrates with copyreg module for extensible type registration