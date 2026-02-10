# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/encodings/mac_cyrillic.py
@source-hash: 83616786a1c6308b
@generated: 2026-02-09T18:10:56Z

## Mac Cyrillic Character Encoding Codec

Auto-generated Python codec implementation for the mac_cyrillic character encoding, based on Apple's CYRILLIC.TXT mapping file. Provides bidirectional conversion between bytes and Unicode strings using character mapping tables.

### Key Components

**Codec Classes (L9-29)**
- `Codec` (L9-15): Base codec with `encode()` and `decode()` methods using charmap operations
- `IncrementalEncoder` (L17-19): Streaming encoder for partial input processing
- `IncrementalDecoder` (L21-23): Streaming decoder for partial input processing  
- `StreamWriter` (L25-26): File-like writing interface (empty implementation inherits from base)
- `StreamReader` (L28-29): File-like reading interface (empty implementation inherits from base)

**Registration Function (L33-42)**
- `getregentry()`: Returns `CodecInfo` object for codec registration with Python's encoding system
- Registers codec name as 'mac-cyrillic'
- Provides all required codec interfaces (encode/decode, incremental, streaming)

**Character Mapping Tables (L47-307)**
- `decoding_table` (L47-304): 256-entry tuple mapping byte values (0x00-0xFF) to Unicode characters
- Maps ASCII characters (0x00-0x7F) to themselves
- Maps extended bytes (0x80-0xFF) to Cyrillic characters and special symbols
- `encoding_table` (L307): Auto-generated reverse mapping using `codecs.charmap_build()`

### Character Set Coverage
- Standard ASCII (0x00-0x7F): Control characters, digits, Latin letters, punctuation
- Cyrillic letters (0x80-0xFF): Complete Russian alphabet plus extended Cyrillic for other Slavic languages
- Special symbols: Typographic marks, mathematical symbols, currency signs

### Dependencies
- `codecs` module: Provides core encoding/decoding infrastructure and charmap utilities

### Usage Pattern
File serves as a codec module that can be imported by Python's encoding system to handle mac_cyrillic encoded text. The `getregentry()` function is called during codec registration to obtain the codec implementation.