# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/ftplib.py
@source-hash: d46af0c591299d30
@generated: 2026-02-09T18:09:45Z

## Purpose
Python FTP client library implementation based on RFC 959, providing both basic FTP and secure FTP_TLS functionality. Part of Python's standard library, offering programmatic interface for FTP file transfers, directory operations, and server communication.

## Core Classes

### FTP (L74-669)
Main FTP client class implementing RFC 959 protocol.

**Key Attributes:**
- `debugging` (L98): Debug level (0-2)
- `host`, `port` (L99-100): Connection parameters
- `sock`, `file` (L102-103): Socket and file objects
- `passiveserver` (L105): Passive/active mode flag
- `trust_server_pasv_ipv4_address` (L107): Security flag for PASV responses

**Core Methods:**
- `__init__()` (L109-123): Initialize with optional auto-connect/login
- `connect()` (L139-163): Establish connection, return welcome message
- `login()` (L395-419): Authenticate with USER/PASS/ACCT commands
- `quit()` (L651-655): Send QUIT and close connection
- `close()` (L657-668): Clean shutdown without QUIT command

**Data Transfer Methods:**
- `retrbinary()` (L421-442): Download binary data with callback
- `retrlines()` (L444-477): Download text data line by line
- `storbinary()` (L479-503): Upload binary data from file-like object
- `storlines()` (L505-534): Upload text data line by line
- `ntransfercmd()` (L336-389): Core transfer setup (passive/active mode)

**Directory Operations:**
- `nlst()` (L541-548): List files (NLST command)
- `dir()` (L550-563): Long directory listing (LIST command)  
- `mlsd()` (L565-591): Machine-readable listing (MLSD command)
- `cwd()` (L608-619): Change directory with CDUP optimization
- `mkd()`, `rmd()` (L629-640): Create/remove directories
- `pwd()` (L642-649): Get current directory

### FTP_TLS (L677-784)
Secure FTP implementation extending FTP with TLS/SSL support (RFC 4217).

**Key Methods:**
- `auth()` (L726-736): Establish secure control connection
- `prot_p()` (L746-760): Enable secure data connection
- `prot_c()` (L762-766): Disable secure data connection
- `ccc()` (L738-744): Switch back to clear-text control

## Exception Hierarchy (L57-66)
- `Error`: Base exception
- `error_reply`: Unexpected reply codes
- `error_temp`: 4xx temporary errors
- `error_perm`: 5xx permanent errors  
- `error_proto`: Invalid response format
- `all_errors`: Tuple of all possible exceptions

## Protocol Parsing Functions
- `parse150()` (L792-807): Extract file size from 150 responses
- `parse227()` (L812-828): Parse PASV response for host/port
- `parse229()` (L831-849): Parse EPSV response for IPv6
- `parse257()` (L852-871): Extract directory name from 257 responses

## Utility Functions  
- `ftpcp()` (L879-898): Copy files between FTP servers
- `print_line()` (L874-876): Default callback for retrlines
- `test()` (L901-962): Command-line test interface

## Key Constants
- `FTP_PORT = 21` (L51): Standard FTP port
- `MAXLINE = 8192` (L53): Maximum line length
- `MSG_OOB = 0x1` (L47): Out-of-band data flag

## Architecture Notes
- Uses context manager protocol (`__enter__`/`__exit__`)
- Implements both passive and active data transfer modes
- Security consideration: Validates PASV IPv4 addresses by default
- SSL/TLS support conditional on ssl module availability
- Comprehensive debugging support with multiple verbosity levels