# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/uu.py
@source-hash: dd1f5be33fb25a1b
@generated: 2026-02-09T18:10:14Z

This is a Python UUencoding/UUdecoding library implementation, part of the LLDB debugging tools distribution. The module is deprecated as of Python 3.13 (L38).

## Primary Purpose
Provides UUencode and UUdecode functionality for binary-to-text and text-to-binary conversion, commonly used for transmitting binary data over text-only protocols like email.

## Core Functions

**`encode(in_file, out_file, name=None, mode=None, *, backtick=False)` (L45-100)**
- Encodes binary data to UUencoded ASCII format
- Handles file path strings or file-like objects for input/output
- Special handling for '-' to use stdin/stdout buffers (L52-53, L67-68)
- Automatically extracts filename and file permissions if input is a path (L55-61)
- Processes data in 45-byte chunks using `binascii.b2a_uu()` (L90-93)
- Supports backtick encoding variant (L94-97)
- Sanitizes filenames by escaping newlines (L83-84)

**`decode(in_file, out_file=None, mode=None, quiet=False)` (L103-175)**
- Decodes UUencoded data back to binary format
- Searches for valid 'begin' header with octal permissions (L119-131)
- Extracts output filename from header if not provided (L132-134)
- Implements directory traversal protection (L137-143)
- Main decoding loop processes lines until 'end' marker (L159-172)
- Includes workaround for broken UUencoders (L164-168)
- Error handling for truncated files (L171-172)

**`test()` (L177-213)**
- Command-line interface using deprecated `optparse` module
- Supports encode/decode modes with `-d` flag
- Text mode handling with `-t` flag
- Processes up to 2 arguments for input/output files

## Key Classes
**`Error(Exception)` (L42-43)** - Custom exception for UU-related errors

## Dependencies
- `binascii` - Core encoding/decoding operations
- `os` - File system operations and path manipulation
- `sys` - Standard input/output access
- `warnings` - Deprecation notice
- `optparse` - Command-line argument parsing (in test function)

## Security Considerations
- Directory traversal protection prevents writing to parent directories (L137-143)
- File overwrite protection checks existing files (L135-136)
- Input validation for UU header format (L126-131)

## Architecture Notes
- Uses context management with try/finally for proper file cleanup (L98-100, L173-175)
- Processes data in fixed 45-byte chunks for memory efficiency
- Maintains compatibility with both file paths and file objects
- Handles both standard and backtick UU encoding variants