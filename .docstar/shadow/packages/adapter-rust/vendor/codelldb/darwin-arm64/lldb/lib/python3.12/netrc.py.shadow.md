# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/netrc.py
@source-hash: 229da6d0cbe6a102
@generated: 2026-02-09T18:07:06Z

**Primary Purpose**: Object-oriented interface for parsing and managing .netrc files, providing authentication credentials for network hosts.

**Key Classes and Functions**:

- **NetrcParseError (L10-20)**: Custom exception for .netrc syntax errors. Stores filename, line number, and error message for detailed error reporting.

- **_netrclex (L22-64)**: Internal lexical analyzer for tokenizing .netrc files. 
  - `get_token()` (L35-61): Core tokenizer supporting quoted strings and escape sequences
  - `push_token()` (L62-63): Token pushback mechanism for lookahead parsing
  - Handles whitespace, comments, and escape characters

- **netrc (L66-189)**: Main class representing a .netrc file.
  - `__init__()` (L67-78): Constructor with fallback encoding (UTF-8 → locale) and default file location (~/.netrc)
  - `_parse()` (L80-142): Core parser handling machine/default entries and macro definitions
  - `_security_check()` (L144-164): POSIX security validation (file ownership and permissions)
  - `authenticators()` (L166-173): Retrieves (user, account, password) tuple for given host
  - `__repr__()` (L175-189): Serializes back to .netrc format

**Data Structure**: 
- `hosts` dict: Maps hostnames/default to (login, account, password) tuples
- `macros` dict: Maps macro names to lists of command lines

**Dependencies**: os, stat, pwd (conditional)

**Key Patterns**:
- Dual encoding fallback strategy for file reading
- Security-first approach with ownership/permission validation on POSIX systems
- Token-based parsing with pushback support for lookahead
- Support for quoted strings, escape sequences, and comments

**Critical Constraints**:
- Default .netrc must be owned by current user on POSIX systems
- File permissions must restrict access to owner only (no group/other access)
- Macros terminated by blank line, machine entries by next top-level token