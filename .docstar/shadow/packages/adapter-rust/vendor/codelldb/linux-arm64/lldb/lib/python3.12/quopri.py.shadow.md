# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/quopri.py
@source-hash: a1cd7f3b22033d32
@generated: 2026-02-09T18:09:01Z

## Purpose
Python 3.12 standard library module implementing quoted-printable encoding/decoding per RFC 1521. Provides both streaming (file-based) and string-based operations for converting binary data to/from quoted-printable format commonly used in email transport.

## Core API
- `encode(input, output, quotetabs, header=False)` (L44-101): Streams quoted-printable encoding from input file to output file
- `decode(input, output, header=False)` (L114-153): Streams quoted-printable decoding from input file to output file  
- `encodestring(s, quotetabs=False, header=False)` (L103-110): In-memory string encoding
- `decodestring(s, header=False)` (L155-162): In-memory string decoding

## Key Implementation Details

### Constants (L9-12)
- `ESCAPE = b'='`: Quoted-printable escape character
- `MAXLINESIZE = 76`: RFC 1521 line length limit
- `HEX = b'0123456789ABCDEF'`: Hexadecimal encoding table

### Optimization Strategy (L14-18)
Attempts to import fast `binascii.a2b_qp`/`b2a_qp` functions, falls back to pure Python implementation if unavailable. All main functions check for binascii availability first.

### Core Logic Functions
- `needsquoting(c, quotetabs, header)` (L21-34): Determines if byte needs encoding based on RFC rules
- `quote(c)` (L36-40): Converts single byte to =XX hex format
- `ishex(c)` (L167-170): Validates hexadecimal ASCII bytes
- `unhex(s)` (L172-186): Converts hex string to integer value

### Encoding Algorithm (L44-101)
1. Uses binascii if available, otherwise manual processing
2. Processes input line by line to handle line length limits
3. Implements soft line breaks (=\n) when lines exceed MAXLINESIZE
4. Special handling for trailing whitespace and lone periods
5. Header mode converts spaces to underscores per RFC 1522

### Decoding Algorithm (L114-153) 
1. Uses binascii if available, otherwise character-by-character parsing
2. Handles escape sequences, hex decoding, and malformed input gracefully
3. Strips trailing whitespace and manages partial lines
4. Header mode converts underscores back to spaces

### CLI Interface (L190-232)
- `main()` function provides command-line encoding/decoding
- Options: `-t` (quote tabs), `-d` (decode mode)
- Processes files or stdin, writes to stdout

## Dependencies
- `binascii` (optional): Fast C implementation fallback
- `io.BytesIO`: For string-based operations
- `sys`, `getopt`: For CLI functionality

## RFC Compliance
Implements RFC 1521 quoted-printable encoding with RFC 1522 header extensions. Handles line length limits, soft breaks, whitespace encoding, and malformed input recovery.