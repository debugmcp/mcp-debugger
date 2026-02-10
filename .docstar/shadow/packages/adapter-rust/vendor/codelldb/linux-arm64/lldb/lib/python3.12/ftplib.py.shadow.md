# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/ftplib.py
@source-hash: d46af0c591299d30
@generated: 2026-02-09T18:09:22Z

## Purpose
Python FTP client library implementing RFC 959 File Transfer Protocol. Provides both basic FTP functionality through the `FTP` class and secure FTP-TLS support through `FTP_TLS`. Located in LLDB debugger's Python environment, suggesting it's part of the debugging tools ecosystem.

## Core Classes

### FTP (L74-669)
Main FTP client class providing comprehensive file transfer capabilities:
- **Initialization** (L109-123): Supports host, user, passwd, timeout, source_address, encoding parameters
- **Connection Management**: 
  - `connect()` (L139-163): Establishes socket connection, handles welcome message
  - `close()` (L657-668): Cleanly closes file and socket resources
  - Context manager support (L125-137) with automatic cleanup
- **Authentication**: `login()` (L395-419) with anonymous fallback
- **Data Transfer**:
  - `retrbinary()` (L421-442): Binary file download with callback support
  - `retrlines()` (L444-477): Text file download line-by-line
  - `storbinary()` (L479-503): Binary file upload
  - `storlines()` (L505-534): Text file upload
- **Directory Operations**: `nlst()`, `dir()`, `mlsd()`, `cwd()`, `pwd()`, `mkd()`, `rmd()`
- **File Operations**: `rename()`, `delete()`, `size()`

### FTP_TLS (L677-784)
SSL/TLS-secured FTP subclass extending FTP:
- **Security Setup**: `auth()` (L726-736) establishes TLS control connection
- **Data Protection**: `prot_p()` (L746-760) secures data channel, `prot_c()` (L762-766) clears it
- **Overridden Methods**: `ntransfercmd()` and `abort()` handle SSL-specific requirements

## Exception Hierarchy (L57-66)
- `Error`: Base exception class
- `error_reply`: Unexpected server reply codes
- `error_temp`: 4xx temporary errors  
- `error_perm`: 5xx permanent errors
- `error_proto`: Invalid response format

## Key Protocol Utilities
- **Response Parsers**: `parse150()` (L792-807), `parse227()` (L812-828), `parse229()` (L831-849), `parse257()` (L852-871)
- **Data Connection**: `ntransfercmd()` (L336-389) handles both active and passive modes
- **Command Interface**: `sendcmd()`, `voidcmd()`, low-level `putcmd()`/`getresp()` methods

## Constants & Configuration
- `FTP_PORT = 21` (L51): Standard FTP control port
- `MAXLINE = 8192` (L53): Maximum line length for responses
- `MSG_OOB = 0x1` (L47): Out-of-band data flag
- Line terminators: `CRLF`, `B_CRLF` (L70-71)

## Notable Features
- **Security**: IPv4 PASV address validation (L106-107, L327-334) prevents certain attacks
- **Debugging**: Multi-level debug output via `set_debuglevel()` (L172-179)
- **Transfer Modes**: Supports both binary ('I') and ASCII ('A') transfer types
- **Connection Types**: Active (PORT) and passive (PASV/EPSV) data connections
- **SSL Integration**: Conditional SSL support with proper socket wrapping/unwrapping

## Helper Functions
- `ftpcp()` (L879-898): Copy files between FTP servers
- `print_line()` (L874-876): Default callback for line-based transfers
- `test()` (L901-963): Command-line test interface with .netrc support