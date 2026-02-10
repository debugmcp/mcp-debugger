# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/ftplib.py
@source-hash: d46af0c591299d30
@generated: 2026-02-09T18:12:55Z

## FTP Client Library

This module provides RFC 959-compliant FTP client implementations with optional TLS support. It's part of the Python standard library bundled with an LLDB debugger package.

### Primary Classes

**FTP (L74-669)**: Core FTP client implementing the File Transfer Protocol
- Connection management: `connect()` (L139), `close()` (L657), `quit()` (L651)
- Authentication: `login()` (L395) with anonymous login defaults
- File transfers: `retrbinary()` (L421), `retrlines()` (L444), `storbinary()` (L479), `storlines()` (L505)
- Directory operations: `cwd()` (L608), `pwd()` (L642), `mkd()` (L629), `rmd()` (L638)
- File operations: `delete()` (L600), `rename()` (L593), `size()` (L621), `nlst()` (L541), `dir()` (L550)
- Data connection modes: `makeport()` (L311) for active, `makepasv()` (L324) for passive
- Protocol support: IPv4/IPv6 via `sendport()`/`sendeprt()` (L288/298)

**FTP_TLS (L677-785)**: TLS-secured FTP client extending FTP
- TLS setup: `auth()` (L726), `prot_p()`/`prot_c()` (L746/762) for data channel protection
- Overrides: `ntransfercmd()` (L770), `abort()` (L777) for SSL compatibility
- Security features: control channel encryption, optional data channel encryption

### Exception Hierarchy (L57-66)
- `Error`: Base exception
- `error_reply`: Unexpected server reply codes
- `error_temp`/`error_perm`: 4xx/5xx FTP error responses
- `error_proto`: Malformed server responses

### Key Protocol Handlers
- `parse150()` (L792): Extract file size from transfer responses
- `parse227()` (L812): Parse PASV response for IPv4 data connections
- `parse229()` (L831): Parse EPSV response for IPv6 data connections
- `parse257()` (L852): Extract directory names from PWD/MKD responses

### Architecture Patterns
- State management: tracks connection (`sock`), file handle (`file`), passive mode (`passiveserver`)
- Context manager support: `__enter__`/`__exit__` (L125-137) for automatic cleanup
- Security considerations: `trust_server_pasv_ipv4_address` (L107) prevents IP spoofing
- Debugging: Multi-level debug output via `set_debuglevel()` (L172)
- Encoding: UTF-8 default with configurable encoding for international filenames

### Dependencies
- `socket`: Network communication and address family detection
- `ssl`: Optional TLS/SSL support for FTP_TLS
- `sys`: Auditing hooks for security monitoring

### Critical Invariants
- Control connection must be established before data operations
- TYPE command must precede binary/ASCII transfers
- Passive mode preferred for security (firewall compatibility)
- CRLF line endings enforced for protocol compliance