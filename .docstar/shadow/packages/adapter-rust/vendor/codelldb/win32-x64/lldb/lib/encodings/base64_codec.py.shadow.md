# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/encodings/base64_codec.py
@source-hash: cf9ac7a464f54149
@generated: 2026-02-09T18:10:33Z

## Purpose
Python codec implementation for base64 content transfer encoding. Provides a complete codec interface for bytes-to-bytes base64 encoding/decoding that integrates with Python's codecs framework.

## Key Components

### Core Encoding Functions
- `base64_encode(input, errors='strict')` (L13-15): Wrapper around `base64.encodebytes()` that returns tuple of (encoded_bytes, input_length). Only supports 'strict' error handling.
- `base64_decode(input, errors='strict')` (L17-19): Wrapper around `base64.decodebytes()` that returns tuple of (decoded_bytes, input_length). Only supports 'strict' error handling.

### Codec Classes
- `Codec` (L21-25): Main codec class inheriting from `codecs.Codec`. Provides `encode()` and `decode()` methods that delegate to the core functions.
- `IncrementalEncoder` (L27-30): Supports incremental encoding via `encode(input, final=False)`. Ignores the `final` parameter and directly calls `base64.encodebytes()`.
- `IncrementalDecoder` (L32-35): Supports incremental decoding via `decode(input, final=False)`. Ignores the `final` parameter and directly calls `base64.decodebytes()`.
- `StreamWriter` (L37-38): Stream-based encoder inheriting from both `Codec` and `codecs.StreamWriter`. Sets `charbuffertype = bytes`.
- `StreamReader` (L40-41): Stream-based decoder inheriting from both `Codec` and `codecs.StreamReader`. Sets `charbuffertype = bytes`.

### Registration Function
- `getregentry()` (L45-55): Returns a `codecs.CodecInfo` object that registers all codec components with the Python codecs system. Sets `_is_text_encoding=False` to indicate this is a binary codec.

## Dependencies
- `codecs`: Python's codec framework
- `base64`: Standard library base64 encoding/decoding functions

## Architectural Notes
- All error handling is hard-coded to 'strict' mode only via assertions
- The incremental encoders/decoders don't actually implement incremental behavior - they process entire input at once
- This is a binary-to-binary codec (bytes input/output) as indicated by `_is_text_encoding=False`
- Uses composition pattern where codec classes delegate to standalone encode/decode functions