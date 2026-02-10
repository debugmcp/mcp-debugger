# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/email/charset.py
@source-hash: a90653f13a4dc5eb
@generated: 2026-02-09T18:10:35Z

## Primary Purpose
Core charset handling module for email processing, providing character set encoding/decoding functionality with RFC-compliant email header and body encoding support. Manages character set aliases, codec mappings, and encoding strategies for various international character sets.

## Key Components

### Constants & Configuration (L21-62)
- **Encoding flags**: `QP` (quoted-printable), `BASE64`, `SHORTEST` (L22-24)
- **CHARSETS dict** (L35-62): Maps character sets to (header_encoding, body_encoding, output_charset) tuples
- **ALIASES dict** (L66-91): Character set alias mappings (e.g., 'latin-1' → 'iso-8859-1')
- **CODEC_MAP dict** (L95-102): Maps character sets to Python codec names

### Registry Functions (L106-151)
- `add_charset()` (L106-131): Registers new character set with encoding properties
- `add_alias()` (L134-140): Adds character set aliases
- `add_codec()` (L143-150): Maps character sets to Unicode codecs

### Core Class: Charset (L162-398)
Primary class for character set operations with attributes:
- `input_charset`: Normalized input character set name
- `header_encoding`/`body_encoding`: Encoding strategy (QP/BASE64/None)
- `output_charset`: Target character set for conversion
- `input_codec`/`output_codec`: Python codec names

#### Key Methods:
- `__init__()` (L206-237): Initializes charset with alias resolution and codec lookup
- `get_body_encoding()` (L245-264): Returns content-transfer-encoding string/function
- `header_encode()` (L274-291): Encodes strings for email headers with RFC 2047 compliance
- `header_encode_lines()` (L293-352): Line-length-aware header encoding with character-by-character splitting
- `body_encode()` (L369-398): Encodes message body content
- `_get_encoder()` (L354-367): Selects appropriate encoder module (base64/quoted-printable)

### Utility Functions
- `_encode()` (L155-159): Handles encoding with special case for unknown-8bit surrogate escapes

## Architecture & Dependencies
- Imports `email.base64mime`, `email.quoprimime` for encoding implementations
- Uses `email.encoders.encode_7or8bit` for fallback encoding
- Integrates with `email.errors` for charset validation
- Employs `functools.partial` for encoder function creation

## Critical Design Patterns
- **Registry pattern**: Global dictionaries for charset configuration
- **Strategy pattern**: Pluggable encoding strategies via constants
- **Fallback handling**: Graceful degradation for unknown character sets
- **RFC compliance**: Strict adherence to email standards (RFC 2047, RFC 2046)

## Key Invariants
- SHORTEST encoding only valid for headers, not body (enforced L129-130, L258)
- Character set names normalized to lowercase (L218)
- ASCII-only character set names required (L212-217)
- Unknown character sets default to (SHORTEST, BASE64, None) encoding (L224-225)