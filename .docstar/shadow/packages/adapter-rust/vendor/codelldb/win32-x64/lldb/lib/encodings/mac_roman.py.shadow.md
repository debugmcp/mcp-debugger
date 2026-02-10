# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/encodings/mac_roman.py
@source-hash: 230367d96aef8e8d
@generated: 2026-02-09T18:10:57Z

## Purpose and Responsibility
Python character mapping codec for Mac Roman encoding, auto-generated from Apple's ROMAN.TXT mapping file. Provides bidirectional conversion between Unicode strings and Mac Roman byte sequences using Python's codec infrastructure.

## Core Architecture

**Codec Classes (L9-42):**
- `Codec` (L9-15): Base codec with `encode()` and `decode()` methods using charmap operations
- `IncrementalEncoder` (L17-19): Streaming encoder for partial input processing
- `IncrementalDecoder` (L21-23): Streaming decoder for partial input processing  
- `StreamWriter` (L25-26): File-like writing interface combining Codec + StreamWriter
- `StreamReader` (L28-29): File-like reading interface combining Codec + StreamReader

**Registration Function:**
- `getregentry()` (L33-42): Returns CodecInfo object for Python's encodings module registration as 'mac-roman'

## Data Tables

**Decoding Table (L47-304):**
- 256-element tuple mapping Mac Roman byte values (0x00-0xFF) to Unicode characters
- Covers ASCII (0x00-0x7F), Mac Roman extended characters (0x80-0xFF)
- Includes special Apple logo character at 0xF0 (L288)
- Each entry documented with hex code and Unicode character name

**Encoding Table (L307):**
- Auto-generated reverse mapping using `codecs.charmap_build()`
- Enables Unicode-to-Mac-Roman conversion

## Dependencies
- `codecs` module: Core Python codec infrastructure for all encoding/decoding operations

## Key Constraints
- Fixed 256-character mapping (single-byte encoding)
- Error handling delegated to Python's codec framework ('strict', 'ignore', 'replace' modes)
- Generated code - modifications would be overwritten by regeneration process