# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/encodings/mac_greek.py
@source-hash: 63016a323ddf98cb
@generated: 2026-02-09T18:10:56Z

## Purpose
Python character mapping codec for the Apple Mac Greek (Macintosh Greek) encoding, generated from Apple's GREEK.TXT mapping file. Provides bidirectional conversion between bytes and Unicode for Greek text encoded in Apple's legacy character set.

## Key Components

### Codec Classes
- **Codec (L9-15)**: Base codec providing `encode()` and `decode()` methods using charmap operations
- **IncrementalEncoder (L17-19)**: Stateful encoder for streaming encoding operations
- **IncrementalDecoder (L21-23)**: Stateful decoder for streaming decoding operations  
- **StreamWriter (L25-26)**: File-like writer interface combining Codec with StreamWriter
- **StreamReader (L28-29)**: File-like reader interface combining Codec with StreamReader

### Registration Function
- **getregentry() (L33-42)**: Returns CodecInfo object for 'mac-greek' encoding registration with Python's codec system

### Character Mapping Tables
- **decoding_table (L47-304)**: Tuple mapping byte values (0x00-0xFF) to Unicode characters, extensively documented with hex codes and character names
- **encoding_table (L307)**: Generated reverse mapping table created via `codecs.charmap_build()`

## Architecture
Standard Python codec module pattern using character mapping approach. The decoding table maps 256 byte values to corresponding Unicode characters, with ASCII range (0x00-0x7F) preserved and extended range (0x80-0xFF) mapping to Greek letters, accented characters, and special symbols.

## Dependencies
- `codecs` module: All codec functionality and charmap operations
- Generated from Apple's official GREEK.TXT mapping using gencodec.py tool

## Key Characteristics
- Supports full Greek alphabet with tonos (accent) variants
- Includes mathematical symbols, currency signs, and typographic marks
- Maintains ASCII compatibility in lower 128 characters
- Euro sign mapping updated for Mac OS 9.2.2+ (L204 comment)