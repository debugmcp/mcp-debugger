# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/uu.py
@source-hash: dd1f5be33fb25a1b
@generated: 2026-02-09T18:08:15Z

## Purpose
Python 3.12 standard library implementation of UUencoding/UUdecoding functionality. Part of the LLDB debugger's Python environment in the Rust adapter package. This module provides binary-to-text encoding using the Unix uuencode format.

**Deprecation Notice**: This module is deprecated as of Python 3.11 and scheduled for removal in Python 3.13 (L38).

## Core Functions

### `encode(in_file, out_file, name=None, mode=None, *, backtick=False)` (L45-100)
- **Purpose**: Encodes binary data to UUencoded text format
- **File Handling**: Accepts file paths (strings), file objects, or '-' for stdin/stdout
- **Key Features**:
  - Auto-detects file name and mode from input file if not specified
  - Sanitizes filenames by escaping newlines/carriage returns (L83-84)
  - Reads data in 45-byte chunks for UU line encoding (L90-93)
  - Supports backtick mode for compatibility (L94-97)
- **Output Format**: Produces standard UUencoded format with "begin" header and "end" trailer

### `decode(in_file, out_file=None, mode=None, quiet=False)` (L103-175)
- **Purpose**: Decodes UUencoded text back to binary data
- **Security Features**:
  - Prevents directory traversal attacks (L137-143)
  - Checks for existing files to prevent overwriting (L135-136)
- **Error Handling**: 
  - Robust header parsing with validation (L119-131)
  - Workaround for broken encoders (L164-168)
  - Graceful handling of truncated files (L171-172)
- **File Permissions**: Preserves original file mode when creating output files (L153)

### `test()` (L177-213)
- **Purpose**: Command-line interface using optparse
- **Options**: `-d` for decode mode, `-t` for text mode handling
- **I/O**: Handles stdin/stdout and file arguments

## Key Components

### `Error` Exception (L42-43)
Custom exception class for UU encoding/decoding errors.

## Dependencies
- `binascii`: Core encoding/decoding operations via `b2a_uu()` and `a2b_uu()`
- `os`: File system operations and path security
- `sys`: Stream handling for stdin/stdout/stderr
- `optparse`: Command-line argument parsing in test function

## Architectural Patterns
- **Resource Management**: Consistent try/finally pattern for file cleanup (L98-100, L173-175)
- **Flexible I/O**: Unified handling of file objects, paths, and standard streams
- **Security-First**: Multiple layers of protection against malicious filenames
- **Backward Compatibility**: Maintains support for broken UU encoders with fallback logic

## Critical Constraints
- Reads/writes in 45-byte chunks (UU line standard)
- File mode limited to 3 octal digits (L89)
- ASCII-only filenames in UU headers (L134)
- No overwriting of existing files without explicit output specification