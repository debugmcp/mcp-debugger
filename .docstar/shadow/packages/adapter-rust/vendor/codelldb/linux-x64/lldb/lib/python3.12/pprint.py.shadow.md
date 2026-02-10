# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/pprint.py
@source-hash: 1585c8d74d7f4855
@generated: 2026-02-09T18:09:56Z

## Purpose
Python's pprint module implementation providing pretty-printing functionality for data structures with configurable formatting options, width control, and recursion detection. Core module for debugging and data visualization.

## Key Classes & Functions

**PrettyPrinter (L106-633)**: Main class handling pretty-printing operations with configurable parameters:
- `__init__` (L107-152): Configure indent, width, depth, stream, compact mode, dict sorting, underscore numbers
- `pprint` (L154-157): Print to stream with newline
- `pformat` (L159-162): Return formatted string via StringIO
- `_format` (L171-197): Core recursive formatting logic with context tracking for recursion detection
- `_dispatch` (L207): Registry mapping type.__repr__ methods to custom formatters

**Type-Specific Formatters**:
- `_pprint_dict` (L209-222): Dictionary formatting with optional key sorting
- `_pprint_list` (L239-243): List formatting with brackets
- `_pprint_tuple` (L247-252): Tuple formatting with special single-element handling
- `_pprint_set` (L256-271): Set/frozenset formatting with sorted elements
- `_pprint_str` (L276-324): String formatting with line wrapping and word breaking
- `_pprint_bytes` (L327-345): Bytes formatting with width-aware chunking
- `_pprint_dataclass` (L199-205): Dataclass formatting using field inspection

**Module-Level Functions**:
- `pprint` (L48-55): Convenience function creating PrettyPrinter instance
- `pformat` (L57-62): Return formatted string representation
- `pp` (L64-66): Shorthand pprint with sort_dicts=False default
- `saferepr` (L68-70): Safe representation handling recursive structures
- `isreadable` (L72-74): Check if repr is eval()-able
- `isrecursive` (L76-78): Detect recursive data structures

**Helper Classes & Functions**:
- `_safe_key` (L80-100): Wrapper for sorting mixed/unorderable types by type name then id
- `_safe_tuple` (L102-104): Helper for sorting tuple pairs safely
- `_recursion` (L638-640): Generate recursion placeholder strings
- `_wrap_bytes_repr` (L643-658): Chunk bytes for width-constrained output

## Key Data Structures
- `_dispatch` (L207): Maps type.__repr__ methods to custom formatter functions
- `_builtin_scalars` (L635-636): Frozenset of types using simple repr()
- Context dictionary: Tracks object ids during traversal to detect cycles

## Important Algorithms
- Recursive descent formatting with width calculation and line breaking
- Cycle detection using object id tracking in context dict
- Width-aware text wrapping for strings using regex word boundary detection
- Compact mode optimization for fitting multiple items per line
- Safe sorting for mixed-type collections using type name fallback

## Critical Invariants
- Context dict must be properly managed (add before recursion, delete after) to prevent memory leaks
- Width calculations must account for allowance (closing delimiter space)
- Recursion detection requires object id comparison, not equality
- Dispatch table maps __repr__ methods, not types directly
- Level parameter tracks nesting depth for maxlevels enforcement