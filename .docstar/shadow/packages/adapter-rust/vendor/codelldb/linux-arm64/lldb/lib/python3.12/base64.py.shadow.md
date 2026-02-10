# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/base64.py
@source-hash: 8d1f608dbf030d11
@generated: 2026-02-09T18:08:39Z

## Base64/Base32/Base16/Base85/Ascii85 Encoding Library

Comprehensive Python module providing multiple binary-to-text encoding schemes per RFC 3548 and related standards.

### Primary Components

**Core Input Validation**
- `_bytes_from_decode_data(s)` (L34-46): Normalizes input to bytes, handles str→ascii conversion, supports bytes-like objects
- `_input_type_check(s)` (L524-537): Validates memoryview format/dimensions for legacy functions

**Base64 Implementation** (RFC 3548)
- `b64encode(s, altchars=None)` (L51-62): Standard Base64 with optional character substitution
- `b64decode(s, altchars=None, validate=False)` (L65-88): Decoding with validation options
- `standard_b64encode/decode(s)` (L91-106): Wrapper functions for standard alphabet
- `urlsafe_b64encode/decode(s)` (L112-134): URL/filesystem-safe variants using `-_` instead of `+/`

**Base32 Implementation** 
- `_b32encode/decode(alphabet, s, ...)` (L166-246): Core algorithms with alphabet selection
- Global lookup tables: `_b32tab2`, `_b32rev` (L163-164) - lazily initialized for performance
- `b32encode/decode(s, ...)` (L249-256): RFC 4648 standard Base32
- `b32hexencode/decode(s, ...)` (L258-266): Extended hex alphabet variant
- Template docstrings (L139-160): Dynamic documentation generation

**Base16 Implementation**
- `b16encode(s)` (L272-275): Uppercase hex encoding via binascii.hexlify
- `b16decode(s, casefold=False)` (L278-293): Regex validation + unhexlify

**Base85/Ascii85 Implementation**
- `_85encode(b, chars, chars2, ...)` (L304-326): Shared encoding core with compression options
- `a85encode/decode(b, ...)` (L328-437): Adobe Ascii85 with framing markers `<~...~>`
- `b85encode/decode(b)` (L447-500): Git/Mercurial Base85 variant
- Lazy table initialization pattern for `_a85chars*`, `_b85chars*`, `_b85dec`

**Legacy Interface**
- `encode/decode(input, output)` (L509-522): File-based encoding with MAXLINESIZE chunking
- `encodebytes/decodebytes(s)` (L540-554): Multi-line Base64 for backwards compatibility

### Key Architectural Patterns

**Lazy Initialization**: All encoding tables use global caching with None-checks to avoid memory waste
**Character Translation**: Extensive use of `bytes.maketrans()` for alphabet substitution
**Error Handling**: Consistent `binascii.Error` propagation with descriptive messages
**Input Flexibility**: Universal acceptance of bytes-like objects + ASCII strings

### Dependencies
- `binascii`: Core encoding/decoding operations
- `struct`: Big-endian integer packing for multi-byte encodings  
- `re`: Base16 alphabet validation

### Critical Constraints
- Base32/85 require specific padding rules (multiples of 8/5 respectively)
- Ascii85 uses special sequences: 'z'→4 nulls, 'y'→4 spaces (optional)
- URL-safe Base64 translation must be applied post-encoding for correct padding