# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/netrc.py
@source-hash: 229da6d0cbe6a102
@generated: 2026-02-09T18:12:51Z

**Primary Purpose:** Object-oriented Python interface for parsing and accessing Unix .netrc authentication files, providing credential lookup for network hosts.

**Core Classes:**

- **NetrcParseError (L10-20)**: Custom exception for .netrc syntax errors with filename and line number context
- **_netrclex (L22-64)**: Internal lexer for tokenizing .netrc file content with quote handling, escape sequences, and pushback capability
- **netrc (L66-189)**: Main parser class that reads .netrc files and provides credential access

**Key Methods:**

- **netrc.__init__(L67-78)**: Constructor that defaults to ~/.netrc, handles UTF-8/locale encoding fallbacks
- **netrc._parse(L80-142)**: Core parser handling 'machine', 'default', 'macdef' keywords and credential extraction
- **netrc._security_check(L144-164)**: POSIX security validation ensuring proper file ownership and permissions (owner-only access)
- **netrc.authenticators(L166-173)**: Primary API method returning (user, account, password) tuple for given host, with 'default' fallback

**Data Structure:**
- `hosts`: Dictionary mapping hostnames to (login, account, password) tuples
- `macros`: Dictionary storing macro definitions as line lists

**Dependencies:**
- Standard library: `os`, `stat`, `pwd` (for security checks)
- File encoding handling with UTF-8 primary, locale fallback

**Security Features:**
- File ownership verification (must match current user)  
- Permission validation (no group/other access allowed)
- Only applies to default ~/.netrc files on POSIX systems

**Usage Pattern:**
```python
n = netrc()  # Parse ~/.netrc
creds = n.authenticators('example.com')  # Returns (user, account, password) or None
```

**Notable Implementation Details:**
- Lexer supports quoted strings with escape sequences
- Comment handling with '#' prefix
- Macro definitions terminated by blank lines
- Graceful handling of missing files and encoding issues