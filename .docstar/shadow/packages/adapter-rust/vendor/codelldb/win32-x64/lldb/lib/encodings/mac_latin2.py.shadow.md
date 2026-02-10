# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/encodings/mac_latin2.py
@source-hash: 31670da18ce8b539
@generated: 2026-02-09T18:10:57Z

## Mac Latin2 Character Encoding Codec

Auto-generated Python character mapping codec for the Mac Latin2 encoding, providing complete bidirectional conversion between Unicode and Mac Latin2 byte sequences.

### Primary Purpose
Implements a Python codec for the Mac Latin2 character encoding (based on Apple's LATIN2.TXT mapping) that supports streaming, incremental, and batch encoding/decoding operations through the Python `codecs` framework.

### Key Classes and Functions

**Codec (L14-20)**: Core codec class implementing basic encode/decode operations
- `encode()` (L16-17): Converts Unicode strings to Mac Latin2 bytes using charmap encoding
- `decode()` (L19-20): Converts Mac Latin2 bytes to Unicode strings using charmap decoding

**IncrementalEncoder (L22-24)**: Stateful encoder for processing data in chunks
- `encode()` (L23-24): Processes input incrementally, returns only the encoded bytes

**IncrementalDecoder (L26-28)**: Stateful decoder for processing data in chunks  
- `decode()` (L27-28): Processes input incrementally, returns only the decoded string

**StreamWriter (L30-31)**: File-like interface for encoding streams
**StreamReader (L33-34)**: File-like interface for decoding streams

**getregentry() (L38-47)**: Codec registration function returning CodecInfo object with all codec components for the 'mac-latin2' encoding name

### Character Mapping Tables

**decoding_table (L52-309)**: Comprehensive 256-entry tuple mapping Mac Latin2 byte values (0x00-0xFF) to Unicode characters
- Entries 0x00-0x7F: Standard ASCII characters
- Entries 0x80-0xFF: Mac Latin2 specific characters including Central/Eastern European diacritics, mathematical symbols, and typographic marks

**encoding_table (L312)**: Reverse mapping table built from decoding_table using `codecs.charmap_build()` for efficient Unicode-to-byte conversion

### Dependencies
- `codecs` module: Provides charmap encoding/decoding infrastructure and codec registration framework

### Architecture Notes
- Generated code following standard Python codec patterns
- Uses character mapping approach rather than algorithmic conversion
- Supports all standard Python codec interfaces (batch, incremental, streaming)
- Bidirectional mapping ensures round-trip fidelity between Unicode and Mac Latin2