# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/encodings/hex_codec.py
@source-hash: fc5f0a31b59efe99
@generated: 2026-02-09T18:10:47Z

## Purpose
Python codec implementation for hexadecimal encoding/decoding, providing 2-digit hex content transfer encoding. Part of LLDB's encoding utilities for converting between bytes and hexadecimal representation.

## Key Components

### Core Functions
- `hex_encode(input, errors='strict')` (L13-15): Converts bytes to hexadecimal using `binascii.b2a_hex()`, returns (encoded_data, input_length) tuple
- `hex_decode(input, errors='strict')` (L17-19): Converts hexadecimal back to bytes using `binascii.a2b_hex()`, returns (decoded_data, input_length) tuple

### Codec Classes
- `Codec` (L21-25): Base codec class implementing standard encode/decode interface, delegates to module-level functions
- `IncrementalEncoder` (L27-30): Streaming encoder for partial hex encoding, only supports 'strict' error handling
- `IncrementalDecoder` (L32-35): Streaming decoder for partial hex decoding, only supports 'strict' error handling
- `StreamWriter` (L37-38): File-like writer with hex encoding, inherits from Codec and codecs.StreamWriter
- `StreamReader` (L40-41): File-like reader with hex decoding, inherits from Codec and codecs.StreamReader

### Registration
- `getregentry()` (L45-55): Returns `CodecInfo` object for Python's codec registry, registers all codec components under name 'hex'

## Dependencies
- `codecs`: Python standard library codec infrastructure
- `binascii`: Binary-to-ASCII conversion utilities (core hex conversion logic)

## Design Patterns
- Standard Python codec pattern with separate functions and classes
- Strict error handling only - no graceful degradation for malformed input
- Bytes-to-bytes encoding (not text encoding, as indicated by `_is_text_encoding=False`)
- Consistent interface across stateful (Incremental/Stream) and stateless (function) variants

## Constraints
- All components assert `errors == 'strict'`, no other error handling modes supported
- Input/output is always bytes, never strings
- Stream classes set `charbuffertype = bytes` for proper buffer handling