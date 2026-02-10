# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/mailcap.py
@source-hash: d3242c92bfedb13c
@generated: 2026-02-09T18:09:22Z

## Primary Purpose
This module implements RFC 1524 mailcap file handling for MIME type associations in Unix-like systems. It parses mailcap configuration files to determine which applications should handle specific MIME types. **DEPRECATED**: Will be removed in Python 3.13, replaced by `mimetypes` module.

## Core Functions

### Database Building
- **`getcaps()` (L31-55)**: Main entry point returning complete mailcap database as dict mapping MIME types to handler entries
- **`listmailcapfiles()` (L57-71)**: Discovers mailcap files from `$MAILCAPS` env var or standard Unix locations (`~/.mailcap`, `/etc/mailcap`, etc.)

### File Parsing  
- **`_readmailcapfile(fp, lineno)` (L83-120)**: Core parser reading mailcap entries, handling line continuations and MIME type normalization
- **`parseline(line)` (L122-151)**: Parses single mailcap entry into key-value dictionary with 'view' command
- **`parsefield(line, i, n)` (L153-164)**: Extracts semicolon-separated fields, handling escape sequences

### Entry Lookup & Execution
- **`findmatch(caps, MIMEtype, key, filename, plist)` (L169-194)**: Finds best matching handler, validates safety, executes test commands
- **`lookup(caps, MIMEtype, key)` (L196-207)**: Retrieves and sorts matching entries by line number priority
- **`subst(field, MIMEtype, filename, plist)` (L209-248)**: Substitutes mailcap variables (`%s`=filename, `%t`=MIME type, `%{param}`)

### Utilities
- **`lineno_sort_key(entry)` (L16-21)**: Sort key for prioritizing entries by appearance order
- **`findparam(name, plist)` (L250-256)**: Extracts named parameters from parameter list

## Security Features
- **`UnsafeMailcapInput` (L25-26)**: Warning class for security violations
- **`_find_unsafe` regex (L23)**: Detects unsafe characters in filenames/MIME types to prevent shell injection
- Safety checks in `findmatch()` and `subst()` refuse unsafe inputs

## Dependencies
- `os`: File system operations, environment variables, command execution
- `warnings`: Deprecation notices and security warnings  
- `re`: Unsafe character detection

## Data Structures
Mailcap database: `{mime_type: [entry_dict, ...]}` where entry_dict contains:
- `'view'`: Command to execute
- `'test'`: Optional test command  
- `'lineno'`: Source line number for prioritization
- Custom fields from mailcap entries

## Notable Patterns
- Graceful file reading with exception handling
- Line continuation support via backslash
- MIME type wildcard matching (`type/*`)
- Security-first approach with input validation
- Backwards compatibility through deprecated wrapper functions