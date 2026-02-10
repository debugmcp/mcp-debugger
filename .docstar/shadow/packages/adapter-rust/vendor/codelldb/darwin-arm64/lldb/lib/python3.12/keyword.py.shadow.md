# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/keyword.py
@source-hash: 18c2be738c04ad20
@generated: 2026-02-09T18:07:03Z

## Primary Purpose
Auto-generated Python module that provides keyword identification utilities for Python 3.12, specifically within the LLDB debugger environment. Contains definitive lists of Python keywords and functions to check keyword status.

## Key Components

### Public Interface (L16)
- `__all__`: Exports `iskeyword`, `issoftkeyword`, `kwlist`, `softkwlist`

### Keyword Lists
- `kwlist` (L18-54): Complete list of 35 Python hard keywords including control flow (`if`, `for`, `while`), declarations (`def`, `class`), operators (`and`, `or`, `not`), literals (`True`, `False`, `None`), and async constructs (`async`, `await`)
- `softkwlist` (L56-61): List of 4 contextual keywords that are only reserved in specific contexts: `_` (match wildcard), `case`, `match` (pattern matching), `type` (type statements)

### Lookup Functions
- `iskeyword` (L63): Fast keyword checker using `frozenset(kwlist).__contains__` - O(1) lookup for hard keywords
- `issoftkeyword` (L64): Fast soft keyword checker using `frozenset(softkwlist).__contains__` - O(1) lookup for contextual keywords

## Generation Process
Auto-generated from Python grammar files using `pegen.keywordgen` tool. Updates require running grammar parser against `Grammar/python.gram` and `Grammar/Tokens`.

## Architecture Notes
- Uses frozenset for immutable, hash-optimized keyword lookups
- Separates hard keywords (always reserved) from soft keywords (contextually reserved)
- Part of LLDB's Python 3.12 environment for debugging support

## Critical Constraints
- File should not be manually modified (auto-generated)
- Keyword lists must remain synchronized with Python grammar
- frozenset optimization assumes keywords are checked frequently during parsing/analysis