# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/uu.py
@source-hash: dd1f5be33fb25a1b
@generated: 2026-02-09T18:07:27Z

**Purpose:** Python 3.12 implementation of Unix uuencoding/uudecoding functionality for binary file encoding into ASCII and back. Part of LLDB Python environment in CodeLLDB Rust adapter. Module is deprecated and scheduled for removal in Python 3.13.

**Core Functions:**

- `encode(in_file, out_file, name=None, mode=None, *, backtick=False)` (L45-100): Main uuencoding function that converts binary data to ASCII format. Accepts file paths or file objects, handles stdin/stdout via '-', writes uuencoded header with permissions and filename, processes data in 45-byte chunks using `binascii.b2a_uu()`. Uses backtick mode for compatibility with some decoders.

- `decode(in_file, out_file=None, mode=None, quiet=False)` (L103-175): Main uudecoding function that converts ASCII uuencoded data back to binary. Searches for valid 'begin' header line, extracts filename and permissions, includes directory traversal protection (L137-143), handles broken encoders with error recovery (L164-168), stops at 'end' marker.

- `test()` (L177-213): Command-line interface using optparse for standalone execution. Supports encode/decode modes and text handling options.

**Key Classes:**
- `Error(Exception)` (L42-43): Custom exception for uuencoding/decoding errors.

**Dependencies:**
- `binascii`: Core encoding/decoding operations
- `os`: File operations and path security checks
- `sys`: stdin/stdout handling
- `warnings`: Deprecation notice (L38)
- `optparse`: CLI argument parsing in test function

**Architecture Patterns:**
- Resource management via try/finally with `opened_files` tracking (L50, 108)
- Flexible input/output handling (file objects, paths, or stdio streams)
- Security-conscious filename validation to prevent directory traversal attacks
- Error recovery for malformed uuencoded data with optional quiet mode

**Critical Invariants:**
- Data processed in 45-byte chunks (uuencoding standard)
- File permissions preserved via octal mode values
- Newlines in filenames escaped to prevent header corruption (L83-84)
- Output files cannot overwrite existing files without explicit handling (L135-136)