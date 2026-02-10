# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/tokenize.py
@source-hash: a39cd5ee895abc08
@generated: 2026-02-09T18:09:22Z

This is Python's core tokenization module, providing lexical analysis for Python source code. It wraps the internal C tokenizer (`_tokenize`) with a pure Python interface and additional features.

## Core Purpose
Breaks Python source code into tokens with exact positioning information, supporting both bytes and string input streams. Essential for code analysis tools, syntax highlighters, and language processing utilities.

## Key Classes

### TokenInfo (L47-58)
Named tuple representing a single token with fields: `type`, `string`, `start`, `end`, `line`. Extends basic tuple with:
- Custom `__repr__` showing human-readable token type names
- `exact_type` property that distinguishes specific operators from generic OP tokens

### Untokenizer (L167-312) 
Reconstructs Python source from token streams. Handles whitespace reconstruction, indentation tracking, and special cases for f-strings and string concatenation.
- `untokenize()` method (L212-258): Main reconstruction logic with indent/dedent tracking
- `compat()` method (L260-311): Backward compatibility for 2-element token tuples
- `escape_brackets()` (L189-210): Handles f-string bracket escaping

### Custom Exceptions
- TokenError (L162): Raised for tokenization errors
- StopTokenizing (L165): Internal control flow exception

## Key Functions

### tokenize(readline) (L460-486)
Primary tokenization interface for byte streams. Auto-detects encoding via `detect_encoding()`, yields ENCODING token first, then delegates to C tokenizer.

### generate_tokens(readline) (L488-494) 
Tokenization interface for Unicode string streams. Bypasses encoding detection.

### detect_encoding(readline) (L352-442)
PEP-263 compliant encoding detection from BOM and/or encoding cookies. Returns encoding name and consumed lines.

### untokenize(iterable) (L314-338)
Public interface to convert token stream back to source code. Returns bytes encoded with detected encoding.

### open(filename) (L445-458)
Convenience function to open Python files with proper encoding detection.

## Regular Expression Patterns (L39-136)
Extensive regex definitions for Python lexical elements:
- Number patterns: `Hexnumber`, `Binnumber`, `Octnumber`, `Decnumber`, `Floatnumber`, `Imagnumber` (L71-82)
- String patterns: Support for all string prefix combinations, single/double/triple quotes (L85-120)
- Token classification: `PlainToken`, `PseudoToken` with whitespace handling (L127-136)

## Important Data Structures
- `endpats` dict (L141-147): Maps string prefixes+quotes to completion regexes
- `single_quoted`/`triple_quoted` sets (L151-157): String quote type classification
- `cookie_re` (L39): Regex for encoding declaration detection

## Dependencies
- `_tokenize`: Internal C tokenizer module
- `token`: Token type constants and names
- Standard library: `re`, `codecs`, `collections`, `itertools`, `functools`

## Architecture Notes
- Hybrid approach: Uses fast C tokenizer with Python wrapper for compatibility
- Maintains exact position information for round-trip fidelity
- Handles Python 3.12+ f-string improvements and bracket escaping
- Thread-safe with `@functools.lru_cache` on regex compilation (L100-102)