# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/quopri.py
@source-hash: a1cd7f3b22033d32
@generated: 2026-02-09T18:07:12Z

## Primary Purpose
Standard library module implementing quoted-printable encoding/decoding per RFC 1521. Provides both file-based and string-based conversion functions with optional optimizations via binascii module.

## Key Constants (L9-12)
- `ESCAPE = b'='`: Quoted-printable escape character
- `MAXLINESIZE = 76`: RFC 1521 line length limit
- `HEX = b'0123456789ABCDEF'`: Hexadecimal digit lookup table
- `EMPTYSTRING = b''`: Empty bytes constant for joining

## Core Encoding Functions
- `needsquoting(c, quotetabs, header)` (L21-34): Determines if byte needs quoting based on RFC rules and context flags
- `quote(c)` (L36-40): Converts single byte to =XX hex representation
- `encode(input, output, quotetabs, header=False)` (L44-101): Main encoding function with file I/O, handles line length limits and soft breaks
- `encodestring(s, quotetabs=False, header=False)` (L103-110): String-based encoding wrapper

## Core Decoding Functions  
- `decode(input, output, header=False)` (L114-153): Main decoding function with file I/O, handles escape sequences and partial lines
- `decodestring(s, header=False)` (L155-162): String-based decoding wrapper

## Helper Functions
- `ishex(c)` (L167-170): Validates hexadecimal ASCII bytes
- `unhex(s)` (L172-186): Converts hex byte sequence to integer value

## Optimization Strategy
Module attempts to import `a2b_qp` and `b2a_qp` from binascii (L14-18) for performance. Falls back to pure Python implementation if unavailable.

## Command Line Interface
- `main()` (L190-232): CLI with -t (quote tabs) and -d (decode) options, processes files or stdin/stdout

## RFC Compliance Features
- Line length enforcement with soft breaks (=\n)
- Trailing whitespace encoding requirements
- Header mode underscore-space conversion (RFC 1522)
- Proper handling of escape sequences and malformed input

## Architecture Notes
Uses streaming approach for file processing to handle large inputs efficiently. Implements stateful line processing to handle soft line breaks correctly.