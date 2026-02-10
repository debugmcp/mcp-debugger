# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/tokenize.py
@source-hash: a39cd5ee895abc08
@generated: 2026-02-09T18:08:18Z

## Purpose
Python standard library module for tokenizing Python source code. Provides a generator-based tokenizer that breaks byte streams into Python tokens, handling encoding detection, string parsing, and operator recognition. Part of the LLDB Python environment for debugging Rust projects.

## Core Components

### Token Data Structure
- **TokenInfo** (L47-58): Named tuple representing a Python token with fields (type, string, start, end, line)
  - `exact_type` property returns specific operator types from EXACT_TOKEN_TYPES
  - Custom `__repr__` shows annotated token type names

### Regular Expression Patterns (L60-159)
- **Regex builders**: `group()`, `any()`, `maybe()` helper functions (L60-62)
- **Token patterns**: Comprehensive regex definitions for Python syntax elements
  - Number patterns: Hexnumber, Binnumber, Octnumber, Decnumber, Floatnumber, Imagnumber (L71-82)
  - String patterns: Single, Double, Triple quotes with prefix support (L109-119)
  - Special operators and funny tokens (L124-125)
- **String prefix handling**: `_all_string_prefixes()` generates all valid combinations (L85-98)
- **Pattern compilation**: `_compile()` with LRU cache for regex optimization (L100-102)

### Encoding Detection
- **detect_encoding()** (L352-442): PEP-263 compliant encoding detection
  - Handles UTF-8 BOM and encoding cookies
  - Returns encoding string and consumed lines
  - Validates encoding with codec lookup
- **cookie_re** (L39): Regex for detecting encoding declarations
- **_get_normal_name()** (L341-350): Normalizes encoding names

### Tokenization Engine
- **tokenize()** (L460-486): Main tokenizer generator accepting byte readline function
  - Yields TokenInfo tuples including ENCODING token first
  - Delegates to C tokenizer via `_generate_tokens_from_c_tokenizer()`
- **generate_tokens()** (L488-494): String-based tokenizer for unicode input
- **_generate_tokens_from_c_tokenizer()** (L569-582): Bridge to internal C tokenizer
  - Handles encoding parameter
  - Transforms C tokenizer errors to Python TokenError

### Untokenization
- **Untokenizer** class (L167-311): Reconstructs source code from tokens
  - Handles whitespace reconstruction, indentation, and f-string bracket escaping
  - `untokenize()` method processes token streams
  - `compat()` method for backward compatibility with 2-tuple tokens
  - `escape_brackets()` handles f-string bracket doubling (L189-210)
- **untokenize()** function (L314-338): Public interface returning bytes

### Utility Functions
- **open()** (L445-458): Opens files with detected encoding
- **main()** (L496-557): Command-line interface for tokenization
- **_transform_msg()** (L559-567): Translates C tokenizer error messages

## Exception Classes
- **TokenError** (L162): Raised for tokenization errors
- **StopTokenizing** (L165): Internal exception for stopping tokenization

## Key Dependencies
- `_tokenize`: Internal C tokenizer module
- `token`: Token type constants and EXACT_TOKEN_TYPES
- Standard library: `re`, `codecs`, `collections`, `itertools`, `io`

## Architecture Notes
- Hybrid approach: Python preprocessing with C tokenizer backend
- Maintains compatibility with pure Python tokenizer behavior
- Supports modern Python features (f-strings, underscored numbers)
- Handles encoding detection per PEP-263
- Global variables for compiled patterns and lookup tables (endpats, single_quoted, triple_quoted)