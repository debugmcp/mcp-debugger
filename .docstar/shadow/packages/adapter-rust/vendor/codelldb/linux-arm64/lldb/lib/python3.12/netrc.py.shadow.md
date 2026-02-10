# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/netrc.py
@source-hash: 229da6d0cbe6a102
@generated: 2026-02-09T18:08:45Z

**Purpose**: Object-oriented interface for parsing and accessing .netrc authentication files used by network clients (ftp, etc.).

**Key Classes & Functions**:

- **NetrcParseError (L10-19)**: Custom exception for .netrc syntax errors. Stores filename, line number, and error message with formatted string representation.

- **_netrclex (L22-64)**: Internal lexical analyzer for tokenizing .netrc files
  - `get_token()` (L35-60): Tokenizes input with quote handling and escape sequences
  - `push_token()` (L62-63): Implements token pushback for parser lookahead
  - Tracks line numbers for error reporting

- **netrc (L66-189)**: Main class representing parsed .netrc file
  - `__init__()` (L67-78): Loads ~/.netrc by default, handles UTF-8 and locale encodings
  - `_parse()` (L80-142): Core parser implementing .netrc grammar (machine, default, macdef keywords)
  - `_security_check()` (L144-164): Validates file ownership and permissions on POSIX systems
  - `authenticators()` (L166-173): Public API to retrieve (user, account, password) tuple for host
  - `__repr__()` (L175-189): Serializes data back to .netrc format

**Data Structures**:
- `self.hosts`: Dict mapping hostnames/default to (login, account, password) tuples
- `self.macros`: Dict storing macro definitions as lists of lines

**Key Dependencies**: os, stat modules for file operations and permission checking

**Security Features**: 
- File ownership validation (must be owned by current user)
- Permission checks (readable only by owner)
- Only applies to default ~/.netrc file on POSIX systems

**Parser Grammar**: Supports 'machine', 'default', 'macdef' top-level keywords with 'login'/'user', 'account', 'password' attributes. Handles comments starting with '#' and quoted strings with escape sequences.