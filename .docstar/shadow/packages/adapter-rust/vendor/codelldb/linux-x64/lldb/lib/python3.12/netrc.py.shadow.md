# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/netrc.py
@source-hash: 229da6d0cbe6a102
@generated: 2026-02-09T18:10:14Z

## Purpose
Object-oriented interface for parsing and accessing .netrc authentication files. Provides secure credential storage parsing with file permission validation for Unix-like systems.

## Core Classes

### NetrcParseError (L10-19)
Custom exception for .netrc parsing errors. Stores filename, line number, and error message for detailed error reporting.
- `__init__(L12-16)`: Initialize with message, optional filename and line number
- `__str__(L18-19)`: Format error with context information

### _netrclex (L22-64)
Internal lexical analyzer for tokenizing .netrc file content.
- `__init__(L23-27)`: Initialize with file pointer, track line numbers and whitespace
- `get_token(L35-60)`: Core tokenizer handling quoted strings, escape sequences, and whitespace
- `push_token(L62-63)`: Pushback mechanism for lookahead parsing
- `_read_char(L29-33)`: Character reader with line number tracking

### netrc (L66-189)
Main class providing .netrc file interface.
- `__init__(L67-78)`: Load .netrc file (defaults to ~/.netrc), handles UTF-8 and locale encodings
- `_parse(L80-142)`: Parse file content into hosts and macros dictionaries
- `_security_check(L144-164)`: Validate file ownership and permissions on POSIX systems
- `authenticators(L166-173)`: Retrieve credentials for given host, falls back to 'default'
- `__repr__(L175-189)`: Serialize back to .netrc format

## Key Data Structures
- `hosts`: Dictionary mapping hostnames to (login, account, password) tuples
- `macros`: Dictionary storing macro definitions as lists of lines

## Security Features
- File permission validation (owner-only access required)
- File ownership verification against current user
- Anonymous login exemption from security checks

## Parsing Logic
Supports three top-level keywords:
- `machine`: Host-specific credentials
- `default`: Fallback credentials  
- `macdef`: Macro definitions (terminated by blank line)

## Dependencies
- `os`, `stat`: File system operations and permission checking
- `pwd`: User information lookup (imported on demand)