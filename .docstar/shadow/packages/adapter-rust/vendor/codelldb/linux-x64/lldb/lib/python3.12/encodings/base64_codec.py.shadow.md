# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/encodings/base64_codec.py
@source-hash: cf9ac7a464f54149
@generated: 2026-02-09T18:06:05Z

## Purpose
Python codec implementation for base64 content transfer encoding, providing bidirectional bytes-to-bytes encoding/decoding functionality through the standard Python codecs framework.

## Key Components

**Core Functions:**
- `base64_encode()` (L13-15): Encodes bytes input using `base64.encodebytes()`, returns tuple of (encoded_data, input_length). Only supports 'strict' error handling.
- `base64_decode()` (L17-19): Decodes base64 bytes using `base64.decodebytes()`, returns tuple of (decoded_data, input_length). Only supports 'strict' error handling.

**Codec Classes:**
- `Codec` (L21-25): Main codec class inheriting from `codecs.Codec`, delegates to core functions
- `IncrementalEncoder` (L27-30): Supports incremental encoding, ignores `final` parameter
- `IncrementalDecoder` (L32-35): Supports incremental decoding, ignores `final` parameter  
- `StreamWriter` (L37-38): Stream-based encoder with `charbuffertype = bytes`
- `StreamReader` (L40-41): Stream-based decoder with `charbuffertype = bytes`

**Registration:**
- `getregentry()` (L45-55): Returns `CodecInfo` object for codec registration, sets `_is_text_encoding=False` indicating binary codec

## Dependencies
- `codecs`: Python standard library codec framework
- `base64`: Standard library base64 encoding/decoding

## Architecture Notes
- Strict error handling only - all classes assert `errors == 'strict'`
- Binary codec design: operates on bytes objects, not text
- Follows Python codec API patterns with encode/decode returning (result, consumed_length) tuples
- Incremental encoders ignore the `final` parameter but still function correctly