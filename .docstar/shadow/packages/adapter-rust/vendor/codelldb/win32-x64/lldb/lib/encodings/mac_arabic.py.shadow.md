# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/encodings/mac_arabic.py
@source-hash: 5eafd9a3136abfbd
@generated: 2026-02-09T18:10:58Z

## Character Encoding Implementation - Mac Arabic

Python character mapping codec implementing the Apple Arabic encoding (based on VENDORS/APPLE/ARABIC.TXT). This is an auto-generated codec file providing bidirectional text conversion between Unicode and Mac Arabic byte encoding.

### Core Classes

**Codec (L9-15)** - Primary codec class implementing encode/decode methods using `codecs.charmap_encode/decode` with the module's mapping tables.

**IncrementalEncoder (L17-19)** - Streaming encoder that processes input incrementally, returning only the encoded bytes portion.

**IncrementalDecoder (L21-23)** - Streaming decoder that processes input incrementally, returning only the decoded string portion.

**StreamWriter/StreamReader (L25-29)** - File-like stream interfaces inheriting from both Codec and respective codecs base classes.

### Registration Function

**getregentry() (L33-42)** - Returns `CodecInfo` object for codec registration with Python's encoding system. Maps codec name 'mac-arabic' to all codec components.

### Character Mapping Tables

**decoding_map (L46-176)** - Dictionary mapping Mac Arabic byte values (0x80-0xFF) to Unicode codepoints. Includes comprehensive Arabic character set, diacritics, punctuation, and Arabic-Indic numerals. Notable mappings include Arabic letters (0x00C1-0x00DA, 0x00E1-0x00EA), Arabic diacritics (0x00EB-0x00F2), and extended Arabic letters (0x00F3-0x00FF).

**decoding_table (L180-437)** - String tuple providing direct character lookup for decoding. Contains 256 entries mapping byte positions to actual Unicode characters. Handles control characters (0x00-0x1F), ASCII (0x20-0x7F), and Arabic-specific characters (0x80-0xFF).

**encoding_map (L441-698)** - Reverse mapping dictionary for encoding Unicode codepoints to Mac Arabic bytes. Contains bidirectional mappings for punctuation (supporting both left-right and right-left directionality) and comprehensive Arabic character coverage.

### Key Features

- Supports complete Arabic alphabet with proper Unicode mappings
- Handles Arabic-Indic numerals with directional context
- Includes Arabic punctuation and diacritical marks
- Provides bidirectional character support for mixed text
- Auto-generated from Apple's official character mapping specification

### Dependencies

- `codecs` module for character mapping infrastructure
- Follows Python codec registration protocol