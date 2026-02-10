# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/encodings/uu_codec.py
@source-hash: 45ba92000718abf8
@generated: 2026-02-09T18:11:00Z

## UU Encoding/Decoding Codec Implementation

**Primary Purpose:** Implements Python codec for UU (Unix-to-Unix) content transfer encoding, converting bytes to/from UU-encoded format for binary data transmission.

**Core Functions:**
- `uu_encode(input, errors, filename, mode)` (L16-35): Encodes binary data to UU format with "begin" header containing file permissions and name, processes data in 45-byte chunks using `binascii.b2a_uu()`, terminates with "end" marker
- `uu_decode(input, errors)` (L37-68): Decodes UU format back to binary, searches for "begin" line, processes each line with `binascii.a2b_uu()`, includes error recovery for malformed encoders (L61-62)

**Codec Classes:**
- `Codec` (L70-75): Base codec implementing encode/decode interface
- `IncrementalEncoder/IncrementalDecoder` (L77-83): Support for streaming/incremental processing
- `StreamWriter/StreamReader` (L85-89): File-like streaming interfaces with `charbuffertype = bytes`

**Key Dependencies:**
- `codecs`: Python codec framework integration
- `binascii`: Core UU encoding/decoding operations (`b2a_uu`, `a2b_uu`)
- `io.BytesIO`: In-memory binary buffer operations

**Registration Function:**
- `getregentry()` (L93-103): Returns `CodecInfo` object registering all codec components with name 'uu', marked as non-text encoding

**Notable Implementation Details:**
- Only supports 'strict' error handling mode (asserted in both encode/decode)
- Filename sanitization replaces newlines with escape sequences (L24-25)
- Error recovery handles broken UU encoders by recalculating expected byte count (L61-62)
- UU format uses octal file permissions and includes filename metadata in header