# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/ftplib.py
@source-hash: d46af0c591299d30
@generated: 2026-02-09T18:07:09Z

## FTP Client Library

Python's standard library implementation of File Transfer Protocol (FTP) client functionality based on RFC 959, providing both plain and TLS-secured FTP connections.

### Core Classes

**FTP (L74-669)**: Main FTP client class with comprehensive protocol implementation
- **Constructor (L109-123)**: Accepts host, user, passwd, acct, timeout, source_address, encoding parameters
- **Connection Management**:
  - `connect()` (L139-163): Establishes socket connection, handles timeout/source address
  - `close()` (L657-668): Safely closes file and socket handles
  - Context manager support via `__enter__`/`__exit__` (L125-137)
- **Protocol Communication**:
  - `putline()`/`putcmd()` (L195-207): Send commands with CRLF termination
  - `getline()`/`getmultiline()` (L211-239): Receive responses with line length limits
  - `getresp()`/`voidresp()` (L243-262): Parse and validate FTP response codes
- **Authentication**: `login()` (L395-419) with anonymous fallback
- **Data Transfer Methods**:
  - `retrbinary()` (L421-442): Binary file downloads with callback support
  - `retrlines()` (L444-477): Text file/listing retrieval line-by-line
  - `storbinary()`/`storlines()` (L479-534): File uploads in binary/text modes
- **Directory Operations**: `cwd()`, `pwd()`, `mkd()`, `rmd()`, `dir()`, `nlst()`, `mlsd()`
- **File Operations**: `rename()`, `delete()`, `size()`

**FTP_TLS (L677-785)**: TLS/SSL-secured FTP subclass extending base FTP
- **Security Methods**:
  - `auth()` (L726-736): Establish TLS control connection
  - `prot_p()`/`prot_c()` (L746-766): Toggle data channel encryption
  - `ccc()` (L738-744): Revert to clear-text control connection
- **Overrides**: `ntransfercmd()` and `abort()` for TLS compatibility

### Exception Hierarchy (L57-66)
- `Error`: Base exception class
- `error_reply`: Unexpected response codes
- `error_temp`: 4xx temporary errors  
- `error_perm`: 5xx permanent errors
- `error_proto`: Invalid response format

### Protocol Parsing Functions
- `parse150()` (L792-807): Extract transfer size from 150 responses
- `parse227()` (L812-828): Parse PASV response for passive mode connection
- `parse229()` (L831-849): Parse EPSV response for IPv6 passive mode
- `parse257()` (L852-871): Extract directory names from MKD/PWD responses

### Key Constants
- `FTP_PORT = 21` (L51): Standard FTP control port
- `MAXLINE = 8192` (L53): Maximum line length for responses
- `CRLF`/`B_CRLF` (L70-71): Line terminators for text/binary modes

### Architectural Patterns
- **Passive vs Active Mode**: Controlled by `passiveserver` flag, affects data connection establishment
- **Security Model**: Optional TLS wrapper with separate control/data channel protection
- **Encoding Handling**: UTF-8 default with configurable encoding for international filenames
- **Error Propagation**: Hierarchical exceptions mapped to FTP response codes
- **Resource Management**: Context manager protocol ensures proper connection cleanup