# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/encodings/koi8_u.py
@source-hash: d449f9858e357fa8
@generated: 2026-02-09T18:10:55Z

## KOI8-U Character Encoding Codec

**Purpose**: Provides Python codec support for KOI8-U (KOI8-Ukrainian) character encoding, generated from Unicode mapping tables using gencodec.py.

**Key Components:**

### Core Codec Classes
- **Codec (L9-15)**: Base codec with encode/decode methods using charmap operations
  - `encode()` (L11-12): Converts Unicode to KOI8-U bytes via encoding_table
  - `decode()` (L14-15): Converts KOI8-U bytes to Unicode via decoding_table

- **IncrementalEncoder (L17-19)**: Streaming encoder for incremental processing
- **IncrementalDecoder (L21-23)**: Streaming decoder for incremental processing
- **StreamWriter (L25-26)**: File-like object writer (inherits from Codec + StreamWriter)
- **StreamReader (L28-29)**: File-like object reader (inherits from Codec + StreamReader)

### Registration Function
- **getregentry() (L33-42)**: Returns CodecInfo object for Python's encoding registry
  - Registers codec name as 'koi8-u'
  - Provides all codec components for full encoding support

### Character Mapping Tables
- **decoding_table (L47-304)**: 256-element tuple mapping byte values (0x00-0xFF) to Unicode characters
  - 0x00-0x7F: Standard ASCII characters
  - 0x80-0x9F: Box drawing, mathematical symbols, and special characters
  - 0xA0-0xBF: Extended box drawing + Ukrainian/Russian Cyrillic characters
  - 0xC0-0xFF: Complete Cyrillic alphabet (lowercase 0xC0-0xDF, uppercase 0xE0-0xFF)

- **encoding_table (L307)**: Reverse mapping built from decoding_table via codecs.charmap_build()

**Dependencies**: 
- `codecs` module for all charmap operations and base classes
- Generated from external Unicode mapping file 'python-mappings/KOI8-U.TXT'

**Architecture**: Standard Python codec pattern with complete bidirectional character mapping support for KOI8-U encoding, commonly used for Ukrainian and Russian text.