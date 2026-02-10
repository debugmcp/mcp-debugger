# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/mailcap.py
@source-hash: d3242c92bfedb13c
@generated: 2026-02-09T18:09:50Z

## Purpose
Handles mailcap file parsing and MIME type to application mapping according to RFC 1524. Provides functionality to read system mailcap files, parse entries, and find appropriate viewer applications for MIME types. **DEPRECATED** - scheduled for removal in Python 3.13, replaced by `mimetypes` module.

## Core Functions

**getcaps() (L31-55)** - Main entry point that returns dictionary mapping MIME types to mailcap entries. Scans all available mailcap files via `listmailcapfiles()` and aggregates entries.

**findmatch() (L169-194)** - Locates appropriate viewer application for given MIME type. Returns (command, entry) tuple or (None, None) if no match. Includes security validation via `_find_unsafe` regex and optional test command execution.

**listmailcapfiles() (L57-71)** - Discovers mailcap files on system. Checks MAILCAPS environment variable first, falls back to standard Unix paths: ~/.mailcap, /etc/mailcap, /usr/etc/mailcap, /usr/local/etc/mailcap.

## Parser Components

**_readmailcapfile() (L83-120)** - Core parser that reads mailcap file format. Handles line continuations (backslash-newline), normalizes MIME types to lowercase, tracks line numbers for sorting.

**parseline() (L122-151)** - Parses individual mailcap entry into dictionary. First field is MIME type, second is view command, remainder are key=value pairs.

**parsefield() (L153-164)** - Low-level parser for semicolon-separated fields, handles backslash escaping.

## Lookup and Substitution

**lookup() (L196-207)** - Finds matching entries for MIME type, including wildcard matches (type/*). Sorts results by line number using `lineno_sort_key()` (L16-21).

**subst() (L209-248)** - Performs parameter substitution in command strings:
- %s → filename
- %t → MIME type  
- %{param} → parameter value
- %% → literal %

Security validated via `_find_unsafe` regex (L23).

**findparam() (L250-256)** - Extracts parameter values from parameter list for substitution.

## Security Features

**UnsafeMailcapInput (L25-26)** - Warning class for security violations.

**_find_unsafe regex (L23)** - Validates input safety by rejecting characters outside safe set: [^\xa1-\U0010FFFF\w@+=:,./-]

Applied to filenames, MIME types, and parameters before shell command execution.

## Dependencies
- `os` - file system operations, environment variables, command execution
- `warnings` - deprecation notices and security warnings
- `re` - unsafe input detection

## Architecture Notes
- Four-part structure: interface, parser, database usage, test program
- Line number tracking for entry precedence
- Continuation line support in mailcap format
- Graceful handling of missing/unreadable files
- Security-first approach with input validation