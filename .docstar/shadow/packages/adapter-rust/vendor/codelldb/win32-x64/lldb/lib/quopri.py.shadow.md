# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/quopri.py
@source-hash: a1cd7f3b22033d32
@generated: 2026-02-09T18:12:59Z

## Purpose
Implements quoted-printable encoding/decoding as per RFC 1521 for email transport. Provides both streaming file-based operations and string-based convenience functions with optional binascii acceleration.

## Key Constants (L9-12)
- `ESCAPE = b'='` - Quoted-printable escape character
- `MAXLINESIZE = 76` - RFC 1521 line length limit
- `HEX = b'0123456789ABCDEF'` - Hex digit lookup table

## Core Encoding Functions
- `needsquoting(c, quotetabs, header)` (L21-34) - Determines if byte needs encoding based on RFC rules and flags
- `quote(c)` (L36-40) - Converts single byte to =XX hex representation
- `encode(input, output, quotetabs, header=False)` (L44-101) - Main streaming encoder with soft line breaks and RFC compliance
- `encodestring(s, quotetabs=False, header=False)` (L103-110) - Convenience wrapper for string encoding

## Core Decoding Functions
- `decode(input, output, header=False)` (L114-153) - Main streaming decoder handling escape sequences and soft breaks
- `decodestring(s, header=False)` (L155-162) - Convenience wrapper for string decoding

## Helper Functions
- `ishex(c)` (L167-170) - Validates hexadecimal ASCII bytes
- `unhex(s)` (L172-186) - Converts hex byte sequence to integer

## Acceleration Strategy (L14-18)
Attempts to import optimized `binascii` functions (`a2b_qp`, `b2a_qp`). Falls back to pure Python implementation if unavailable.

## RFC Compliance Features
- Handles header mode (spaces as underscores per RFC 1522)
- Enforces 76-character line limits with soft breaks (=\n)
- Quotes trailing whitespace and special characters
- Processes line endings correctly
- Handles partial lines and malformed escape sequences gracefully

## CLI Interface
`main()` (L190-232) provides command-line tool with `-t` (quote tabs) and `-d` (decode) options, supporting stdin/file processing.

## Architecture Pattern
Uses optional fast-path with binascii acceleration, transparent fallback to pure Python implementation. Streaming design minimizes memory usage for large inputs.