# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/reprlib.py
@source-hash: 8da3105407680306
@generated: 2026-02-09T18:09:03Z

## Purpose
Python's `reprlib` module provides limited-size string representations of objects, preventing memory issues with large or deeply nested data structures. This is a standard library module for safe object inspection.

## Key Components

### `recursive_repr` decorator (L9-35)
- Prevents infinite recursion in `__repr__` methods by tracking active calls per thread
- Uses `(id(self), get_ident())` as unique key for recursion detection (L16)
- Returns `fillvalue` (default '...') for recursive calls (L18)
- Manually copies function metadata to avoid bootstrap issues (L27-32)

### `Repr` class (L37-180)
Primary configurable representation generator with size limits for different data types:

**Constructor (L39-56)**: Accepts max limits for:
- `maxlevel=6`: Maximum recursion depth
- Type-specific limits: tuples(6), lists(6), arrays(5), dicts(4), sets(6), etc.
- String limits: `maxstring=30`, `maxlong=40`, `maxother=30`
- `fillvalue='...'`: Truncation indicator
- `indent=None`: Optional pretty-printing indentation

**Core Methods:**
- `repr(x)` (L58-59): Main entry point, delegates to `repr1`
- `repr1(x, level)` (L61-69): Dynamic dispatch to type-specific repr methods
- `_join(pieces, level)` (L71-89): Handles indented formatting with level-aware spacing
- `_repr_iterable(x, level, left, right, maxiter, trail)` (L91-104): Generic iterable formatter

**Type-specific repr methods (L106-180):**
- `repr_tuple`, `repr_list`, `repr_array`: Use `_repr_iterable` with appropriate brackets
- `repr_set`, `repr_frozenset`: Sort elements via `_possibly_sorted` before formatting
- `repr_dict` (L134-150): Special key-value formatting with sorted keys
- `repr_str` (L152-159): Truncates long strings, preserving start/end portions
- `repr_int` (L161-167): Similar truncation for large integers
- `repr_instance` (L169-180): Fallback with exception handling for broken `__repr__` methods

### Utilities
- `_possibly_sorted(x)` (L183-190): Safe sorting that falls back to unsorted list on exceptions
- Module-level `aRepr` instance (L192) and `repr` function (L193) for direct use

## Architecture
Uses dynamic method dispatch via `hasattr(self, 'repr_' + typename)` pattern (L66-67). Type names with spaces are normalized by replacing with underscores (L63-65). Thread-safe recursion detection using thread IDs.