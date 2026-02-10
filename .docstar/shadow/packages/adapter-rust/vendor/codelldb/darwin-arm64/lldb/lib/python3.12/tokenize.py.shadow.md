# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/tokenize.py
@source-hash: a39cd5ee895abc08
@generated: 2026-02-09T18:07:30Z

**Primary Purpose:** Python tokenization module providing high-level tokenization API that interfaces with the C tokenizer to break Python source code into tokens. Handles encoding detection, string processing, and token reconstruction.

## Key Classes and Functions

### TokenInfo (L47-58)
Named tuple extending collections.namedtuple with fields: type, string, start, end, line. Provides `__repr__` with readable token type names and `exact_type` property for precise token classification using EXACT_TOKEN_TYPES.

### Untokenizer (L167-312)
Reconstructs Python source from token sequences. Main methods:
- `__init__`: Initializes state tracking (tokens, position, encoding)
- `add_whitespace` (L176-187): Inserts proper spacing between tokens
- `escape_brackets` (L189-210): Handles bracket escaping in f-strings
- `untokenize` (L212-258): Main reconstruction logic with indent/dedent handling
- `compat` (L260-311): Backward compatibility mode for 2-tuple tokens

### Exception Classes
- `TokenError` (L162): Tokenization errors
- `StopTokenizing` (L165): Internal tokenization control

## Core Functions

### tokenize (L460-486)
Main tokenization generator. Takes readline callable, detects encoding, yields ENCODING token first, then delegates to C tokenizer via `_generate_tokens_from_c_tokenizer`.

### generate_tokens (L488-494)
Similar to tokenize() but expects string input instead of bytes.

### detect_encoding (L352-442)
PEP-263 compliant encoding detection. Reads up to 2 lines, checks for BOM and encoding cookies. Returns (encoding, consumed_lines) tuple.

### untokenize (L314-338)
Public API wrapper around Untokenizer class. Transforms token sequence back to source code bytes.

### open (L445-458)
Opens files with auto-detected encoding using detect_encoding().

## Regular Expression Patterns (L66-136)
Comprehensive regex definitions for Python syntax:
- Number patterns: Hexnumber, Binnumber, Octnumber, Decnumber, Floatnumber, Imagnumber
- String patterns: Single, Double, Single3, Double3, with prefix support
- Token patterns: PlainToken, Token, ContStr, PseudoToken
- Special operator matching via EXACT_TOKEN_TYPES

## String Processing Infrastructure
- `_all_string_prefixes` (L85-98): Generates all valid string prefix permutations
- `endpats` (L141-147): Maps string prefixes to continuation patterns
- `single_quoted`/`triple_quoted` sets (L151-158): Classification of quote types

## Internal Implementation
- `_generate_tokens_from_c_tokenizer` (L569-582): Bridges to C tokenizer, handles error transformation
- `_transform_msg` (L559-567): Normalizes C tokenizer error messages for Python compatibility
- `main` (L496-557): CLI interface for tokenization with error handling

## Key Dependencies
- `_tokenize`: C extension module providing TokenizerIter
- `token`: Token type constants and EXACT_TOKEN_TYPES
- Standard library: re, itertools, codecs, collections

## Architecture Notes
- Uses lazy compilation of regexes via `@functools.lru_cache` on `_compile` (L100-102)
- Maintains backward compatibility through Untokenizer.compat method
- Handles f-string bracket escaping for proper reconstruction
- Encoding detection follows PEP-263 specification strictly