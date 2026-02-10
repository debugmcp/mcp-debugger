# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/keyword.py
@source-hash: 18c2be738c04ad20
@generated: 2026-02-09T18:08:10Z

## Purpose
Auto-generated Python standard library module that provides keyword identification utilities for Python 3.12. Serves as the canonical source of Python language keywords and soft keywords, generated from the Python grammar specification.

## Key Components

### Data Structures
- **kwlist (L18-54)**: Complete list of Python hard keywords (35 total) including literals (`False`, `None`, `True`), control flow (`if`, `for`, `while`), function/class definitions (`def`, `class`, `async`), and operators (`and`, `or`, `not`, `is`, `in`)
- **softkwlist (L56-61)**: List of Python soft keywords (4 total: `_`, `case`, `match`, `type`) that are context-dependent and can be used as identifiers in some situations

### Functions
- **iskeyword (L63)**: Efficient keyword checker using `frozenset(kwlist).__contains__` for O(1) lookup of hard keywords
- **issoftkeyword (L64)**: Efficient soft keyword checker using `frozenset(softkwlist).__contains__` for O(1) lookup

### Public API
- **__all__ (L16)**: Exports `["iskeyword", "issoftkeyword", "kwlist", "softkwlist"]` for controlled module interface

## Generation Process
Auto-generated from `Grammar/python.gram` and `Grammar/Tokens` using the pegen keyword generator tool. Can be regenerated via `make regen-keyword` or direct invocation of the pegen toolchain.

## Architecture Notes
- Uses frozenset for immutable, hash-optimized keyword lookups
- Separates hard keywords (always reserved) from soft keywords (contextually reserved)
- No runtime dependencies beyond built-in types
- Critical for Python parser and syntax highlighting tools