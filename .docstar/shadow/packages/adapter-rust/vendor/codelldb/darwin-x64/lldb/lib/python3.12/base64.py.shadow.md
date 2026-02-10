# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/base64.py
@source-hash: 8d1f608dbf030d11
@generated: 2026-02-09T18:09:35Z

## Python base64 Module - Data Encoding Library

**Primary Purpose**: Comprehensive implementation of Base16, Base32, Base64, Base85, and ASCII85 data encodings as specified in RFC 3548 and related standards. Part of Python's standard library for binary-to-text encoding operations.

### Core Architecture

**Input Validation Helper**:
- `_bytes_from_decode_data()` (L34-46): Converts string/bytes-like inputs to bytes, handling ASCII encoding and type validation

**Base64 Implementation** (relies on binascii module):
- `b64encode()` (L51-62): Core Base64 encoding with optional alternative character substitution
- `b64decode()` (L65-88): Core Base64 decoding with validation and alternative character support
- `standard_b64encode/decode()` (L91-106): Standard RFC 3548 Base64 alphabet wrappers
- `urlsafe_b64encode/decode()` (L112-134): URL/filesystem-safe variants using '-' and '_' characters
- Translation tables `_urlsafe_encode_translation`, `_urlsafe_decode_translation` (L109-110)

**Base32 Implementation** (pure Python):
- `_b32encode()` (L166-200): Generic Base32 encoder using configurable alphabets, handles 5-byte quanta with padding
- `_b32decode()` (L202-246): Generic Base32 decoder with case folding and 0/1 character mapping
- `b32encode/decode()` (L249-256): Standard Base32 using alphabet A-Z, 2-7
- `b32hexencode/decode()` (L258-266): Extended Hex Base32 using 0-9, A-V
- Alphabets: `_b32alphabet` (L161), `_b32hexalphabet` (L162)
- Global caches: `_b32tab2`, `_b32rev` (L163-164) for lookup tables

**Base16 Implementation**:
- `b16encode()` (L272-275): Uppercase hexadecimal encoding via binascii
- `b16decode()` (L278-293): Hexadecimal decoding with case folding and validation

**ASCII85 Implementation**:
- `_85encode()` (L304-326): Shared encoder for both ASCII85 and Base85, handles word-based encoding
- `a85encode()` (L328-367): Adobe ASCII85 with space folding, line wrapping, and framing options
- `a85decode()` (L369-437): ASCII85 decoder handling special sequences 'z' (all zeros) and 'y' (spaces)
- Constants: `_A85START`, `_A85END` (L301-302) for Adobe framing

**Base85 Implementation**:
- `b85encode()` (L447-459): RFC 1924 Base85 encoding using 85-character alphabet
- `b85decode()` (L461-500): Base85 decoder with overflow protection
- Alphabet: `_b85alphabet` (L441-442) - comprehensive 85-character set

**Legacy Interface** (L502-555):
- `encode/decode()` (L509-522): File-based Base64 operations with line length limits
- `encodebytes/decodebytes()` (L540-554): Byte string operations
- Constants: `MAXLINESIZE=76`, `MAXBINSIZE=57` (L506-507)
- `_input_type_check()` (L524-537): Validates memory view format and dimensions

**CLI Interface**:
- `main()` (L558-582): Command-line script supporting encode/decode operations

### Key Dependencies
- `binascii`: Core encoding/decoding operations for Base64/Base16
- `struct`: Binary data packing for Base85/ASCII85 implementations
- `re`: Pattern matching for Base16 validation

### Design Patterns
- **Lazy Initialization**: Lookup tables initialized on first use (Base32, Base85, ASCII85)
- **Template Method**: `_85encode()` shared between ASCII85 and Base85
- **Global Caching**: Reusable translation tables stored in module globals
- **Type Flexibility**: Consistent handling of bytes-like objects and ASCII strings

### Critical Constraints
- Base32: Input length must be multiple of 8 for decoding
- Base85: Uses 5-byte input quanta, 4-byte output quanta
- ASCII85: Special handling for all-zero and all-space sequences
- Padding validation enforced across all formats