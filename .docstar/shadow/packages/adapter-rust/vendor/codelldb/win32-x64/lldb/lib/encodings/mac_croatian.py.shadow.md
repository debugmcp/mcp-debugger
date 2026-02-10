# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/encodings/mac_croatian.py
@source-hash: a880cd05c82a8d11
@generated: 2026-02-09T18:10:57Z

## Purpose
This file implements a Python character encoding codec for the Mac Croatian character set, generated from Apple's Croatian character mapping table. It provides bidirectional conversion between Unicode strings and Mac Croatian encoded bytes.

## Architecture
The file follows the standard Python codec pattern with separate classes for different encoding/decoding modes and a registration function for the Python encodings system.

## Key Components

### Core Codec Classes
- **Codec** (L9-15): Base codec class implementing `encode()` and `decode()` methods using charmap operations
- **IncrementalEncoder** (L17-19): Handles incremental encoding for streaming data
- **IncrementalDecoder** (L21-23): Handles incremental decoding for streaming data  
- **StreamWriter** (L25-26): Stream-based writer combining Codec and StreamWriter functionality
- **StreamReader** (L28-29): Stream-based reader combining Codec and StreamReader functionality

### Registration
- **getregentry()** (L33-42): Returns CodecInfo object for registering codec with Python's encoding system, named 'mac-croatian'

### Character Mapping Tables
- **decoding_table** (L47-304): Tuple mapping 256 byte values (0x00-0xFF) to Unicode characters, including control characters, ASCII, and Croatian-specific characters with diacritics
- **encoding_table** (L307): Reverse mapping generated from decoding_table using `codecs.charmap_build()`

## Character Set Coverage
- ASCII characters (0x00-0x7F): Standard ASCII mapping
- Extended characters (0x80-0xFF): Croatian-specific characters including:
  - Latin characters with diacritics (č, ć, š, ž, đ)
  - Mathematical symbols (∞, ≤, ≥, ∑, ∏)
  - Typography symbols (—, ", ", €, ‰)
  - Special Apple logo character (0xD8)

## Dependencies
- **codecs** module: Provides charmap encoding/decoding functions and base classes

## Usage Pattern
This codec integrates with Python's encoding system, allowing text to be encoded/decoded using `text.encode('mac-croatian')` or `bytes.decode('mac-croatian')` once registered.