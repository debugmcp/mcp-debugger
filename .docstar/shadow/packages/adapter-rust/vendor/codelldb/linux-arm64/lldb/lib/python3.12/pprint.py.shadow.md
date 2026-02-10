# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/pprint.py
@source-hash: 1585c8d74d7f4855
@generated: 2026-02-09T18:09:22Z

## Python Pretty-Print Module

This is the standard library `pprint` module that provides intelligent pretty-printing for Python data structures. The module recursively formats complex nested objects with proper indentation and line breaking for human readability.

### Core Public API Functions (L48-79)

- **`pprint(object, ...)`** (L48-55): Main entry point that prints formatted output to a stream (default stdout)
- **`pformat(object, ...)`** (L57-62): Returns formatted string representation without printing
- **`pp(object, ...)`** (L64-66): Convenience wrapper with `sort_dicts=False` default
- **`saferepr(object)`** (L68-70): Safe recursive representation that handles circular references
- **`isreadable(object)`** (L72-74): Tests if formatted output can be evaluated back to original object
- **`isrecursive(object)`** (L76-78): Detects if object contains circular references

### Helper Classes

#### `_safe_key` (L80-100)
Wrapper for safe comparison of unorderable objects during sorting. Falls back to type name + object ID comparison when direct comparison fails (L95-100).

#### `_safe_tuple(t)` (L102-104)
Helper function that wraps tuple elements in `_safe_key` for safe sorting of key-value pairs.

### Main PrettyPrinter Class (L106-633)

Central formatting engine with comprehensive type-specific handlers:

**Constructor** (L107-152): Accepts formatting parameters:
- `indent`: spaces per nesting level
- `width`: target line width
- `depth`: maximum nesting depth
- `stream`: output destination
- `compact`: multi-item per line mode
- `sort_dicts`: alphabetize dictionary keys
- `underscore_numbers`: format integers with underscores

**Core Methods:**
- **`pprint(object)`** (L154-157): Format and write to stream
- **`pformat(object)`** (L159-162): Format to string
- **`_format(object, stream, indent, allowance, context, level)`** (L171-197): Main recursive formatting dispatcher

**Type-Specific Pretty-Printers:**
The `_dispatch` dictionary (L207) maps type `__repr__` methods to specialized formatters:

- **`_pprint_dict`** (L209-222): Handles dict formatting with optional key sorting
- **`_pprint_list/tuple`** (L239-254): Array-like containers with bracket wrapping
- **`_pprint_set`** (L256-274): Set formatting with automatic sorting
- **`_pprint_str`** (L276-325): Intelligent string breaking across lines
- **`_pprint_bytes`** (L327-346): Binary data formatting with line wrapping
- **Collection types**: OrderedDict (L226), defaultdict (L473), Counter (L486), ChainMap (L502), deque (L519)
- **Namespace types**: SimpleNamespace (L365), dataclasses (L199)

**Core Formatting Helpers:**
- **`_format_dict_items`** (L380-395): Key-value pair layout with proper alignment
- **`_format_items`** (L416-455): Generic sequence formatting with compact mode support
- **`_safe_repr`** (L554-633): Recursive-safe representation with readability tracking

**Recursion Handling:**
Uses context dictionary with object IDs to detect and break circular references. Returns special recursion markers (L638-640) when cycles detected.

### Built-in Scalar Types (L635-636)
Frozenset of types that get simple repr() treatment: str, bytes, bytearray, float, complex, bool, NoneType.

### Utility Functions
- **`_recursion(object)`** (L638-640): Generates recursion placeholder text
- **`_wrap_bytes_repr`** (L643-658): Chunks bytes objects for line wrapping

### Architecture Notes
- Uses visitor pattern via `_dispatch` dictionary for type-specific formatting
- Tracks formatting context (indentation, width constraints, recursion state) through method parameters
- Supports both streaming output and string generation modes
- Handles Python 2.x style comparison fallbacks for unorderable types