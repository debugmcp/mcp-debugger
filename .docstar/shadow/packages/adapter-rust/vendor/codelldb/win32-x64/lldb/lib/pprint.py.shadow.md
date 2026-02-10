# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/pprint.py
@source-hash: 1585c8d74d7f4855
@generated: 2026-02-09T18:14:23Z

## Purpose
Pretty-printing module for Python objects, providing formatted output for debugging and data visualization. Part of the LLDB debugging framework's Python support, enabling structured display of complex nested data structures.

## Key Components

### Public API Functions (L48-78)
- `pprint(object, ...)` (L48): Main pretty-print function, outputs to stream (default: stdout)
- `pformat(object, ...)` (L57): Returns formatted string representation
- `pp(object, ...)` (L64): Convenience function with `sort_dicts=False` default
- `saferepr(object)` (L68): Safe repr() that handles recursive structures
- `isreadable(object)` (L72): Checks if saferepr output can be eval'd
- `isrecursive(object)` (L76): Detects recursive data structures

### Core Class: PrettyPrinter (L106-634)
Main formatting engine with configurable parameters:
- Constructor (L107-152): Accepts indent, width, depth, stream, compact, sort_dicts, underscore_numbers
- `pprint(object)` (L154): Format to stream with newline
- `pformat(object)` (L159): Format to string
- `_format(object, stream, ...)` (L171): Core recursive formatting logic with recursion detection

### Type-Specific Formatters
Dispatch table (`_dispatch`, L207) maps type reprs to specialized formatters:
- `_pprint_dict` (L209): Dictionary formatting with optional sorting
- `_pprint_list` (L239): List formatting with brackets
- `_pprint_tuple` (L247): Tuple formatting with parentheses
- `_pprint_set` (L256): Set/frozenset formatting
- `_pprint_str` (L276): Multi-line string formatting with word wrapping
- `_pprint_bytes` (L327): Byte string formatting
- `_pprint_dataclass` (L199): Dataclass pretty-printing
- Collection types: OrderedDict (L226), defaultdict (L473), Counter (L486), ChainMap (L502), deque (L519)
- User types: UserDict (L539), UserList (L544), UserString (L549)

### Helper Components
- `_safe_key` class (L80-100): Enables sorting of unorderable objects by type name + id fallback
- `_safe_tuple(t)` (L102): Helper for comparing 2-tuples safely
- `_safe_repr(object, ...)` (L554): Core safe representation with recursion handling
- `_recursion(object)` (L638): Generates recursion placeholder strings
- `_wrap_bytes_repr(object, ...)` (L643): Byte string line wrapping

## Key Features
- Recursive structure detection and safe handling
- Configurable indentation, width, and depth limits
- Type-specific formatting strategies
- Optional dictionary key sorting
- Compact mode for space efficiency
- Underscore number formatting for readability
- Multi-line string and bytes handling

## Dependencies
- Standard library: collections, dataclasses, re, sys, types, io.StringIO
- No external dependencies

## Architecture Pattern
Uses dispatch table pattern where type.__repr__ methods map to specialized formatting functions, enabling extensible pretty-printing for different Python types.