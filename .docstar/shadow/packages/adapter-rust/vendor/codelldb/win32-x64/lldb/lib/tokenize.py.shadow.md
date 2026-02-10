# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/tokenize.py
@source-hash: a39cd5ee895abc08
@generated: 2026-02-09T18:13:17Z

## Purpose
Python tokenization module providing stream-based tokenization of Python source code. Converts byte streams into structured token sequences following Python's lexical analysis rules.

## Key Components

### Core Classes
- **TokenInfo** (L47-58): Named tuple representing a Python token with fields: type, string, start, end, line. Provides `exact_type` property for precise operator classification using EXACT_TOKEN_TYPES.
- **TokenError** (L162): Exception for tokenization errors
- **StopTokenizing** (L165): Exception to halt tokenization process
- **Untokenizer** (L167-312): Reconstructs Python source code from token sequences

### Primary Functions
- **tokenize()** (L460-486): Main generator function. Takes readline callable returning bytes, detects encoding, yields TokenInfo objects starting with ENCODING token
- **generate_tokens()** (L488-494): Similar to tokenize() but expects readline to return strings instead of bytes
- **detect_encoding()** (L352-442): Detects file encoding from BOM or PEP-263 encoding cookies. Returns (encoding, consumed_lines) tuple
- **untokenize()** (L314-338): Transforms token sequences back to Python source code as bytes
- **open()** (L445-458): Opens files using detected encoding

### Regular Expression Patterns (L39-147)
Comprehensive regex definitions for Python lexical elements:
- **cookie_re** (L39): Matches encoding declarations  
- **Number patterns** (L71-82): Hex, binary, octal, decimal, float, imaginary numbers
- **String patterns** (L85-158): All string prefix combinations, single/double/triple quotes
- **Token patterns** (L127-136): Complete token matching including whitespace, comments, continuations

### Core Variables
- **endpats** (L141-147): Maps string prefixes+quotes to continuation regex patterns
- **single_quoted/triple_quoted** (L151-158): Sets of valid quoted string prefixes
- **tabsize** (L160): Tab width constant

### Internal Implementation
- **_generate_tokens_from_c_tokenizer()** (L569-582): Delegates to C tokenizer via _tokenize module, handles SyntaxError transformation
- **_transform_msg()** (L559-567): Converts C tokenizer error messages for Python compatibility
- **main()** (L496-557): CLI interface for tokenizing files

## Architecture Notes
- Uses C tokenizer (_tokenize) for performance while maintaining Python API compatibility
- Supports both byte and string input streams
- Handles encoding detection per PEP-263
- Maintains position tracking for error reporting
- Supports f-string tokenization with bracket escaping in Untokenizer