# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/copy.py
@source-hash: cbd25547933176fc
@generated: 2026-02-09T18:09:38Z

## Purpose
Python standard library module implementing generic shallow and deep copying operations. Core implementation of `copy.copy()` and `copy.deepcopy()` functions with extensible dispatch mechanisms for type-specific copying behavior.

## Key Components

### Public API
- **`copy(x)` (L61-97)**: Main shallow copy function. Uses dispatch table lookup, then tries `__copy__`, then pickle protocols (`__reduce_ex__`/`__reduce__`). Preserves object identity for immutable types.
- **`deepcopy(x, memo=None)` (L118-168)**: Main deep copy function with cycle detection via memo dictionary. Recursively copies compound objects while maintaining reference tracking to prevent infinite loops.
- **`Error` class (L55-57)**: Exception raised for uncopyable objects. Has backward compatibility alias `error`.

### Dispatch Architecture
- **`_copy_dispatch` (L100)**: Dictionary mapping types to shallow copy functions. Populated with immutable type handlers and built-in collection copy methods.
- **`_deepcopy_dispatch` (L170)**: Dictionary mapping types to deep copy functions. Contains atomic handlers and specialized functions for collections.

### Type-Specific Handlers
- **`_copy_immutable(x)` (L102-103)**: Returns object unchanged for immutable types (None, int, str, tuple, etc.)
- **`_deepcopy_atomic(x, memo)` (L172-173)**: Deep copy handler for atomic/immutable types
- **`_deepcopy_list(x, memo)` (L191-198)**: Specialized list deep copying with memo registration
- **`_deepcopy_tuple(x, memo)` (L200-215)**: Tuple handler that optimizes for unchanged elements
- **`_deepcopy_dict(x, memo)` (L217-223)**: Dictionary deep copying with key/value recursion
- **`_deepcopy_method(x, memo)` (L225-227)**: Instance method copying

### Support Functions
- **`_keep_alive(x, memo)` (L231-245)**: Prevents garbage collection of temporary objects during deep copying by storing references in memo
- **`_reconstruct(x, memo, func, args, ...)` (L247-290)**: Generic object reconstruction supporting state restoration, list/dict iteration, and slot attributes

## Architecture Patterns
- **Dispatch Table Pattern**: Both copy operations use type-based dispatch for extensibility
- **Memo Pattern**: Deep copy uses object ID-based memoization to handle cycles and optimize repeated references  
- **Protocol Fallback**: Falls back through custom methods (`__copy__`, `__deepcopy__`) to pickle protocols
- **Optimization Strategy**: Shallow copy returns same object for immutables; deep copy checks for identity changes

## Dependencies
- `types`: For type checking and built-in type constants
- `weakref`: For weak reference support in copying
- `copyreg.dispatch_table`: Integration with pickle registration system

## Critical Constraints
- Deep copy memo dictionary prevents infinite recursion on self-referential objects
- Object identity preservation for immutable types maintains Python semantics
- Protocol version 4 used for `__reduce_ex__` calls (L87, L151)