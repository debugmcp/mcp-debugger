# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/tokenize.py
@source-hash: a39cd5ee895abc08
@generated: 2026-02-09T18:10:15Z

## Python Tokenizer Module

**Primary Purpose**: Python source code tokenization library that breaks Python source into structured tokens, handling encoding detection, string prefixes, and various token types. Part of Python's standard library implementation within a LLDB debugging environment.

**Core Architecture**:
- **TokenInfo namedtuple (L47-58)**: Enhanced token representation with type, string, start/end positions, and source line. Provides `exact_type` property for precise operator classification.
- **Untokenizer class (L167-312)**: Reconstructs Python source code from token sequences, handling indentation, string concatenation, f-string bracket escaping, and whitespace preservation.

**Key Functions**:

**Encoding Detection**:
- `detect_encoding(readline)` (L352-442): PEP-263 compliant encoding detection from BOM or encoding cookies. Returns encoding string and consumed lines.
- `_get_normal_name(orig_enc)` (L341-350): Normalizes encoding names to match tokenizer.c behavior.
- `open(filename)` (L445-458): Opens files with auto-detected encoding.

**Tokenization**:
- `tokenize(readline)` (L460-486): Main tokenizer that yields TokenInfo objects from byte streams. Always starts with ENCODING token.
- `generate_tokens(readline)` (L488-494): Tokenizes unicode strings directly.
- `_generate_tokens_from_c_tokenizer(source, encoding, extra_tokens)` (L569-582): Wrapper around C tokenizer with error message transformation.

**Utilities**:
- `untokenize(iterable)` (L314-338): Standalone function to reconstruct source from tokens.
- `main()` (L496-557): Command-line interface for tokenization with exact type display option.

**Token Pattern Definitions**:
- Comprehensive regex patterns (L66-136) for Python syntax: numbers (hex, binary, octal, decimal, float, imaginary), strings (with all prefix combinations), operators, and whitespace.
- String handling supports all valid prefixes (b, r, u, f combinations) via `_all_string_prefixes()` (L85-98).

**Critical Data Structures**:
- `endpats` dict (L141-147): Maps string prefixes+quotes to continuation patterns
- `single_quoted`/`triple_quoted` sets (L151-158): String delimiter classification
- `cookie_re`/`blank_re` (L39-40): Encoding detection patterns

**Dependencies**: 
- Internal `_tokenize` C module for performance
- Standard library: `re`, `collections`, `codecs`, `token`, `itertools`
- Uses `@functools.lru_cache` for regex compilation optimization (L100-102)

**Error Handling**:
- Custom exceptions: `TokenError` (L162), `StopTokenizing` (L165)
- Transforms C tokenizer error messages for Python compatibility (L559-567)
- Comprehensive error handling in main() for various exception types

**Notable Features**:
- F-string bracket escaping in untokenization (L189-210, L241-247)
- Backwards compatibility layer in Untokenizer.compat() (L260-311)
- Support for extra tokens via C tokenizer integration
- Tab size constant (L160): `tabsize = 8`