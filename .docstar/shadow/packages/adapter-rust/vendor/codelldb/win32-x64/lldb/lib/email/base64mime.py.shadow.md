# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/email/base64mime.py
@source-hash: e2b4b87a5f42a8c5
@generated: 2026-02-09T18:10:31Z

## Purpose
MIME Base64 encoding/decoding module for email content transfer per RFCs 2045-2047. Handles both email headers and bodies with Base64 encoding, designed for attaching 8-bit data (images, audio, text) to email messages.

## Key Functions

**header_length(bytearray) (L49-56)**
- Calculates encoded length for Base64-encoded data
- Uses formula: (groups_of_3 * 4) + (4 if leftover bytes)
- Pure calculation utility, no actual encoding

**header_encode(header_bytes, charset='iso-8859-1') (L59-70)**
- Encodes single header line using RFC 2045 encoded-word format
- Returns format: `=?charset?b?encoded_data?=`
- Auto-converts strings to bytes using specified charset
- Primary function for email header encoding

**body_encode(s, maxlinelen=76, eol=NL) (L73-95)**
- Encodes string data with line wrapping for email bodies
- Chunks input based on `maxlinelen * 3 // 4` to respect line limits
- Handles end-of-line normalization (NL vs CRLF)
- Uses `b2a_base64()` for actual encoding

**decode(string) (L98-110)**
- Decodes raw Base64 strings to bytes objects
- Handles both string and bytes input
- Uses 'raw-unicode-escape' encoding for string inputs
- Does NOT parse full MIME headers (delegates to email.header)

## Dependencies
- `base64.b64encode` - Standard Base64 encoding
- `binascii.b2a_base64, a2b_base64` - Binary-to-ASCII conversion utilities

## Constants & Aliases
- `CRLF = '\r\n'`, `NL = '\n'`, `EMPTYSTRING = ''` (L40-42)
- `MISC_LEN = 7` (L45) - Referenced but unused in this file
- `body_decode = decode` (L114) - Backwards compatibility alias
- `decodestring = decode` (L115) - Compatibility with standard base64 module

## Architectural Notes
- Separation of concerns: headers vs bodies have different encoding needs
- Line wrapping logic accounts for Base64 expansion ratio (4:3)
- Charset handling is explicit and configurable
- Module focuses on encoding/decoding only, NOT line wrapping or header parsing