# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/encodings/quopri_codec.py
@source-hash: 502a213c34c05a94
@generated: 2026-02-09T18:10:55Z

## Primary Purpose
Python codec implementation for quoted-printable encoding/decoding, providing a complete codec interface that integrates with Python's encoding system. Wraps the standard library `quopri` module to provide bytes-to-bytes transformation.

## Core Functions
- `quopri_encode(input, errors='strict')` (L10-15): Encodes bytes to quoted-printable format using BytesIO buffers, returns tuple of (encoded_bytes, input_length)
- `quopri_decode(input, errors='strict')` (L17-22): Decodes quoted-printable bytes back to original format, returns tuple of (decoded_bytes, input_length)

## Codec Classes
- `Codec` (L24-28): Base codec class implementing encode/decode methods, delegates to module-level functions
- `IncrementalEncoder` (L30-32): Supports incremental encoding, returns only encoded bytes (not tuple)
- `IncrementalDecoder` (L34-36): Supports incremental decoding, returns only decoded bytes (not tuple)
- `StreamWriter` (L38-39): Stream-based writer with `charbuffertype = bytes`
- `StreamReader` (L41-42): Stream-based reader with `charbuffertype = bytes`

## Registration Interface
- `getregentry()` (L46-56): Returns `CodecInfo` object for Python's encoding registry, marks as non-text encoding (`_is_text_encoding=False`)

## Key Dependencies
- `codecs`: Python's codec infrastructure
- `quopri`: Standard library quoted-printable implementation
- `io.BytesIO`: In-memory byte stream handling

## Architecture Notes
- All operations are bytes-to-bytes transformations
- Error handling is strict-only (asserts `errors == 'strict'`)
- Uses quotetabs=True for encoding to handle tabs properly
- Incremental classes only return transformed data, not length tuples
- Stream classes inherit from both Codec and respective codecs stream classes