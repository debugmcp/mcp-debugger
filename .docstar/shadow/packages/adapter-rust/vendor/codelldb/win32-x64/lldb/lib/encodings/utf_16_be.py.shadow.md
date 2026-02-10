# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/encodings/utf_16_be.py
@source-hash: 3357196f3fa52433
@generated: 2026-02-09T18:10:58Z

## UTF-16 Big Endian Codec Implementation

This file implements a Python codec for UTF-16 Big Endian encoding, providing a complete interface for encoding/decoding text data to/from UTF-16-BE format.

### Core Purpose
Defines codec classes and functions that wrap Python's built-in `codecs.utf_16_be_*` functions to provide a standard encodings module interface for UTF-16-BE character encoding.

### Key Components

**Codec Functions:**
- `encode` (L13): Direct reference to `codecs.utf_16_be_encode`
- `decode()` (L15-16): Wrapper around `codecs.utf_16_be_decode` with `True` for final parameter

**Incremental Processing Classes:**
- `IncrementalEncoder` (L18-20): Handles streaming encoding, returns only encoded bytes (index 0)
- `IncrementalDecoder` (L22-23): Buffered decoder using `_buffer_decode` attribute pattern

**Stream Processing Classes:**
- `StreamWriter` (L25-26): File-like object for writing UTF-16-BE encoded data
- `StreamReader` (L28-29): File-like object for reading UTF-16-BE encoded data

**Registration Function:**
- `getregentry()` (L33-42): Returns `CodecInfo` object bundling all codec components for Python's encoding registry

### Dependencies
- `codecs` module: Provides all underlying UTF-16-BE encoding/decoding functionality

### Architecture Pattern
Follows Python's standard codec module pattern:
1. Thin wrapper functions around built-in codecs
2. Incremental and streaming class implementations
3. Registry function returning `CodecInfo` for system integration

### Critical Notes
- Decoder always passes `True` as final parameter to underlying function
- Encoder extracts only bytes portion (index 0) from encode result tuple
- All actual encoding logic delegated to built-in `codecs` module functions