# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/base64.py
@source-hash: 8d1f608dbf030d11
@generated: 2026-02-09T18:12:54Z

## Primary Purpose
Standard Python base64 module providing comprehensive data encoding/decoding functionality for Base16, Base32, Base64, Base85, and Ascii85 formats. This is a vendored copy within the LLDB debugger package.

## Key Functions and Classes

### Input Validation
- `_bytes_from_decode_data(s)` (L34-46): Converts input to bytes, handling strings (ASCII-only), bytes, bytearrays, and memory views
- `_input_type_check(s)` (L524-537): Validates memory view format and dimensions for legacy functions

### Base64 Encoding/Decoding
- `b64encode(s, altchars=None)` (L51-62): Core Base64 encoder with optional alternative character set
- `b64decode(s, altchars=None, validate=False)` (L65-88): Core Base64 decoder with validation option
- `standard_b64encode/decode(s)` (L91-106): Standard alphabet wrappers
- `urlsafe_b64encode/decode(s)` (L112-134): URL-safe variants using '-' and '_' instead of '+' and '/'

### Base32 Encoding/Decoding  
- `_b32encode(alphabet, s)` (L166-200): Internal Base32 encoder using lookup tables with lazy initialization
- `_b32decode(alphabet, s, casefold=False, map01=None)` (L202-246): Internal Base32 decoder with digit mapping support
- `b32encode/decode(s)` (L249-256): Standard Base32 using alphabet 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
- `b32hexencode/decode(s)` (L258-266): Base32hex using alphabet '0123456789ABCDEFGHIJKLMNOPQRSTUV'

### Base16 Encoding/Decoding
- `b16encode(s)` (L272-275): Simple wrapper around binascii.hexlify with uppercase output
- `b16decode(s, casefold=False)` (L278-293): Decoder with case folding and validation

### Base85/Ascii85 Encoding/Decoding
- `_85encode(b, chars, chars2, pad=False, foldnuls=False, foldspaces=False)` (L304-326): Shared 85-bit encoder
- `a85encode(b, *, foldspaces=False, wrapcol=0, pad=False, adobe=False)` (L328-367): Ascii85 with Adobe framing support
- `a85decode(b, *, foldspaces=False, adobe=False, ignorechars=...)` (L369-437): Ascii85 decoder with whitespace handling
- `b85encode(b, pad=False)` (L447-459): Base85 encoder using Git/Mercurial alphabet
- `b85decode(b)` (L461-500): Base85 decoder with overflow protection

### Legacy Interface
- `encode(input, output)` (L509-515): File-based Base64 encoding with line length limits
- `decode(input, output)` (L518-522): File-based Base64 decoding  
- `encodebytes(s)` (L540-548): Multi-line Base64 encoding
- `decodebytes(s)` (L551-554): Single-line Base64 decoding

## Important Dependencies
- `binascii`: Core binary-to-ASCII conversion routines
- `struct`: Binary data packing/unpacking for Base85 operations
- `re`: Pattern matching for Base16 validation

## Global State and Caching
- `_b32tab2`, `_b32rev` (L163-164): Lazy-initialized Base32 lookup tables
- `_a85chars`, `_a85chars2` (L299-300): Lazy-initialized Ascii85 character tables
- `_b85chars`, `_b85chars2`, `_b85dec` (L443-445): Lazy-initialized Base85 tables
- Translation tables for URL-safe Base64 (L109-110)

## Notable Patterns
- Extensive use of lazy initialization for lookup tables to save memory
- Consistent error handling using binascii.Error for encoding issues
- Support for alternative alphabets and character mappings
- Padding validation and adjustment across all encoding schemes
- Memory-efficient streaming for large data via file-based interface