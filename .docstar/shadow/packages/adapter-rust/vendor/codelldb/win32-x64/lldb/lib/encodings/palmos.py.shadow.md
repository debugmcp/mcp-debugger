# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/encodings/palmos.py
@source-hash: eccf7418adefcc2a
@generated: 2026-02-09T18:10:57Z

## Purpose

Python character encoding codec for PalmOS 3.5 character set. Implements bidirectional text conversion between Unicode and the PalmOS 3.5 byte encoding using charmap-based translation tables.

## Core Components

**Codec Classes (L11-31)**:
- `Codec` (L11-16): Base codec with `encode()` and `decode()` methods using `codecs.charmap_encode/decode`
- `IncrementalEncoder` (L18-20): Incremental encoding support for streaming
- `IncrementalDecoder` (L22-24): Incremental decoding support for streaming  
- `StreamWriter/StreamReader` (L26-30): Stream-based I/O wrappers inheriting from Codec

**Registration Function (L34-43)**:
- `getregentry()`: Returns `CodecInfo` object registering the codec with Python's encoding system
- Maps codec name 'palmos' to all codec classes and functions

**Character Mapping Tables**:
- `decoding_table` (L48-305): 256-element tuple mapping byte values (0x00-0xFF) to Unicode characters
- `encoding_table` (L308): Reverse mapping built from decoding table using `codecs.charmap_build()`

## Key Characteristics

**Character Set**: 
- Bytes 0x00-0x7F: Standard ASCII characters
- Bytes 0x80-0x9F: Extended characters including Euro sign (€), typographic quotes, card suits
- Bytes 0xA0-0xFF: Latin-1 supplement characters with diacritical marks

**Dependencies**:
- `codecs` module for charmap encoding/decoding infrastructure
- Uses standard Python codec registration patterns

**Architecture Pattern**:
- Standard Python codec implementation following the template established by other charmap codecs
- Stateless design with lookup table-based translation
- Complete codec suite supporting all Python text encoding interfaces