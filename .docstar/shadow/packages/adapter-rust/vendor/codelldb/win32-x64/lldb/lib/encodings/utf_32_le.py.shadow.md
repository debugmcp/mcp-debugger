# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/encodings/utf_32_le.py
@source-hash: 9134b91047d85b44
@generated: 2026-02-09T18:10:58Z

## UTF-32 Little Endian Codec Implementation

This file implements a Python codec for UTF-32 Little Endian encoding, providing a complete set of encoding/decoding interfaces following Python's codec architecture.

### Primary Purpose
Registers and implements the 'utf-32-le' codec with the Python encodings system, wrapping the native `codecs.utf_32_le_encode` and `codecs.utf_32_le_decode` functions with proper error handling and streaming capabilities.

### Key Components

**Core API Functions:**
- `encode` (L8): Direct reference to `codecs.utf_32_le_encode`
- `decode(input, errors='strict')` (L10-11): Wrapper around `codecs.utf_32_le_decode` with BOM handling enabled

**Incremental Processing Classes:**
- `IncrementalEncoder` (L13-15): Extends `codecs.IncrementalEncoder`, implements chunked encoding
- `IncrementalDecoder` (L17-18): Extends `codecs.BufferedIncrementalDecoder`, uses `_buffer_decode` for buffered decoding

**Streaming Classes:**
- `StreamWriter` (L20-21): File-like encoding interface using `codecs.utf_32_le_encode`
- `StreamReader` (L23-24): File-like decoding interface using `codecs.utf_32_le_decode`

**Registration Function:**
- `getregentry()` (L28-37): Returns `codecs.CodecInfo` object that registers all codec components with the Python encodings system

### Architecture Notes
- Follows standard Python codec module pattern with consistent class hierarchy
- All encoding/decoding operations delegate to native `codecs` module functions
- BOM (Byte Order Mark) handling is explicitly enabled in the decode function (third parameter `True`)
- Part of LLDB's Python environment, indicating use in debugging/development tools

### Dependencies
- `codecs` module: Provides all underlying UTF-32 LE implementation