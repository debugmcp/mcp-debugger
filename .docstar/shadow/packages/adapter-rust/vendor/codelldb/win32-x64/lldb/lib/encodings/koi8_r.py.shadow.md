# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/encodings/koi8_r.py
@source-hash: 4d4e353aee8039bb
@generated: 2026-02-09T18:11:00Z

## Primary Purpose

Python character encoding/decoding implementation for KOI8-R (Russian 8-bit character encoding). Auto-generated from Unicode mapping tables, provides bidirectional conversion between KOI8-R byte sequences and Unicode text for Russian Cyrillic text processing.

## Core Architecture

Built on Python's `codecs` framework with charmap-based encoding/decoding. Uses lookup tables for O(1) character conversion rather than algorithmic transformation.

## Key Classes & Functions

**Codec (L9-15)**: Main codec class implementing encode/decode methods
- `encode()` (L11-12): Converts Unicode to KOI8-R bytes using `encoding_table`
- `decode()` (L14-15): Converts KOI8-R bytes to Unicode using `decoding_table`

**IncrementalEncoder (L17-19)**: Stateful encoder for streaming data
- `encode()` (L18-19): Returns only the encoded bytes (index [0]) from charmap_encode

**IncrementalDecoder (L21-23)**: Stateful decoder for streaming data  
- `decode()` (L22-23): Returns only the decoded string (index [0]) from charmap_decode

**StreamWriter (L25-26)**: File-like object writer combining Codec + StreamWriter
**StreamReader (L28-29)**: File-like object reader combining Codec + StreamReader

**getregentry() (L33-42)**: Required encodings module API function returning CodecInfo registration structure

## Data Tables

**decoding_table (L47-304)**: 256-element tuple mapping KOI8-R byte values (0x00-0xFF) to Unicode characters
- 0x00-0x7F: Standard ASCII (identical mapping)
- 0x80-0x9F: Box drawing, mathematical symbols, special characters
- 0xA0-0xBF: Extended box drawing + Cyrillic Ё/Ё characters
- 0xC0-0xFF: Complete Russian Cyrillic alphabet (lowercase C0-DF, uppercase E0-FF)

**encoding_table (L307)**: Reverse mapping built via `codecs.charmap_build()` for Unicode→KOI8-R conversion

## Dependencies

- `codecs`: Python standard library for codec framework and charmap utilities

## Critical Design Notes

- Generated code: Hand-editing discouraged, regenerate from mapping files
- Character coverage: Russian Cyrillic + box drawing + basic mathematical symbols
- Error handling: Supports 'strict', 'ignore', 'replace' error modes via codecs framework
- Performance: Direct table lookup, no computational overhead
- Bidirectional: Both encode/decode paths use symmetric charmap approach