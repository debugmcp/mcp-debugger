# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/pprint.py
@source-hash: 1585c8d74d7f4855
@generated: 2026-02-09T18:07:19Z

## Primary Purpose
Python's pretty-printing module providing formatted output for complex data structures. Handles recursive data structures safely and offers customizable formatting options including width constraints, depth limits, and compact layouts.

## Key Public Interface

### Main Functions
- **pprint(object, ...)** (L48-55): Pretty-prints to stream (default stdout)
- **pformat(object, ...)** (L57-62): Returns formatted string representation
- **pp(object, ...)** (L64-66): Convenience function with sort_dicts=False default
- **saferepr(object)** (L68-70): Safe repr() that handles recursion
- **isreadable(object)** (L72-74): Tests if saferepr output is eval()-able
- **isrecursive(object)** (L76-78): Detects recursive data structures

### Core Class
**PrettyPrinter** (L106-633): Main formatting engine with configurable parameters:
- Constructor (L107-152): Accepts indent, width, depth, stream, compact, sort_dicts, underscore_numbers
- Public methods: pprint() (L154-157), pformat() (L159-162)
- Core formatting: _format() (L171-197) - main recursive formatter

## Formatting Dispatch System
**_dispatch** dictionary (L207, L224, L237, etc.): Maps type.__repr__ methods to specialized formatters:
- _pprint_dict() (L209-222): Dictionary formatting with optional sorting
- _pprint_list() (L239-243): List formatting with brackets
- _pprint_tuple() (L247-252): Tuple formatting with parentheses
- _pprint_set() (L256-271): Set/frozenset formatting with sorting
- _pprint_str() (L276-324): Multi-line string formatting with word wrapping
- _pprint_bytes() (L327-344): Byte string formatting with line wrapping
- Collection-specific formatters for OrderedDict, defaultdict, Counter, ChainMap, deque, UserDict/List/String

## Safe Comparison Utilities
**_safe_key** class (L80-100): Wrapper for sorting heterogeneous objects, falls back to type name + id comparison
**_safe_tuple()** (L102-104): Helper for sorting dictionary items safely

## Recursion Handling
- **_recursion()** (L638-640): Generates recursion placeholder strings
- Context tracking throughout _format() and _safe_repr() to detect cycles
- **_safe_repr()** (L554-633): Core safe representation with recursion detection

## Special Type Support
- **_pprint_dataclass()** (L199-205): Dataclass formatting using field metadata
- **_pprint_simplenamespace()** (L365-376): SimpleNamespace formatting
- **_builtin_scalars** (L635-636): Set of types that don't need special formatting
- **_wrap_bytes_repr()** (L643-658): Utility for wrapping byte representations

## Key Architectural Patterns
- Dispatch table pattern for type-specific formatting
- Context-based recursion tracking using object ids
- Stream-based output with careful width/indent calculations
- Configurable formatting behavior through instance variables
- Safe comparison for sorting mixed-type collections