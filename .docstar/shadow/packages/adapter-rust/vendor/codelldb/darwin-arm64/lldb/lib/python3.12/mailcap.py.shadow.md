# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/mailcap.py
@source-hash: d3242c92bfedb13c
@generated: 2026-02-09T18:07:18Z

## Mailcap File Handler (DEPRECATED)

This module provides mailcap file parsing and MIME type command lookup functionality per RFC 1524. **The entire module is deprecated as of Python 3.13** and will be removed, with mimetypes module recommended as alternative.

### Core Purpose
- Parse system mailcap files to build MIME type to command mappings
- Find appropriate viewer/handler commands for given MIME types and files
- Provide secure parameter substitution with unsafe input validation

### Key Functions

**getcaps() (L31-55)**: Primary entry point returning complete mailcap database as dict mapping MIME types to lists of command entries. Searches standard system locations and MAILCAPS environment variable.

**findmatch() (L169-194)**: Core matching function that takes caps dict, MIME type, key (default 'view'), filename, and parameter list. Returns (command, entry) tuple or (None, None). Includes security validation against unsafe filenames and executes 'test' commands when present.

**listmailcapfiles() (L57-71)**: Returns list of mailcap file paths to search, checking MAILCAPS env var or defaulting to standard Unix locations (~/.mailcap, /etc/mailcap, etc).

### Parsing Infrastructure

**_readmailcapfile() (L83-120)**: Internal parser that processes individual mailcap files, handling line continuations, comments, and building structured entries with line numbers for sorting.

**parseline() (L122-151)**: Parses single mailcap entry into key and fields dict, with 'view' command as primary value.

**parsefield() (L153-164)**: Low-level field parser handling escaped characters and semicolon delimiters.

### Command Processing

**lookup() (L196-207)**: Searches caps for exact MIME type match, then wildcard (type/*), filters by key, and sorts by line numbers using lineno_sort_key().

**subst() (L209-248)**: Parameter substitution engine supporting %s (filename), %t (MIME type), %{param} (named parameters). Includes security validation via _find_unsafe regex.

**findparam() (L250-256)**: Extracts named parameters from parameter list for substitution.

### Security Features

**_find_unsafe (L23)**: Regex pattern identifying unsafe characters for shell injection prevention.

**UnsafeMailcapInput (L25-26)**: Warning class raised when rejecting unsafe input in filenames, MIME types, or parameters.

### Dependencies
- os: File system operations and environment variables
- warnings: Deprecation notices and security warnings  
- re: Unsafe character pattern matching

### Architectural Notes
- Line number tracking enables proper mailcap precedence handling
- Unix-centric design with path separator abstraction
- Defensive programming against shell injection via input validation
- Graceful degradation when mailcap files are missing or malformed