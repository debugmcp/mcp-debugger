# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/encodings/koi8_u.py
@source-hash: d449f9858e357fa8
@generated: 2026-02-09T18:06:09Z

**KOI8-U Character Encoding Codec**

This file implements a complete character encoding codec for KOI8-U (Ukrainian variant of KOI8-R), a legacy 8-bit Cyrillic encoding. Generated from the official Unicode mapping tables via `gencodec.py`.

**Primary Components:**

- **Codec (L9-16)**: Main codec class with `encode()` and `decode()` methods using `codecs.charmap_encode/decode()` with the encoding/decoding tables
- **IncrementalEncoder (L17-19)**: Stateful encoder for streaming operations, returns only the encoded bytes
- **IncrementalDecoder (L21-23)**: Stateful decoder for streaming operations, returns only the decoded string
- **StreamWriter (L25-26)**: File-like writer combining Codec with StreamWriter capabilities
- **StreamReader (L28-29)**: File-like reader combining Codec with StreamReader capabilities

**Registration Function:**
- **getregentry() (L33-42)**: Returns `CodecInfo` object registering this codec as 'koi8-u' with Python's encoding system

**Character Mapping Tables:**
- **decoding_table (L47-304)**: 256-element tuple mapping byte values (0x00-0xFF) to Unicode characters
  - 0x00-0x7F: Standard ASCII characters
  - 0x80-0x9F: Box drawing characters, mathematical symbols, and special characters
  - 0xA0-0xBF: More box drawing chars mixed with Cyrillic IO, Ukrainian IE, Byelorussian I, and Ukrainian YI variants
  - 0xC0-0xDF: Cyrillic lowercase letters (standard Russian + Ukrainian variants)
  - 0xE0-0xFF: Cyrillic uppercase letters (standard Russian + Ukrainian variants)
- **encoding_table (L307)**: Reverse mapping built from decoding_table via `codecs.charmap_build()`

**Dependencies:** Standard `codecs` module only

**Architecture:** Follows Python's standard codec pattern with charmap-based translation. The codec handles both regular and Ukrainian-specific Cyrillic characters, making it suitable for Ukrainian text processing in legacy systems.