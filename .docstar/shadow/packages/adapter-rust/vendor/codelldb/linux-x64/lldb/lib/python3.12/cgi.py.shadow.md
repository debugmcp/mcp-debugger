# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/cgi.py
@source-hash: 2e79c92513f1cf76
@generated: 2026-02-09T18:09:33Z

**Purpose**: Python CGI (Common Gateway Interface) module for parsing HTTP form data and multipart uploads. Despite being located in an LLDB vendor directory, this is the standard Python library `cgi.py` module.

**Key Classes**:
- `MiniFieldStorage` (L263-286): Lightweight field storage for simple name-value pairs without file uploads. Contains dummy attributes for compatibility with `FieldStorage`.
- `FieldStorage` (L288-848): Main form data parser supporting multipart/form-data, URL-encoded data, and file uploads. Provides dictionary-like interface with methods like `getvalue()`, `getfirst()`, `getlist()`.

**Core Functions**:
- `parse()` (L130-197): Main parsing entry point that routes to appropriate parser based on content type
- `parse_multipart()` (L200-225): Handles multipart/form-data parsing using `FieldStorage`
- `parse_header()` (L239-257): Parses Content-Type headers and extracts parameters
- `_parseparam()` (L227-237): Internal header parameter parsing helper

**Logging System** (L60-121):
- `initlog()`, `dolog()`, `nolog()`: Dynamic logging functions with file-based output
- Global `log` variable points to current logging function

**Testing/Debug Functions** (L854-994):
- `test()` (L854-891): Main CGI test harness that outputs HTML diagnostics
- `print_*()` functions: Various HTML output helpers for debugging CGI environments

**Key Variables**:
- `maxlen` (L128): Global limit for POST request size (0 = unlimited)
- Module marked as deprecated (L58) with removal scheduled for Python 3.13

**Architecture**:
- Uses email parsing infrastructure (`FeedParser`) for multipart handling
- Supports both file and string field storage with automatic temporary file creation
- Implements context manager protocol (`__enter__`/`__exit__`) for resource cleanup
- Handles multiple encodings and error strategies for international content

**Security Features**:
- Content length validation against `maxlen`
- Boundary validation for multipart data
- Field count limiting via `max_num_fields` parameter