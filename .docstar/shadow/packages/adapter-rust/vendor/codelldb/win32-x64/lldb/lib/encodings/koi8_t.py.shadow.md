# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/encodings/koi8_t.py
@source-hash: 9c9043814abdbe7d
@generated: 2026-02-09T18:10:56Z

Python character encoding codec implementation for KOI8-T (Tajik variant of KOI-8). This file provides complete codec infrastructure for converting between bytes and Unicode strings using the KOI8-T character mapping, commonly used for Tajik Cyrillic text.

## Primary Purpose
Implements Python's codec API for KOI8-T encoding, enabling text encoding/decoding operations through Python's standard codecs module. The codec handles 8-bit character mapping between byte values (0x00-0xFF) and Unicode code points.

## Core Components

**Codec Classes:**
- `Codec` (L10-16): Base codec with encode/decode methods using charmap operations
- `IncrementalEncoder` (L18-20): Stateless incremental encoding support
- `IncrementalDecoder` (L22-24): Stateless incremental decoding support  
- `StreamWriter` (L26-27): File-like writing interface (inherits from Codec + codecs.StreamWriter)
- `StreamReader` (L29-30): File-like reading interface (inherits from Codec + codecs.StreamReader)

**Registration Function:**
- `getregentry()` (L34-43): Returns CodecInfo object for codec registration with Python's encoding system

**Character Mapping Tables:**
- `decoding_table` (L48-305): 256-element tuple mapping byte values to Unicode characters
- `encoding_table` (L308): Reverse mapping built from decoding_table via codecs.charmap_build()

## Key Dependencies
- `codecs` module: Provides charmap encoding/decoding functions and base classes
- Standard codec registration mechanism via CodecInfo

## Character Set Details
- ASCII range (0x00-0x7F): Standard ASCII characters preserved
- Extended range (0x80-0xFF): Maps to Cyrillic letters, punctuation, and special characters
- Notable mappings include Tajik-specific Cyrillic variants with descenders and macrons
- Undefined byte values (0x88, 0x8F, 0x98, etc.) map to Unicode FFFE (replacement character)

## Architectural Pattern
Follows Python's standard codec architecture with separate encode/decode paths, incremental processing support, and stream interfaces. Uses charmap-based encoding for direct byte-to-Unicode mapping without stateful transformations.