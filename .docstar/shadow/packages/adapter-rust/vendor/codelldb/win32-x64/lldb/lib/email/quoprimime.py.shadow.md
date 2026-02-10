# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/email/quoprimime.py
@source-hash: 77b454bd3ba3b5e3
@generated: 2026-02-09T18:10:39Z

## Purpose
Email quoted-printable content transfer encoding implementation per RFCs 2045-2047. Provides encoding/decoding for 8-bit text data in email headers and bodies, making non-ASCII characters safe for 7-bit email transport.

## Core Functionality

### Encoding Maps (L55-70)
- `_QUOPRI_MAP`: Base mapping of all 256 octets to quoted-printable form (`=%02X`)
- `_QUOPRI_HEADER_MAP`: Header-safe characters (alphanumeric + `-!*+/`, spaces → underscores)
- `_QUOPRI_BODY_MAP`: Body-safe characters (printable ASCII + space/tab)
- `_QUOPRI_BODY_ENCODE_MAP` (L148-151): Body encoding variant preserving CRLF

### Header Operations
- `header_check(octet)` (L74-76): Tests if octet needs header encoding
- `header_length(bytearray)` (L84-94): Calculates encoded header length
- `header_encode(header_bytes, charset)` (L127-145): RFC 2047 Q-encoding with charset wrapper
- `header_decode(s)` (L292-300): Decodes Q-encoded headers, converts `_` to space

### Body Operations  
- `body_check(octet)` (L79-81): Tests if octet needs body encoding
- `body_length(bytearray)` (L97-104): Calculates encoded body length
- `body_encode(body, maxlinelen=76, eol=NL)` (L153-226): Full body encoding with line wrapping
  - Handles soft line breaks (`=` + EOL)
  - Special whitespace handling at line ends (L205-218)
  - Prevents breaking quoted sequences (L194-202)

### Decoding Operations
- `decode(encoded, eol=NL)` (L232-276): Universal decoder for quoted-printable
- `body_decode`, `decodestring` (L280-281): Aliases for backward compatibility
- `unquote(s)` (L118-120): Converts `=AB` to ASCII character
- `quote(c)` (L123-124): Converts character to quoted form

### Utilities
- `_max_append(L, s, maxlen, extra)` (L107-115): Helper for length-constrained appending
- `_unquote_match(match)` (L285-288): Regex callback for header decoding

## Key Constants
- `CRLF`, `NL`, `EMPTYSTRING` (L46-48): Line ending definitions
- Safe character sets derived from RFC 2045 specifications

## Dependencies
- `re`: Regex operations for header decoding
- `string`: ASCII character sets for safe character mapping

## Design Notes
- Separate handling for headers vs bodies due to different safe character sets
- Headers use underscore for space encoding, bodies preserve spaces
- Line length management prevents email transport issues
- Backward compatibility maintained through function aliases