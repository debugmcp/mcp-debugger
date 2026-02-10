# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/reprlib.py
@source-hash: 8da3105407680306
@generated: 2026-02-09T18:13:05Z

## Purpose
Custom representation library providing bounded string representations of Python objects with configurable limits and recursion protection. Serves as a safer alternative to built-in `repr()` with size constraints and pretty-printing capabilities.

## Key Components

### recursive_repr Decorator (L9-35)
- **Purpose**: Prevents infinite recursion in `__repr__` methods by tracking active representations per thread
- **Mechanism**: Uses object ID + thread ID as tracking key, returns fillvalue ('...') for recursive calls
- **Usage**: Decorator that wraps user `__repr__` functions to handle circular references
- **Key Features**: Thread-safe, preserves function metadata without functools.wraps due to bootstrap constraints

### Repr Class (L37-180)
Main class providing bounded representations with configurable limits for different data types.

**Constructor (L39-56)**: Accepts limits for various types:
- `maxlevel`: Recursion depth limit (default 6)
- `maxtuple/maxlist/maxarray/maxdict/maxset/maxfrozenset/maxdeque`: Item count limits
- `maxstring/maxlong/maxother`: Character length limits
- `fillvalue`: Truncation indicator (default '...')
- `indent`: Pretty-printing indentation control

**Core Methods**:
- `repr(x)` (L58-59): Entry point, delegates to `repr1` with max level
- `repr1(x, level)` (L61-69): Main dispatch logic using dynamic method lookup (`repr_{typename}`)
- `_join(pieces, level)` (L71-89): Handles joining with optional pretty-printing indentation
- `_repr_iterable(x, level, left, right, maxiter, trail)` (L91-104): Common logic for sequence-like types

**Type-Specific Handlers**:
- `repr_tuple` (L106): Handles tuples with trailing comma for single items
- `repr_list` (L109): Standard list representation
- `repr_array` (L112): Array module objects with typecode display
- `repr_set/repr_frozenset` (L118/124): Set types with sorted display when possible
- `repr_deque` (L131): Collections.deque objects
- `repr_dict` (L134): Dictionary with sorted keys when possible
- `repr_str` (L152): String truncation with middle ellipsis
- `repr_int` (L161): Large integer truncation
- `repr_instance` (L169): Fallback for arbitrary objects with exception handling

### Utility Functions
- `_possibly_sorted(x)` (L183-190): Attempts sorting, falls back to list conversion on failure
- Module-level instance: `aRepr = Repr()` (L192) and `repr = aRepr.repr` (L193)

## Architecture Patterns
- **Dynamic dispatch**: Uses `getattr(self, 'repr_' + typename)` for type-specific handling
- **Graceful degradation**: Fallback mechanisms for sorting failures and repr exceptions
- **Thread safety**: Recursion tracking uses thread-local identification
- **Configurable truncation**: Consistent truncation strategy across all types

## Dependencies
- `builtins`: For accessing built-in `repr()`
- `itertools.islice`: For bounded iteration
- `_thread.get_ident`: For thread-safe recursion tracking

## Critical Invariants
- Recursion depth never exceeds `maxlevel`
- Thread safety maintained through (object_id, thread_id) tracking
- Exception handling ensures repr always returns a string
- Truncation preserves beginning and end of long representations