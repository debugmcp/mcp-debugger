# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/encodings/utf_16_le.py
@source-hash: 3aedaf3eb4976928
@generated: 2026-02-09T18:10:56Z

## Purpose
Python codec module providing UTF-16 Little Endian encoding/decoding functionality. Part of Python's encoding system, likely bundled with LLDB for debugging support in the CodeLLDB adapter.

## Key Components

### Core Functions
- **encode** (L13): Direct reference to `codecs.utf_16_le_encode` for UTF-16 LE encoding
- **decode** (L15-16): Wrapper around `codecs.utf_16_le_decode` with BOM handling (third parameter `True`)

### Codec Classes
- **IncrementalEncoder** (L18-20): Stateful encoder for processing data in chunks, returns encoded bytes from tuple
- **IncrementalDecoder** (L22-23): Stateful decoder extending `BufferedIncrementalDecoder`, uses `_buffer_decode` pattern
- **StreamWriter** (L25-26): File-like writing interface with UTF-16 LE encoding
- **StreamReader** (L28-29): File-like reading interface with UTF-16 LE decoding

### Registration
- **getregentry** (L33-42): Returns `CodecInfo` object registering this codec with Python's encoding system under name 'utf-16-le'

## Dependencies
- `codecs` module: All functionality delegates to built-in UTF-16 LE codec functions

## Architecture Notes
- Standard Python codec pattern: thin wrapper around built-in codec functions
- BOM (Byte Order Mark) handling enabled in decode function
- Follows encodings module API contract for codec registration
- All classes are minimal wrappers providing consistent interface