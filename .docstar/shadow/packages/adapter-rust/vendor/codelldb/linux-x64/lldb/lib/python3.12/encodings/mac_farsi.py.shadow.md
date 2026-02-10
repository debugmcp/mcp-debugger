# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/encodings/mac_farsi.py
@source-hash: f5763c38fb4ab042
@generated: 2026-02-09T18:06:13Z

## Python Character Encoding for Mac Farsi (Apple Persian)

This file implements a Python character encoding codec for the Mac Farsi character set, originally derived from Apple's FARSI.TXT mapping table. It provides bidirectional conversion between Unicode characters and the Mac Farsi byte encoding.

### Core Components

**Main Codec Classes:**
- `Codec` (L9-15): Base codec class implementing `encode()` and `decode()` methods using character map tables
- `IncrementalEncoder` (L17-19): Supports incremental encoding for streaming data
- `IncrementalDecoder` (L21-23): Supports incremental decoding for streaming data  
- `StreamWriter` (L25-26): Combines Codec with StreamWriter for file operations
- `StreamReader` (L28-29): Combines Codec with StreamReader for file operations

**Registration Function:**
- `getregentry()` (L33-42): Returns CodecInfo object to register this codec with Python's encoding system as 'mac-farsi'

### Character Mapping Tables

**Decoding Table (L47-304):**
- Maps 256 byte values (0x00-0xFF) to Unicode characters
- Includes ASCII control characters (0x00-0x1F), standard ASCII printable characters (0x20-0x7F)
- Extended characters (0x80-0xFF) map to Latin accented characters, Arabic letters, and Persian-specific characters
- Notable features:
  - Bidirectional text support with left-right and right-left directional markers
  - Arabic-Indic digits (0x06F0-0x06F9) for Persian numeral display
  - Complete Arabic alphabet plus Persian extensions (PEH, TCHEH, etc.)
  - Arabic diacritical marks for proper text rendering

**Encoding Table (L307):**
- Auto-generated reverse mapping using `codecs.charmap_build()` from the decoding table

### Dependencies
- `codecs` module: Provides base codec infrastructure and charmap encoding/decoding functions

### Architectural Notes
- Uses Python's standard charmap codec pattern for simple byte-to-Unicode mappings
- Designed for Apple's legacy Mac Farsi encoding used in older Persian text files
- Supports both incremental processing and streaming I/O operations
- Character comments include directional information crucial for proper Persian/Arabic text display