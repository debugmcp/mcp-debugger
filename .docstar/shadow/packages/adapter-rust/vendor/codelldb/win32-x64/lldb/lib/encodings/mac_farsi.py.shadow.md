# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/encodings/mac_farsi.py
@source-hash: f5763c38fb4ab042
@generated: 2026-02-09T18:10:57Z

## Mac Farsi Encoding Module

**Purpose**: Python character mapping codec for Apple's Mac Farsi encoding, providing bidirectional conversion between Unicode and the Mac Farsi character set based on Apple's FARSI.TXT mapping table.

### Core Components

**Codec Classes**:
- `Codec` (L9-15): Main codec class with `encode()` and `decode()` methods using `codecs.charmap_encode/decode`
- `IncrementalEncoder` (L17-19): Streaming encoder for partial input processing
- `IncrementalDecoder` (L21-23): Streaming decoder for partial input processing  
- `StreamWriter` (L25-26): File-like object wrapper for encoding
- `StreamReader` (L28-29): File-like object wrapper for decoding

**Registration Function**:
- `getregentry()` (L33-42): Returns `CodecInfo` object for codec registration with Python's encoding system, mapping codec name 'mac-farsi' to implementation classes

**Character Mapping Tables**:
- `decoding_table` (L47-304): 256-element tuple mapping byte values (0x00-0xFF) to Unicode characters
  - 0x00-0x7F: Standard ASCII characters with bidirectional context annotations
  - 0x80-0xFF: Mac Farsi specific mappings including Arabic letters, extended Arabic-Indic digits, and diacritical marks
- `encoding_table` (L307): Reverse mapping table built from `decoding_table` using `codecs.charmap_build()`

### Key Features

**Bidirectional Support**: Comments indicate left-right vs right-left text direction for proper Arabic script rendering
**Context-Sensitive Display**: ASCII digits 0-9 display as Extended Arabic-Indic digits in Arabic script contexts
**Complete Arabic Coverage**: Includes Arabic letters (0x621-0x64A), diacritics (0x64B-0x652), and Persian extensions (0x67E, 0x679, etc.)

### Dependencies
- `codecs` module: Core encoding/decoding functionality
- Generated from Apple's official FARSI.TXT mapping using gencodec.py

This codec enables proper handling of Persian/Farsi text in legacy Mac encoding within modern Unicode-based Python applications.