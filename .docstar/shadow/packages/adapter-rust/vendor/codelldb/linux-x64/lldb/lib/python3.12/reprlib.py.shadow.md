# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/reprlib.py
@source-hash: 8da3105407680306
@generated: 2026-02-09T18:09:54Z

**Purpose**: Alternative representation implementation with customizable size limits for various data types. Part of Python's standard library, providing controlled `repr()` functionality to prevent overwhelming output from large or nested objects.

## Core Components

**recursive_repr decorator (L9-35)**: Thread-safe decorator that prevents infinite recursion in `__repr__` methods by tracking active representations using object ID and thread ID. Returns configurable fillvalue ('...') when recursion is detected.

**Repr class (L37-181)**: Configurable representation generator with type-specific size limits. Constructor accepts max limits for different container types (tuples, lists, dicts, etc.) and formatting options.

### Key Methods

- `repr(x)` (L58-59): Main entry point, delegates to `repr1` with max level
- `repr1(x, level)` (L61-69): Dynamic dispatch based on type name, falls back to `repr_instance`
- `_join(pieces, level)` (L71-89): Handles comma/newline joining with optional indentation
- `_repr_iterable(x, level, left, right, maxiter, trail)` (L91-104): Generic iterable representation with size limits

### Type-Specific Handlers

- `repr_tuple/list/array/set/frozenset/deque` (L106-132): Container types using `_repr_iterable`
- `repr_dict` (L134-150): Key-value pairs with sorting attempt
- `repr_str` (L152-159): String truncation with middle ellipsis
- `repr_int` (L161-167): Large integer truncation
- `repr_instance` (L169-180): Fallback for arbitrary objects, exception-safe

## Utilities

**_possibly_sorted function (L183-190)**: Safe sorting helper that returns unsorted list if comparison fails.

**Module globals (L192-193)**: Default `aRepr` instance and exported `repr` function.

## Dependencies

- `builtins`: For original `repr()` function
- `itertools.islice`: Efficient iteration limiting  
- `_thread.get_ident`: Thread identification for recursion detection

## Key Design Patterns

- Dynamic method dispatch via `getattr` for type-specific handlers
- Defensive programming with exception handling throughout
- Level-based recursion control to prevent infinite nesting
- Thread-safe recursion detection using (object_id, thread_id) tuples