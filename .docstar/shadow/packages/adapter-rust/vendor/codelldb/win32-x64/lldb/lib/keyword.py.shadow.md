# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/keyword.py
@source-hash: 18c2be738c04ad20
@generated: 2026-02-09T18:14:12Z

## Purpose
Auto-generated Python keyword registry module that provides programmatic access to Python's reserved keywords and soft keywords for syntax parsing and validation.

## Key Components

**Exported Interface (L16):**
- `iskeyword`: Fast keyword lookup function
- `issoftkeyword`: Soft keyword lookup function  
- `kwlist`: Complete list of hard keywords
- `softkwlist`: List of contextual keywords

**Hard Keywords List (L18-54):**
- `kwlist`: Contains 35 reserved Python keywords including control flow (`if`, `while`, `for`), declarations (`def`, `class`), operators (`and`, `or`, `not`), and literals (`True`, `False`, `None`)
- Complete coverage of Python's core syntax elements

**Soft Keywords List (L56-61):**
- `softkwlist`: Contains 4 contextual keywords: `_`, `case`, `match`, `type`
- These are only keywords in specific contexts (pattern matching, type annotations)

**Lookup Functions (L63-64):**
- `iskeyword`: Optimized frozenset-based containment check for hard keywords
- `issoftkeyword`: Similar optimization for soft keyword detection
- Both use `frozenset.__contains__` method binding for O(1) lookup performance

## Architecture Notes
- **Auto-generation**: File is machine-generated from Python grammar files, not hand-maintained
- **Performance optimization**: Uses frozenset containment for fast keyword detection
- **Separation of concerns**: Distinguishes between hard keywords (always reserved) and soft keywords (contextually reserved)

## Dependencies
- No external dependencies; pure Python standard library module
- Part of Python's core language infrastructure

## Generation Process
Generated via `pegen.keywordgen` from `Grammar/python.gram` and `Grammar/Tokens` source files.