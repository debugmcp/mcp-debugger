# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/uu.py
@source-hash: dd1f5be33fb25a1b
@generated: 2026-02-09T18:14:22Z

## uu.py - UUencode/UUdecode Implementation

**Primary Purpose**: Implements UUencoding and UUdecoding functionality for binary file encoding/decoding to/from ASCII text format. This is a deprecated Python standard library module scheduled for removal in Python 3.13.

**Key Functions**:
- `encode(in_file, out_file, name=None, mode=None, *, backtick=False)` (L45-101): Encodes binary files to UUencoded format
  - Handles file/string input conversion with automatic stdin/stdout support via '-'
  - Extracts filename and file mode from input file if not specified
  - Uses `binascii.b2a_uu()` for actual encoding in 45-byte chunks
  - Supports backtick format variant for compatibility

- `decode(in_file, out_file=None, mode=None, quiet=False)` (L103-175): Decodes UUencoded files back to binary
  - Searches for valid 'begin' header line with octal mode and filename
  - Implements security checks against directory traversal attacks (L137-143)
  - Handles broken UUencoders with error recovery (L164-168)
  - Uses `binascii.a2b_uu()` for decoding with fallback for malformed data

- `test()` (L177-213): Command-line interface using optparse for standalone execution
  - Supports encode/decode modes via `-d` flag
  - Text mode handling via `-t` flag

**Key Classes**:
- `Error(Exception)` (L42-43): Custom exception class for UU-specific errors

**Dependencies**:
- `binascii`: Core encoding/decoding operations
- `os`: File system operations and path security
- `sys`: Standard I/O stream access
- `warnings`: Deprecation notice (L38)

**Notable Patterns**:
- Resource management with `opened_files` list and try/finally blocks for proper cleanup
- Flexible input/output handling (file objects, paths, or '-' for stdio)
- Security-conscious filename validation to prevent directory traversal
- Error recovery for malformed UUencoded data with optional quiet mode
- Unix-style command-line interface with standard conventions

**Critical Invariants**:
- Input files must contain valid 'begin' header with octal mode
- Output filenames undergo security validation before creation
- File mode permissions preserved during encode/decode cycle
- Binary data processed in 45-byte chunks for optimal UUencoding