# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/base64.py
@source-hash: 8d1f608dbf030d11
@generated: 2026-02-09T18:07:06Z

## Base Data Encodings Module

**Purpose**: Python standard library module providing comprehensive encoding/decoding functionality for Base16, Base32, Base64, Base85, and ASCII85 data formats. Part of Python's standard library, conforming to RFC 3548 standards.

### Core Dependencies
- `binascii`: Low-level binary-ASCII conversion operations
- `struct`: Binary data packing/unpacking for multi-byte encodings
- `re`: Regular expressions for Base16 validation

### Key Functions

#### Base64 Encoding Family
- `b64encode(s, altchars=None)` (L51-62): Core Base64 encoder with optional alternative alphabet
- `b64decode(s, altchars=None, validate=False)` (L65-88): Core Base64 decoder with validation options
- `standard_b64encode(s)` (L91-96): Standard RFC alphabet encoder
- `standard_b64decode(s)` (L98-106): Standard RFC alphabet decoder
- `urlsafe_b64encode(s)` (L112-119): URL/filesystem-safe variant (- and _ characters)
- `urlsafe_b64decode(s)` (L121-134): URL/filesystem-safe decoder

#### Base32 Encoding Family
- `_b32encode(alphabet, s)` (L166-200): Internal Base32 encoder with chunked processing
- `_b32decode(alphabet, s, casefold=False, map01=None)` (L202-246): Internal Base32 decoder with digit mapping
- `b32encode(s)` (L249-251): Standard Base32 encoder
- `b32decode(s, casefold=False, map01=None)` (L253-256): Standard Base32 decoder with optional 0/1 mapping
- `b32hexencode(s)` (L258-260): Base32hex variant encoder
- `b32hexdecode(s, casefold=False)` (L262-266): Base32hex variant decoder

#### Base16 Encoding
- `b16encode(s)` (L272-275): Hexadecimal encoding (uppercase output)
- `b16decode(s, casefold=False)` (L278-293): Hexadecimal decoding with case folding option

#### Base85/ASCII85 Encoding
- `_85encode(b, chars, chars2, pad=False, foldnuls=False, foldspaces=False)` (L304-326): Shared 85-bit encoder
- `a85encode(b, *, foldspaces=False, wrapcol=0, pad=False, adobe=False)` (L328-367): ASCII85 encoder with Adobe framing
- `a85decode(b, *, foldspaces=False, adobe=False, ignorechars=b' \t\n\r\v')` (L369-437): ASCII85 decoder
- `b85encode(b, pad=False)` (L447-459): Base85 encoder
- `b85decode(b)` (L461-500): Base85 decoder

#### Legacy Interface
- `encode(input, output)` (L509-515): File-based Base64 encoding with line wrapping
- `decode(input, output)` (L518-522): File-based Base64 decoding
- `encodebytes(s)` (L540-548): Multi-line Base64 encoding
- `decodebytes(s)` (L551-554): Base64 decoding from bytes

### Key Data Structures
- `_b32alphabet` (L161): Standard Base32 alphabet constant
- `_b32hexalphabet` (L162): Base32hex alphabet constant
- `_b32tab2` (L163): Global encoding lookup table cache
- `_b32rev` (L164): Global decoding lookup table cache
- `_b85alphabet` (L441-442): Base85 alphabet specification
- `_urlsafe_encode_translation` (L109): URL-safe character translation table
- `_urlsafe_decode_translation` (L110): URL-safe decode translation table

### Utility Functions
- `_bytes_from_decode_data(s)` (L34-46): Input normalization for decode operations
- `_input_type_check(s)` (L524-537): Type validation for legacy functions

### Architecture Notes
- Lazy initialization pattern for lookup tables to save memory
- Extensive use of global caches for performance optimization
- RFC 3548 compliance for all standard encodings
- Comprehensive error handling with appropriate exception types
- Support for both string and bytes-like object inputs

### Constants
- `MAXLINESIZE = 76` (L506): Maximum line length for legacy encoding
- `MAXBINSIZE = 57` (L507): Maximum binary chunk size derived from line limit