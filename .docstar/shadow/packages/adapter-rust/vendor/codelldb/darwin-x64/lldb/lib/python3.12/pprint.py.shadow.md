# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/pprint.py
@source-hash: 1585c8d74d7f4855
@generated: 2026-02-09T18:07:57Z

**Python Pretty-Printing Module**

Core purpose: Provides recursive pretty-printing functionality for Python data structures with customizable formatting options, particularly useful for debugging deeply nested objects.

## Key Components

**Main API Functions (L48-78)**
- `pprint(object, ...)` (L48-55): Pretty-prints to stream (default stdout) via PrettyPrinter
- `pformat(object, ...)` (L57-62): Returns formatted string representation 
- `pp(object, ...)` (L64-66): Convenience wrapper with sort_dicts=False default
- `saferepr(object)` (L68-70): Safe recursive-aware repr() alternative
- `isreadable(object)` (L72-74): Tests if output is eval()-able
- `isrecursive(object)` (L76-78): Detects recursive data structures

**Core Class: PrettyPrinter (L106-633)**
- Constructor (L107-152): Configures indent, width, depth, stream, compact mode, dict sorting, number formatting
- Main formatting methods:
  - `pprint(object)` (L154-157): Prints to configured stream
  - `pformat(object)` (L159-162): Returns formatted string
  - `_format(object, stream, ...)` (L171-197): Core recursive formatter with context tracking

**Type-Specific Formatters (via _dispatch dict)**
- `_pprint_dict` (L209-222): Dictionary formatting with optional sorting
- `_pprint_list/tuple` (L239-252): List and tuple formatting
- `_pprint_set` (L256-271): Set/frozenset with sorted output
- `_pprint_str` (L276-323): Multi-line string handling with word wrapping
- `_pprint_bytes/bytearray` (L327-353): Binary data formatting
- Special collections: OrderedDict (L226), defaultdict (L473), Counter (L486), deque (L519), ChainMap (L502)
- Modern types: dataclass (L187-205), SimpleNamespace (L365), MappingProxy (L357)

**Recursion Handling**
- `_safe_repr(object, context, maxlevels, level)` (L554-633): Safe representation with cycle detection
- Context tracking prevents infinite loops via object ID mapping
- `_recursion(object)` (L638-640): Generates recursion markers

**Utility Classes/Functions**
- `_safe_key` (L80-100): Enables sorting of heterogeneous/unorderable objects
- `_safe_tuple(t)` (L102-104): Helper for sorting key-value pairs  
- `_wrap_bytes_repr` (L643-658): Chunks byte strings for width constraints

## Architecture Patterns

**Dispatch-Based Formatting**: Uses `_dispatch` dict (L207) mapping `__repr__` methods to specialized formatters, enabling extensible type-specific pretty-printing.

**Context-Aware Recursion Detection**: Maintains object ID context throughout formatting to detect and handle circular references gracefully.

**Width-Aware Layout**: Attempts to fit output within specified width constraints, falling back to multi-line formatting when necessary.

**Configurable Behavior**: Supports compact mode, dict sorting, numeric formatting with underscores, and depth limiting.

## Dependencies
- Standard library: `collections`, `dataclasses`, `re`, `sys`, `types`, `io.StringIO`
- No external dependencies

## Critical Invariants
- Context dict must be properly managed (added/removed) to prevent memory leaks
- Dispatch methods must handle empty collections appropriately  
- Width calculations must account for delimiters and allowances
- Recursive objects must be detected before infinite loops occur