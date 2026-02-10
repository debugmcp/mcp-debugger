# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/encodings/mac_iceland.py
@source-hash: 753cc1ac635caa7e
@generated: 2026-02-09T18:10:58Z

This is a Python character encoding codec for Mac Iceland encoding, auto-generated from Apple's ICELAND.TXT mapping table using gencodec.py. It provides bidirectional conversion between Mac Iceland byte sequences and Unicode text.

## Core Purpose
Implements the Python codecs interface for Mac Iceland character encoding (named 'mac-iceland'), enabling text encoding/decoding between this legacy Apple encoding and Unicode.

## Key Components

### Codec Classes (L9-30)
- **Codec** (L9-15): Main codec class implementing encode() and decode() methods using charmap operations
- **IncrementalEncoder** (L17-19): Streaming encoder for incremental text processing  
- **IncrementalDecoder** (L21-23): Streaming decoder for incremental text processing
- **StreamWriter** (L25-26): File-like writer interface (empty implementation, inherits from Codec)
- **StreamReader** (L28-29): File-like reader interface (empty implementation, inherits from Codec)

### Registration Function (L33-42)
- **getregentry()**: Returns CodecInfo object registering all codec components with Python's encoding system

### Character Mapping Tables (L45-307)
- **decoding_table** (L47-304): Tuple mapping 256 byte values (0x00-0xFF) to their Unicode equivalents
  - First 128 entries (0x00-0x7F) are standard ASCII
  - Upper 128 entries (0x80-0xFF) contain Iceland-specific characters including:
    - Icelandic accented letters (eth, thorn, various diacritics)
    - Mathematical symbols (infinity, summation, integral, etc.)
    - Typographic characters (em dash, quotation marks, ellipsis)
    - Apple logo character at 0xF0
- **encoding_table** (L307): Auto-generated reverse mapping from Unicode to Mac Iceland bytes

## Dependencies
- Standard `codecs` module for charmap encoding/decoding operations

## Architecture Notes
- Uses Python's built-in charmap codec infrastructure for actual conversion work
- Follows standard Python codec registration pattern via getregentry()
- Generated code pattern with extensive character mapping table
- Bidirectional mapping ensures lossless round-trip conversion for supported characters