# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/wsgiref/util.py
@source-hash: 93783cda34836853
@generated: 2026-02-09T18:11:21Z

## Purpose
WSGI utility module providing helper functions and classes for web application development, including file handling, URI construction, path manipulation, and testing support.

## Key Components

### FileWrapper Class (L11-27)
Iterator wrapper that converts file-like objects into iterables for WSGI response handling. Reads files in configurable chunks (default 8KB) and preserves the original file's close method if available.

### URI Construction Functions
- **guess_scheme(environ)** (L29-35): Determines HTTP vs HTTPS scheme based on HTTPS environment variables
- **application_uri(environ)** (L37-55): Builds base application URI from WSGI environ, handling HOST headers and port logic for standard HTTP/HTTPS ports
- **request_uri(environ, include_query=True)** (L57-68): Constructs complete request URI including path and optional query string

### Path Manipulation
- **shift_path_info(environ)** (L70-109): Core WSGI routing utility that moves path segments from PATH_INFO to SCRIPT_NAME, enabling URL traversal. Handles edge cases like trailing slashes and '.' segments. **Modifies environ in-place**.

### Testing Support
- **setup_testing_defaults(environ)** (L111-147): Populates WSGI environ with minimal defaults for unit testing, including server info, WSGI variables, and I/O streams.

### HTTP Header Utilities
- **_hoppish** (L151-155): Set-based lookup for HTTP/1.1 hop-by-hop headers
- **is_hop_by_hop(header_name)** (L157-159): Checks if header should not be forwarded by proxies

## Dependencies
- `posixpath`: Path normalization
- `urllib.parse.quote`: URL encoding
- `io.StringIO/BytesIO`: Testing I/O streams

## Key Patterns
- Defensive programming with `environ.get()` calls and default values
- In-place environ modification for performance in shift_path_info
- Latin-1 encoding for URL components (WSGI standard)
- Port logic differentiates standard HTTP (80) and HTTPS (443) ports