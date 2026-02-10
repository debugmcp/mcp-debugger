# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/keyword.py
@source-hash: 18c2be738c04ad20
@generated: 2026-02-09T18:09:38Z

## Purpose
Auto-generated Python standard library module that defines Python language keywords and provides keyword validation functions. Part of the Python interpreter's core language support infrastructure.

## Key Components

### Data Structures
- **kwlist** (L18-54): Complete list of Python hard keywords (35 total) including literals (`False`, `None`, `True`), control flow (`if`, `for`, `while`), operators (`and`, `or`, `not`), and structural keywords (`class`, `def`, `async`, etc.)
- **softkwlist** (L56-61): List of contextual/soft keywords (`_`, `case`, `match`, `type`) that can be used as identifiers in some contexts
- **__all__** (L16): Exports four public functions/variables for keyword checking and lists

### Functions
- **iskeyword** (L63): Optimized keyword checker using frozenset containment - returns True if string is a hard keyword
- **issoftkeyword** (L64): Soft keyword checker using frozenset containment - returns True if string is a contextual keyword

## Architecture Notes
- Uses frozenset containment optimization (`.__contains__`) for O(1) keyword lookup performance
- Auto-generated from Python grammar files using pegen toolchain
- Separates hard keywords (always reserved) from soft keywords (contextually reserved)

## Dependencies
None - pure Python data structures and built-ins only.

## Critical Constraints
- File is auto-generated and should not be manually edited
- Regeneration requires running specific toolchain commands from Python source root
- Keyword lists must stay synchronized with Python grammar definitions