# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/base64.py
@source-hash: 8d1f608dbf030d11
@generated: 2026-02-09T18:09:35Z

## Base64/Base32/Base16/Base85/Ascii85 Data Encodings Module

**Primary Purpose:** Standard Python library module providing comprehensive implementation of various binary-to-text encoding schemes as specified in RFC 3548 and related standards. Supports Base64, Base32, Base16 (hex), Base85, and Ascii85 encodings with multiple variants and configuration options.

**Core Dependencies:**
- `binascii` (L11): Low-level binary/ASCII conversion functions
- `struct` (L10): Binary data packing/unpacking 
- `re` (L9): Regular expressions for validation

**Key Encoding Functions:**

**Base64 Implementation:**
- `b64encode(s, altchars=None)` (L51-62): Primary Base64 encoder with optional alternative alphabet
- `b64decode(s, altchars=None, validate=False)` (L65-88): Base64 decoder with validation options
- `standard_b64encode/decode(s)` (L91-106): Standard RFC 3548 Base64 without customization
- `urlsafe_b64encode/decode(s)` (L112-134): URL/filesystem-safe variant using '-' and '_' instead of '+' and '/'

**Base32 Implementation:**
- `_b32encode(alphabet, s)` (L166-200): Core Base32 encoding engine with custom alphabet support
- `_b32decode(alphabet, s, casefold=False, map01=None)` (L202-246): Core Base32 decoder with case-folding and 0/1 mapping
- `b32encode/decode(s)` (L249-256): Standard Base32 using alphabet `_b32alphabet` (L161)
- `b32hexencode/hexdecode(s)` (L258-266): Extended hex Base32 using `_b32hexalphabet` (L162)

**Base16 Implementation:**
- `b16encode(s)` (L272-275): Simple hex encoding via `binascii.hexlify()`
- `b16decode(s, casefold=False)` (L278-293): Hex decoder with case-folding and validation

**Base85/Ascii85 Implementation:**
- `_85encode()` (L304-326): Shared encoding engine for both Base85 variants
- `a85encode(b, foldspaces=False, wrapcol=0, pad=False, adobe=False)` (L328-367): Ascii85 with Adobe framing support
- `a85decode(b, foldspaces=False, adobe=False, ignorechars=...)` (L369-437): Ascii85 decoder with whitespace handling
- `b85encode/decode(b, pad=False)` (L447-500): Standard Base85 implementation

**Utility Functions:**
- `_bytes_from_decode_data(s)` (L34-46): Input normalization for decoders, handles str/bytes/memoryview
- `_input_type_check(s)` (L524-537): Validates input types for legacy functions

**Legacy Interface:**
- `encode/decode(input, output)` (L509-522): File-based Base64 encoding/decoding
- `encodebytes/decodebytes(s)` (L540-554): Multi-line Base64 for backward compatibility
- `main()` (L558-582): Command-line interface

**Global State & Caching:**
- `_b32tab2`, `_b32rev` (L163-164): Lazy-initialized lookup tables for Base32
- `_a85chars`, `_a85chars2`, `_b85chars`, `_b85chars2`, `_b85dec` (L299-445): Lazy-initialized tables for Base85 variants
- Translation tables for URL-safe Base64 (L109-110)

**Key Constants:**
- `MAXLINESIZE = 76`, `MAXBINSIZE = 57` (L506-507): Legacy line length limits
- Base32 alphabets and Adobe Ascii85 markers (L161-162, L301-302)

**Architecture Notes:**
- Extensive use of lazy initialization to minimize memory footprint
- Consistent error handling via `binascii.Error` and `ValueError`
- Support for both string and bytes-like inputs with automatic conversion
- Modular design allowing alphabet customization for Base32/85 variants