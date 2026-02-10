# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/reprlib.py
@source-hash: 8da3105407680306
@generated: 2026-02-09T18:07:20Z

## Purpose
Reimplementation of Python's built-in `repr()` function with configurable size limits to prevent excessively long string representations. Part of Python's standard library for controlled object representation.

## Key Components

### recursive_repr decorator (L9-35)
Thread-safe decorator that prevents infinite recursion in `__repr__` methods by tracking active calls per object ID and thread. Returns `fillvalue` ('...') for recursive calls. Manually copies function metadata to avoid bootstrap issues with functools.

### Repr class (L37-180)
Main configurable representation class with per-type size limits:

**Constructor (L39-56)**: Accepts limits for various types:
- Collections: `maxtuple`, `maxlist`, `maxarray`, `maxdict`, `maxset`, `maxfrozenset`, `maxdeque` 
- Primitives: `maxstring`, `maxlong`, `maxother`
- Formatting: `maxlevel` (recursion depth), `fillvalue`, `indent`

**Core methods:**
- `repr()` (L58-59): Entry point, delegates to `repr1()`
- `repr1()` (L61-69): Type dispatch using dynamic method lookup (`repr_typename`)
- `_join()` (L71-89): Handles comma-separated formatting with optional indentation
- `_repr_iterable()` (L91-104): Generic iterable representation with truncation

**Type-specific repr methods (L106-180):**
- `repr_tuple`, `repr_list`, `repr_array`, `repr_set`, `repr_frozenset`, `repr_deque`: Use `_repr_iterable`
- `repr_dict` (L134-150): Special key-value formatting with sorting
- `repr_str`, `repr_int` (L152-167): Truncate long strings/integers with middle ellipsis
- `repr_instance` (L169-180): Fallback with exception handling

### Utility Functions

**_possibly_sorted() (L183-190)**: Attempts to sort iterables for consistent output, falls back to list conversion on exceptions.

**Module-level instance (L192-193)**: Creates default `aRepr` instance and exports its `repr` method as module-level function.

## Architecture Patterns
- Dynamic method dispatch using `getattr(self, 'repr_' + typename)`
- Consistent truncation strategy across types using `fillvalue`
- Thread-safe recursion detection using object ID + thread ID tuples
- Graceful degradation with exception handling for malformed objects

## Critical Constraints
- All size limits are enforced to prevent memory issues
- Thread safety maintained through per-thread tracking
- Bootstrap-safe (doesn't use functools to avoid circular imports)
- Exception-safe fallbacks for broken `__repr__` implementations