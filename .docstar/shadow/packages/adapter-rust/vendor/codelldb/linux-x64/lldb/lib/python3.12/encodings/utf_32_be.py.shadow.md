# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/encodings/utf_32_be.py
@source-hash: cbba20e1f6d0879c
@generated: 2026-02-09T18:06:08Z

## UTF-32 Big-Endian Codec Implementation

Python encoding/decoding module that implements the UTF-32-BE (big-endian) character encoding. Part of the Python standard library encodings package, providing a complete codec interface for converting between Unicode strings and UTF-32-BE byte sequences.

### Core Functions
- **encode** (L8): Direct reference to `codecs.utf_32_be_encode` for string-to-bytes conversion
- **decode** (L10-11): Wrapper around `codecs.utf_32_be_decode` with BOM handling enabled via third parameter `True`

### Codec Classes
- **IncrementalEncoder** (L13-15): Handles piece-by-piece encoding, inherits from `codecs.IncrementalEncoder`. Uses internal error handling state via `self.errors`
- **IncrementalDecoder** (L17-18): Handles piece-by-piece decoding with buffering support, inherits from `codecs.BufferedIncrementalDecoder`. Delegates to `codecs.utf_32_be_decode` via `_buffer_decode` attribute
- **StreamWriter** (L20-21): File-like object wrapper for encoding, directly assigns `codecs.utf_32_be_encode` to encode method
- **StreamReader** (L23-24): File-like object wrapper for decoding, directly assigns `codecs.utf_32_be_decode` to decode method

### Registry Integration
- **getregentry** (L28-37): Returns `codecs.CodecInfo` object that registers this codec with Python's encoding system under the name 'utf-32-be'. Provides all required codec interfaces for complete integration.

### Architecture Notes
- Follows standard Python codec pattern: thin wrapper around C-implemented core functions in `codecs` module
- UTF-32-BE uses 4-byte fixed-width encoding with big-endian byte order
- BOM (Byte Order Mark) handling is explicitly enabled in decode function
- All classes delegate heavy lifting to optimized C implementations rather than implementing encoding logic in Python