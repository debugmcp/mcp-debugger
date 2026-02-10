# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/encodings/mac_iceland.py
@source-hash: 753cc1ac635caa7e
@generated: 2026-02-09T18:06:08Z

## Purpose
Auto-generated Python character mapping codec for Mac Iceland encoding, converting between byte sequences and Unicode text using Apple's ICELAND.TXT character mapping.

## Key Components

### Codec Classes (L9-42)
- **Codec** (L9-15): Base codec implementing `encode()` and `decode()` methods using `codecs.charmap_encode/decode` with encoding/decoding tables
- **IncrementalEncoder** (L17-19): Streaming encoder for partial input processing
- **IncrementalDecoder** (L21-23): Streaming decoder for partial input processing  
- **StreamWriter/StreamReader** (L25-29): File-like object wrappers inheriting from base Codec

### Registration Function (L33-42)
- **getregentry()**: Returns `CodecInfo` object registering all codec components with Python's encoding system under name 'mac-iceland'

### Character Mapping Tables (L47-307)
- **decoding_table** (L47-304): 256-element tuple mapping byte values (0x00-0xFF) to Unicode characters
  - 0x00-0x7F: Standard ASCII characters
  - 0x80-0xFF: Mac Iceland specific characters (accented letters, symbols, Apple logo at 0xF0)
- **encoding_table** (L307): Auto-generated reverse mapping from `codecs.charmap_build()`

## Architecture
Standard Python codec pattern using character mapping tables for bidirectional byte↔Unicode conversion. Follows encodings module conventions for automatic registration and discovery.

## Dependencies
- `codecs`: Core encoding/decoding functionality and base classes
- Generated from Apple's official ICELAND.TXT mapping via gencodec.py tool

## Notable Features
- Supports Icelandic characters (eth, thorn, accented vowels)
- Includes Apple logo character (U+F8FF) at position 0xF0
- Complete 8-bit character set with mathematical symbols and typographic marks