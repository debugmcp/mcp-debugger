# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/email/parser.py
@source-hash: 88890ea9994c55ff
@generated: 2026-02-09T18:10:34Z

## Purpose
Email parser module implementing RFC 2822 and MIME message parsing capabilities. Provides four main parser classes for different input types (string/bytes) and parsing modes (full/headers-only).

## Key Classes

### Parser (L16-64)
Main text-based email parser class. Constructor accepts optional `_class` parameter for message object instantiation and `policy` parameter for parsing behavior control (defaults to `compat32`).

- `parse(fp, headersonly=False)` (L41-54): Parses from file-like object using chunked reading (8192 bytes)
- `parsestr(text, headersonly=False)` (L56-64): Parses from string by wrapping in StringIO

### HeaderParser (L67-72)
Subclass of Parser that defaults to headers-only parsing. Overrides both `parse()` and `parsestr()` methods to force `headersonly=True`.

### BytesParser (L75-119)
Binary email parser that handles byte input. Uses composition pattern with internal `Parser` instance (L93). Converts binary input to text using ASCII encoding with surrogateescape error handling.

- `parse(fp, headersonly=False)` (L95-107): Wraps binary file in TextIOWrapper with proper encoding
- `parsebytes(text, headersonly=False)` (L110-119): Decodes byte string before parsing

### BytesHeaderParser (L122-127)
Subclass of BytesParser for headers-only parsing of binary input. Forces `headersonly=True` in both parsing methods.

## Dependencies
- `io.StringIO, TextIOWrapper`: Stream handling
- `email.feedparser.FeedParser, BytesFeedParser`: Core parsing engine
- `email._policybase.compat32`: Default parsing policy

## Architecture Patterns
- **Composition over inheritance**: BytesParser wraps Parser rather than inheriting
- **Template method pattern**: Header-only parsers override methods to change default behavior
- **Strategy pattern**: Policy parameter allows customization of parsing behavior
- **Chunked processing**: File parsing uses 8192-byte chunks for memory efficiency

## Key Implementation Details
- Uses walrus operator (`:=`) in parse loop (L52) for efficient file reading
- Binary-to-text conversion uses surrogateescape for handling invalid bytes
- TextIOWrapper.detach() ensures proper resource cleanup (L107)
- All classes follow same interface pattern for consistency