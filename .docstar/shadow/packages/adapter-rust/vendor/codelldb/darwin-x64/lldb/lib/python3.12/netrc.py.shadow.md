# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/netrc.py
@source-hash: 229da6d0cbe6a102
@generated: 2026-02-09T18:07:44Z

**Primary Purpose**: Object-oriented interface for parsing and accessing `.netrc` credential files, providing secure authentication data for network services.

**Key Classes:**

- **NetrcParseError (L10-20)**: Custom exception for `.netrc` syntax errors, stores filename, line number, and error message for detailed error reporting.

- **_netrclex (L22-64)**: Internal tokenizer/lexer for parsing `.netrc` files. Handles quoted strings, escape sequences, whitespace, and token pushback. Key methods:
  - `get_token()` (L35-60): Extracts tokens with quote and escape handling
  - `push_token()` (L62-63): Implements token pushback for lookahead parsing

- **netrc (L66-189)**: Main class representing a parsed `.netrc` file. Contains:
  - `hosts` dict: Maps hostnames to (login, account, password) tuples
  - `macros` dict: Stores macro definitions as line lists
  - `__init__()` (L67-78): Auto-locates `~/.netrc`, handles UTF-8/locale encoding fallback
  - `_parse()` (L80-142): Core parser implementing `.netrc` grammar (machine, default, macdef keywords)
  - `_security_check()` (L144-164): POSIX security validation - ensures file ownership and permissions (owner-only access)
  - `authenticators()` (L166-173): Primary API method returning credentials for a host (with default fallback)
  - `__repr__()` (L175-189): Serializes back to `.netrc` format

**Architecture Patterns:**
- Lexer-parser separation for clean tokenization
- Security-first design with ownership/permission validation
- Graceful encoding fallback (UTF-8 → locale)
- Host-specific vs default credential resolution

**Dependencies**: `os`, `stat` for file operations and security checks; `pwd` (imported conditionally) for user resolution.

**Critical Constraints**:
- POSIX systems enforce strict file permissions (owner-only access)
- File ownership must match current user (except for anonymous login)
- Macro definitions must terminate with blank line
- Supports both 'login' and 'user' keywords for backward compatibility