# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/cgi.py
@source-hash: 2e79c92513f1cf76
@generated: 2026-02-09T18:08:39Z

## Python CGI Support Module

**Primary Purpose**: Provides utilities for parsing and handling Common Gateway Interface (CGI) form data in Python web applications, particularly for processing HTML form submissions with support for multipart file uploads and URL-encoded data.

**Key Classes**:
- **MiniFieldStorage (L263-286)**: Lightweight storage for simple form fields without file upload capability. Stores name-value pairs with dummy attributes for compatibility.
- **FieldStorage (L288-849)**: Full-featured form data parser supporting multipart/form-data, file uploads, and URL-encoded forms. Provides dictionary-like interface with methods for accessing field values, handling multiple values per field, and managing temporary files for uploads.

**Core Functions**:
- **parse() (L130-197)**: Main parsing function that handles both GET and POST requests, dispatching to appropriate parsers based on content type
- **parse_multipart() (L200-225)**: Specialized parser for multipart/form-data (file uploads)
- **parse_header() (L239-257)**: HTTP header parser that extracts content-type and parameters
- **_parseparam() (L227-237)**: Internal parameter parsing helper with quote handling

**Logging System (L60-121)**:
- Dynamic logging system with `initlog()`, `dolog()`, `nolog()` functions
- Global `log` variable that switches between implementations based on configuration
- Deprecated in Python 3.10+ in favor of standard logging module

**Configuration**:
- **maxlen (L128)**: Global variable controlling maximum POST request size (0 = unlimited)
- **logfile/logfp (L63-64)**: Global logging configuration variables

**Test/Debug Functions (L854-994)**:
- **test() (L854-891)**: Complete CGI testing framework that demonstrates all functionality
- Various print functions for debugging: `print_form()`, `print_environ()`, `print_exception()`, etc.

**Key Architectural Patterns**:
- Uses factory pattern for FieldStorage class instantiation via `FieldStorageClass` attribute
- Implements context manager protocol (`__enter__`/`__exit__`) for resource cleanup
- Dictionary-like interface with `__getitem__`, `keys()`, `__contains__` methods
- Lazy value evaluation through `__getattr__` for the `value` property

**Critical Dependencies**:
- `urllib.parse` for URL decoding
- `email.parser.FeedParser` and `email.message.Message` for multipart parsing
- `tempfile` for temporary file creation during uploads
- `io.StringIO/BytesIO` for in-memory file-like objects

**Important Constraints**:
- Content length limits enforced via `maxlen` global
- Boundary validation for multipart data security
- Encoding handling throughout (defaults to utf-8 with error handling)
- Memory management for large uploads through temporary files