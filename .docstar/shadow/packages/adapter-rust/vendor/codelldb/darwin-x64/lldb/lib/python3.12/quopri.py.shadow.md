# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/quopri.py
@source-hash: a1cd7f3b22033d32
@generated: 2026-02-09T18:07:54Z

## Purpose
Standard library implementation of quoted-printable encoding/decoding as per RFC 1521 (MIME). Provides both streaming and string-based conversions for email message encoding where binary data must be transmitted through 7-bit ASCII channels.

## Key Functions

### Core API (L44-162)
- `encode(input, output, quotetabs, header=False)` (L44-101): Streams quoted-printable encoding from input to output file objects. Uses optimized binascii.b2a_qp when available, falls back to manual implementation with line length limits (76 chars) and soft breaks.
- `decode(input, output, header=False)` (L114-153): Streams quoted-printable decoding from input to output. Uses binascii.a2b_qp when available, otherwise manually parses escape sequences and handles malformed data gracefully.
- `encodestring(s, quotetabs=False, header=False)` (L103-110): String-based encoding wrapper using BytesIO.
- `decodestring(s, header=False)` (L155-162): String-based decoding wrapper using BytesIO.

### Character Processing (L21-40)
- `needsquoting(c, quotetabs, header)` (L21-34): Determines if byte needs escaping based on printable ASCII range, tabs/spaces policy, and header mode.
- `quote(c)` (L36-40): Converts single byte to =XX hex escape sequence.

### Utilities (L167-186)
- `ishex(c)` (L167-170): Validates hexadecimal ASCII characters.
- `unhex(s)` (L172-186): Converts hex string to integer value.

### CLI Interface (L190-237)
- `main()` (L190-232): Command-line tool with encode/decode modes and tab quoting option.

## Constants (L9-18)
- `ESCAPE = b'='`, `MAXLINESIZE = 76`, `HEX = b'0123456789ABCDEF'`
- Optional binascii imports for performance (a2b_qp, b2a_qp)

## Architecture Decisions
- Graceful fallback from optimized binascii functions to pure Python implementation
- Streaming design for memory efficiency with large files
- RFC 1521/1522 compliant with special header mode (underscore-to-space conversion)
- Robust error handling for malformed escape sequences
- Line length management with soft breaks using trailing '=' character

## Key Behaviors
- Always encodes line-ending tabs/spaces regardless of quotetabs setting
- Header mode treats underscore as encoded space
- Handles both partial lines and complete lines during streaming
- Preserves original line endings in decoded output