# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/ftplib.py
@source-hash: d46af0c591299d30
@generated: 2026-02-09T18:07:45Z

## Python FTP Client Library (ftplib.py)

This is Python's standard FTP (File Transfer Protocol) client library implementing RFC 959 functionality with TLS/SSL extensions per RFC 4217.

### Core Classes

**FTP (L74-669)**: Main FTP client class providing full RFC 959 functionality
- Connection management: `connect()` (L139), `close()` (L657), context manager support (L125-137)
- Authentication: `login()` (L395) with anonymous login defaults
- Command interface: `sendcmd()` (L278), `voidcmd()` (L283) for raw FTP commands
- File transfer methods:
  - `retrbinary()` (L421): Binary file retrieval with callback
  - `retrlines()` (L444): Text file retrieval line-by-line
  - `storbinary()` (L479): Binary file upload from file-like object
  - `storlines()` (L505): Text file upload line-by-line
- Directory operations: `cwd()` (L608), `pwd()` (L642), `mkd()` (L629), `rmd()` (L638)
- File operations: `rename()` (L593), `delete()` (L600), `size()` (L621)
- Modern listing: `mlsd()` (L565) using RFC 3659 MLSD command
- Data connection modes: Supports both PASV (default) and PORT modes via `set_pasv()` (L181)

**FTP_TLS (L677-785)**: TLS/SSL-enabled FTP client subclassing FTP
- Automatic TLS negotiation on control connection
- Secure data transfers via `prot_p()` (L746) and `prot_c()` (L762)
- Certificate context management through ssl.SSLContext
- Overrides `ntransfercmd()` (L770) and `abort()` (L777) for TLS compatibility

### Exception Hierarchy (L57-66)

- `Error`: Base exception class
- `error_reply`: Unexpected reply codes
- `error_temp`: 4xx temporary errors  
- `error_perm`: 5xx permanent errors
- `error_proto`: Invalid response format
- `all_errors`: Tuple of all expected exceptions including OSError, EOFError

### Protocol Parsing Functions

- `parse150()` (L792): Extract file size from 150 responses
- `parse227()` (L812): Parse PASV response for IPv4 data connections
- `parse229()` (L831): Parse EPSV response for IPv6 data connections  
- `parse257()` (L852): Extract directory names from MKD/PWD responses

### Key Constants

- `FTP_PORT = 21` (L51): Standard FTP control port
- `MAXLINE = 8192` (L53): Maximum line length for responses
- `CRLF/B_CRLF` (L70-71): Line terminators for text/binary modes

### Internal Architecture

The class uses a layered approach:
- Socket management with timeout and source address support
- Text wrapper (`self.file`) for command channel communication
- Binary socket operations for data transfers
- Debugging levels 0-2 for protocol tracing
- Security: Password sanitization in debug output, audit events for connections

### Data Transfer Pattern

All transfers use `ntransfercmd()` (L336) which:
1. Establishes data connection (PASV or PORT mode)
2. Sends transfer command
3. Returns connected socket and optional size
4. Higher-level methods handle data streaming and connection cleanup

### Notable Security Features

- `trust_server_pasv_ipv4_address` (L107): Controls whether to trust server-provided IP in PASV mode
- Password masking in debug output via `sanitize()` (L188)
- SSL/TLS support with proper certificate validation
- Audit trail integration via `sys.audit()`