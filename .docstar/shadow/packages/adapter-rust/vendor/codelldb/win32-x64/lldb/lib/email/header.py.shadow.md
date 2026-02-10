# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/email/header.py
@source-hash: 4d9baa908ad5288d
@generated: 2026-02-09T18:10:37Z

## Primary Purpose
Python email header encoding/decoding module implementing RFC 2047 and RFC 2822 standards. Provides functionality to decode encoded email headers (like `=?charset?encoding?text?=`) and construct properly formatted MIME headers with charset support and line folding.

## Key Classes & Functions

### Public API Functions
- `decode_header(header)` (L59-150): Decodes RFC 2047 encoded headers into list of (string, charset) tuples. Handles both quoted-printable ('q') and base64 ('b') encodings with Postel's law padding correction.
- `make_header(decoded_seq, maxlinelen, header_name, continuation_ws)` (L153-172): Creates Header instance from decode_header() output sequence.

### Core Classes
- `Header` (L175-405): Main class for constructing MIME-compliant headers with multi-charset support
  - `__init__()` (L176-221): Constructor with charset, line length, and folding options
  - `append(s, charset, errors)` (L261-302): Adds string chunks with charset handling
  - `encode(splitchars, maxlinelen, linesep)` (L309-387): Produces RFC-compliant encoded output with line folding
  - `_normalize()` (L389-405): Consolidates consecutive same-charset chunks

- `_ValueFormatter` (L408-533): Internal formatter handling line wrapping and encoding
  - `feed(fws, string, charset)` (L438-473): Processes string chunks with folding white space
  - `_ascii_split()` (L481-501): Splits ASCII headers at syntactic breaks

- `_Accumulator` (L536-573): List subclass tracking header line length and parts for folding decisions

## Important Dependencies
- `email.quoprimime`, `email.base64mime`: Encoding/decoding utilities
- `email.charset`: Charset handling (imported as `_charset`)
- `email.errors.HeaderParseError`: Exception for malformed headers

## Key Constants & Patterns
- `MAXLINELEN = 78`: RFC 2822 recommended line length
- `ecre` (L35-43): Regex for matching `=?charset?encoding?content?=` encoded words
- `fcre` (L48): Field name validation regex
- `_embedded_header` (L52): Security check for header injection attacks

## Critical Invariants
- Header chunks stored as (string, charset) tuples in `_chunks`
- Line folding respects RFC 2822 folding white space rules
- Charset encoding validation occurs during append operations
- Embedded header detection prevents injection attacks
- Base64 padding applied per Postel's law for malformed input

## Architectural Decisions
- Separation of decoding (parse existing) vs encoding (generate new) functionality
- Multi-pass normalization: parse → normalize → format → encode
- Pluggable charset system via email.charset module
- Defensive programming with padding correction and error handling
- Internal formatter abstraction for complex line-wrapping logic