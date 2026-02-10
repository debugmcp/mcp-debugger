# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/mailcap.py
@source-hash: d3242c92bfedb13c
@generated: 2026-02-09T18:08:27Z

## Purpose
Implements RFC 1524 mailcap file handling for mapping MIME types to viewer/handler applications. Parses system mailcap configuration files and provides matching functionality to find appropriate handlers for given MIME types. **DEPRECATED** - scheduled for removal in Python 3.13, with mimetypes module recommended as alternative.

## Core Architecture

### Main API (L31-56, L169-194)
- `getcaps()` (L31-55): Primary entry point returning dictionary mapping MIME types to handler lists
- `findmatch(caps, MIMEtype, key='view', filename="/dev/null", plist=[])` (L169-194): Finds and returns command + entry tuple for given MIME type

### File System Integration (L57-71)
- `listmailcapfiles()` (L57-71): Discovers mailcap files via MAILCAPS env var or standard paths
- Standard locations: `~/.mailcap`, `/etc/mailcap`, `/usr/etc/mailcap`, `/usr/local/etc/mailcap`

### Parser Components (L75-164)
- `_readmailcapfile(fp, lineno)` (L83-120): Core parser handling continuation lines and comments
- `parseline(line)` (L122-151): Extracts MIME type key and field dictionary from single entry
- `parsefield(line, i, n)` (L153-164): Low-level field separator with escape sequence handling

### Database Operations (L196-256)
- `lookup(caps, MIMEtype, key=None)` (L196-207): Searches for entries with wildcard support (`type/*`)
- `subst(field, MIMEtype, filename, plist=[])` (L209-248): Performs parameter substitution in commands
- `findparam(name, plist)` (L250-256): Extracts named parameters from parameter list

## Security Features
- `UnsafeMailcapInput` warning class (L25-26)
- `_find_unsafe` regex pattern (L23): Detects potentially dangerous characters
- Security validation in `findmatch()` (L178-181) and `subst()` (L226-241) prevents shell injection

## Data Structures
- Main caps dict: `{mime_type: [entry_dict, ...]}`
- Entry dict format: `{'view': command, 'lineno': int, ...custom_fields}`
- Entries sorted by `lineno_sort_key()` (L16-21) for deterministic ordering

## Key Dependencies
- `os`: File system operations and shell command execution
- `re`: Pattern matching for security validation
- `warnings`: Deprecation notices and security warnings

## Notable Patterns
- Continuation line handling with backslash escapes (L99-102)
- Fallback mechanism from specific to wildcard MIME types (L198-203)
- Parameter substitution supporting `%s` (filename), `%t` (MIME type), `%{param}` (custom parameters)
- Security-first approach with input validation throughout

## Test Infrastructure (L261-302)
- `test()` (L261-282): Command-line interface for testing mailcap functionality
- `show(caps)` (L284-299): Debug utility displaying discovered mailcap entries