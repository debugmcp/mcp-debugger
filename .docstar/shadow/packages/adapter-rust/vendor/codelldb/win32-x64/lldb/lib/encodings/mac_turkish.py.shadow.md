# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/encodings/mac_turkish.py
@source-hash: 99758a5cad2825cb
@generated: 2026-02-09T18:10:59Z

## Primary Purpose
Auto-generated Python character encoding codec for Mac Turkish character set, providing bidirectional conversion between bytes and Unicode text using Apple's Turkish encoding mapping.

## Key Components

**Codec Classes (L9-29)**
- `Codec` (L9-15): Base codec with `encode()` and `decode()` methods using charmap operations
- `IncrementalEncoder` (L17-19): Streaming encoder for incremental text processing
- `IncrementalDecoder` (L21-23): Streaming decoder for incremental byte processing  
- `StreamWriter` (L25-26): File-like writer interface (inherits from Codec + codecs.StreamWriter)
- `StreamReader` (L28-29): File-like reader interface (inherits from Codec + codecs.StreamReader)

**Registration Function (L33-42)**
- `getregentry()`: Returns `CodecInfo` object for Python's codec registry, enabling `codecs.lookup('mac-turkish')`

**Character Mapping Tables (L47-307)**
- `decoding_table` (L47-304): 256-element tuple mapping byte values (0x00-0xFF) to Unicode characters
  - 0x00-0x7F: Standard ASCII characters
  - 0x80-0xFF: Mac Turkish-specific characters including Turkish letters (Ğ, ğ, İ, ı, Ş, ş), special symbols, and mathematical characters
- `encoding_table` (L307): Reverse mapping built from decoding table via `codecs.charmap_build()`

## Dependencies
- `codecs` module: Provides character mapping encode/decode functions and base classes

## Architecture Notes
- Generated code pattern: File header indicates automatic generation from Apple's TURKISH.TXT mapping
- Charmap codec design: Uses lookup tables for O(1) character conversion
- Standard Python codec interface: Implements all required classes for full codec registry integration
- Turkish-specific mappings: Includes dotted/dotless I variants (İ/ı) and other Turkish diacritical characters

## Critical Constraints
- Fixed 8-bit encoding: Limited to 256 character mappings (single-byte encoding)
- Apple-specific: Uses Apple's proprietary character assignments, may differ from other Turkish encodings
- Private use area characters: Contains Apple logo (0xF0 → U+F8FF) and undefined character (0xF5 → U+F8A0)