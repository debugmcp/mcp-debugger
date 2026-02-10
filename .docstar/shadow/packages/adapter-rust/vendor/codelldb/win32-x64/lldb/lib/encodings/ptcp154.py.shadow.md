# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/encodings/ptcp154.py
@source-hash: 0eabcb2c287d335e
@generated: 2026-02-09T18:10:57Z

## PTCP154 Character Encoding Codec

**Primary Purpose**: Implements a complete Python codec for the PTCP154 character encoding (Cyrillic encoding used in Kazakhstan), providing bidirectional conversion between byte sequences and Unicode strings.

**Key Components**:

- **Codec class (L14-20)**: Core codec implementation with `encode()` and `decode()` methods using charmap tables
- **IncrementalEncoder class (L22-24)**: Stateful encoder for streaming operations  
- **IncrementalDecoder class (L26-28)**: Stateful decoder for streaming operations
- **StreamWriter/StreamReader classes (L30-34)**: File-like stream interfaces combining codec functionality
- **getregentry() function (L38-47)**: Module registration function returning CodecInfo object for Python's codec registry
- **decoding_table (L52-309)**: Complete 256-entry tuple mapping byte values (0x00-0xFF) to Unicode characters
- **encoding_table (L312)**: Reverse mapping table auto-generated from decoding_table using `codecs.charmap_build()`

**Architecture**: 
- Follows standard Python codec module pattern using `codecs.charmap_encode/decode` for actual conversion work
- Character mapping approach: direct byte-to-Unicode lookup table for single-byte encoding
- Supports ASCII (0x00-0x7F) plus Cyrillic characters and special symbols (0x80-0xFF)

**Dependencies**: 
- `codecs` module for charmap encoding/decoding infrastructure and base classes
- No external dependencies beyond Python standard library

**Key Invariants**:
- decoding_table must contain exactly 256 entries (one per byte value)
- encoding_table is the mathematical inverse of decoding_table
- All codec classes delegate to `codecs.charmap_*` functions with the same tables

**Generated Code**: Auto-generated from PTCP154.txt specification using gencodec.py tool, not intended for manual modification.