# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/uu.py
@source-hash: dd1f5be33fb25a1b
@generated: 2026-02-09T18:09:15Z

## Purpose
Python standard library module implementing UUencoding/UUdecoding functionality. Part of the LLDB Python environment for the CodeLLDB Rust adapter. Provides binary-to-ASCII encoding that was historically used for email transmission.

## Key Components

### Exception Classes
- `Error` (L42-43): Custom exception for UU encoding/decoding errors

### Core Functions
- `encode(in_file, out_file, name=None, mode=None, *, backtick=False)` (L45-100): 
  - Encodes binary data to UU format
  - Handles file path strings or file-like objects
  - Supports backtick variant encoding
  - Writes "begin" header with octal permissions and filename
  - Processes data in 45-byte chunks using `binascii.b2a_uu()`
  - Terminates with "end" marker

- `decode(in_file, out_file=None, mode=None, quiet=False)` (L103-175):
  - Decodes UU format back to binary
  - Searches for valid "begin" line in input
  - Extracts filename and permissions from header
  - Includes directory traversal protection (L137-143)
  - Main loop processes lines with `binascii.a2b_uu()`
  - Handles broken encoders with workaround (L164-168)

- `test()` (L177-213): Command-line interface using optparse for standalone usage

### Dependencies
- `binascii`: Core encoding/decoding operations
- `os`: File system operations and path handling
- `sys`: Standard I/O stream access
- `warnings`: Deprecation notice (module deprecated in Python 3.13)

### Key Patterns
- Consistent file handling: accepts paths (strings), file objects, or '-' for stdin/stdout
- Resource management: Uses try/finally blocks to ensure file closure
- Error handling: Custom Error exceptions with descriptive messages
- Security: Path traversal validation in decode function
- Compatibility: Workaround for malformed UU data from broken encoders

### Critical Constraints
- Input data processed in 45-byte chunks (UU encoding standard)
- File permissions stored as octal values (masked to 0o777)
- ASCII encoding required for headers and filenames
- Module marked for deprecation removal in Python 3.13 (L38)