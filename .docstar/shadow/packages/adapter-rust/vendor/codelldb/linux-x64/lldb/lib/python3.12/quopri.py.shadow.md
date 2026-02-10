# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/quopri.py
@source-hash: a1cd7f3b22033d32
@generated: 2026-02-09T18:09:54Z

**Purpose:** Python standard library module implementing quoted-printable encoding/decoding as per RFC 1521/1522. Provides both streaming file-based operations and string-based convenience functions.

**Architecture:** 
- Prefers optimized `binascii` module functions (`a2b_qp`, `b2a_qp`) when available (L15-18), falls back to pure Python implementation
- Supports two encoding modes: standard quoted-printable and RFC 1522 header encoding (spaces as underscores)

**Core Constants (L9-12):**
- `ESCAPE = b'='`: Quoted-printable escape character
- `MAXLINESIZE = 76`: RFC-mandated maximum line length
- `HEX = b'0123456789ABCDEF'`: Hexadecimal digit lookup table

**Key Functions:**

**Character Analysis:**
- `needsquoting(c, quotetabs, header)` (L21-34): Determines if byte needs encoding based on RFC rules and mode flags
- `quote(c)` (L36-40): Converts single byte to =XX hex representation

**Encoding Functions:**
- `encode(input, output, quotetabs, header=False)` (L44-101): Main streaming encoder with line length management and soft breaks
- `encodestring(s, quotetabs=False, header=False)` (L103-110): Convenience wrapper for in-memory encoding

**Decoding Functions:**
- `decode(input, output, header=False)` (L114-153): Streaming decoder handling escape sequences and RFC 1522 underscores
- `decodestring(s, header=False)` (L155-162): Convenience wrapper for in-memory decoding

**Utilities:**
- `ishex(c)` (L167-170): Validates hexadecimal ASCII bytes
- `unhex(s)` (L172-186): Converts hex string to integer value
- `main()` (L190-232): Command-line interface supporting encode/decode operations with tab quoting

**Critical Implementation Details:**
- Line-ending whitespace always encoded per RFC 1521 (L62-63)
- Soft line breaks inserted at 75 chars to accommodate trailing `=` (L95)
- Handles partial lines and preserves original line endings (L128-134, L141-142)
- Graceful degradation when `binascii` unavailable

**Dependencies:** Optional `binascii` module, `io.BytesIO` for string operations, standard `sys`/`getopt` for CLI