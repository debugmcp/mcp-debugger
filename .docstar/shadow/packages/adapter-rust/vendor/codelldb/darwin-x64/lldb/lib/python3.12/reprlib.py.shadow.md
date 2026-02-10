# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/reprlib.py
@source-hash: 8da3105407680306
@generated: 2026-02-09T18:07:57Z

## Purpose
Alternative implementation of Python's built-in `repr()` with configurable size limits to prevent excessively long string representations. Part of Python's standard library for controlled object representation.

## Key Components

### recursive_repr Decorator (L9-35)
Factory function that creates a decorator to prevent infinite recursion in `__repr__` methods. Uses thread-local tracking via `get_ident()` and object IDs to detect circular references, returning a fillvalue ('...') when recursion is detected.

### Repr Class (L37-180)
Main configurable representation class with size limits for different data types:

**Configuration (L39-56):**
- `maxlevel`: Maximum recursion depth (default 6)
- Type-specific limits: `maxtuple`, `maxlist`, `maxarray`, `maxdict`, `maxset`, `maxfrozenset`, `maxdeque`
- String limits: `maxstring` (30), `maxlong` (40), `maxother` (30)
- `fillvalue`: Truncation indicator ('...')
- `indent`: Optional indentation for multi-line output

**Core Methods:**
- `repr(x)` (L58-59): Main entry point, delegates to `repr1`
- `repr1(x, level)` (L61-69): Type dispatcher using dynamic method lookup (`repr_typename`)
- `_join(pieces, level)` (L71-89): Handles joining with optional indentation
- `_repr_iterable(x, level, left, right, maxiter, trail)` (L91-104): Generic iterable representation with truncation

**Type-Specific Handlers:**
- `repr_tuple` (L106-107), `repr_list` (L109-110): Sequence types
- `repr_array` (L112-116): Array module arrays with typecode
- `repr_set` (L118-122), `repr_frozenset` (L124-129): Set types with sorting attempt
- `repr_deque` (L131-132): Collections.deque
- `repr_dict` (L134-150): Dictionary with key-value pairs
- `repr_str` (L152-159), `repr_int` (L161-167): String/integer truncation
- `repr_instance` (L169-180): Fallback for arbitrary objects with exception handling

### Utility Functions
- `_possibly_sorted(x)` (L183-190): Attempts to sort iterables, falls back to list conversion on failure

### Module Interface
- `aRepr` (L192): Default Repr instance
- `repr` (L193): Module-level function using default instance

## Dependencies
- `builtins`: For original `repr()` function
- `itertools.islice`: For efficient sequence truncation  
- `_thread.get_ident`: For thread-aware recursion detection

## Architecture
Uses dynamic dispatch pattern where type names are mapped to handler methods. Handles edge cases like spaces in type names by converting to underscores. Provides graceful degradation with exception handling in `repr_instance`.