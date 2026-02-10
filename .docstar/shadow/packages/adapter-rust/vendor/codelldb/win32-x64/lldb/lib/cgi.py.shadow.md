# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/cgi.py
@source-hash: f132666784c29a3e
@generated: 2026-02-09T18:12:58Z

## Primary Purpose
Standard Python CGI module for parsing Common Gateway Interface data from web requests. Handles form data parsing for both URL-encoded and multipart/form-data content types, including file uploads.

## Key Classes

**MiniFieldStorage (L262-285)**
- Lightweight field storage for simple name-value pairs without file upload capability
- Attributes: name, value, plus dummy placeholders for file-related fields
- Used when no file operations are needed

**FieldStorage (L287-848)**
- Main class for parsing and storing CGI form data with full multipart support
- Dictionary-like interface with methods: `__getitem__`, `getvalue()`, `getfirst()`, `getlist()`, `keys()`
- Handles file uploads via temporary files through `make_file()` method (L819-847)
- Three parsing modes via private methods:
  - `read_urlencoded()` (L596-610): URL-encoded form data
  - `read_multi()` (L614-681): Multipart form data with recursive parsing
  - `read_single()` (L683-690): Single part/file data

## Key Functions

**parse() (L129-196)**
- Top-level parsing function for CGI requests
- Determines parsing strategy based on REQUEST_METHOD and CONTENT_TYPE
- Returns dictionary of field names to value lists

**parse_multipart() (L199-224)**
- Specialized parser for multipart/form-data
- Uses FieldStorage internally, returns dict format

**parse_header() (L238-256)**
- Parses Content-Type and similar headers
- Returns main type and parameter dictionary
- Helper function `_parseparam()` (L226-236) handles parameter extraction

## Logging System (L59-120)
Dynamic logging with function pointer switching:
- `initlog()` (L65-100): Initializes logging, switches `log` variable to `dolog` or `nolog`
- `log` variable points to current logging function
- Deprecated as of Python 3.10

## Testing/Debug Functions (L853-994)
- `test()` (L853-891): Main test harness that generates HTML diagnostic output
- `print_*` family: HTML formatters for various data (form, environ, exceptions, etc.)

## Configuration
- `maxlen` (L127): Global POST request size limit (0 = unlimited)
- Module marked deprecated, scheduled for removal in Python 3.13 (L57)

## Dependencies
- email.parser.FeedParser for multipart header parsing
- tempfile for file upload storage
- urllib.parse for query string parsing
- Various I/O classes (StringIO, BytesIO, TextIOWrapper)

## Critical Invariants
- File pointers must return bytes for `fp.read()` operations
- Boundaries in multipart data must be valid ASCII per RFC 2046
- Content-length limits enforced via `maxlen` global
- Automatic file cleanup via `__del__` and context manager protocol