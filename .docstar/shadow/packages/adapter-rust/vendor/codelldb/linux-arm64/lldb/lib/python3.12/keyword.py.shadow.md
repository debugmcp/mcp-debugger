# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/keyword.py
@source-hash: 18c2be738c04ad20
@generated: 2026-02-09T18:08:40Z

## Purpose
Auto-generated Python keyword detection module providing categorized keyword lists and lookup functions for Python language parsing and validation.

## Key Components

### Data Structures
- **kwlist** (L18-54): Complete list of Python hard keywords including reserved words like 'def', 'class', 'if', etc. Contains 33 keywords total
- **softkwlist** (L56-61): Soft keywords introduced in Python 3.10+ including '_', 'case', 'match', 'type' that are context-dependent
- **__all__** (L16): Public API exports for iskeyword, issoftkeyword, kwlist, softkwlist

### Functions
- **iskeyword** (L63): Fast keyword lookup function using frozenset containment check
- **issoftkeyword** (L64): Fast soft keyword lookup function using frozenset containment check

## Implementation Details
- Uses frozenset.__contains__ method binding for O(1) keyword detection performance
- Hard keywords are always reserved in all contexts
- Soft keywords are only reserved in specific syntactic contexts (match/case statements, type annotations)

## Generation Process
Auto-generated from Grammar/python.gram and Grammar/Tokens using pegen.keywordgen tool. Should not be manually edited.

## Dependencies
None - standalone module with no imports

## Usage Pattern
Typical usage: `keyword.iskeyword('def')` returns True, `keyword.issoftkeyword('match')` returns True