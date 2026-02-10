# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/poplib.py
@source-hash: 08609dc8298e62bf
@generated: 2026-02-09T18:10:00Z

## POP3 Email Client Library

A complete implementation of POP3 (Post Office Protocol version 3) client functionality for email retrieval. Supports both standard TCP and SSL/TLS connections with comprehensive command set coverage.

### Core Classes

**POP3 (L51-415)** - Main POP3 client class
- Manages TCP connection to POP3 servers on port 110
- Implements full POP3 command set (USER, PASS, STAT, LIST, RETR, DELE, etc.)
- Features connection management, line-based protocol handling, and error handling
- Key attributes: `host`, `port`, `sock`, `file`, `welcome`, `_tls_established`

**POP3_SSL (L419-449)** - SSL/TLS-enabled POP3 client
- Extends POP3 for secure connections on port 995
- Wraps socket with SSL context during connection establishment
- Overrides `_create_socket()` and `stls()` methods for SSL handling

**error_proto (L31)** - Exception class for POP3 protocol errors

### Key Methods

**Connection Management:**
- `__init__()` (L98-107) - Establishes connection and reads server welcome
- `_create_socket()` (L109-112) - Creates TCP socket with timeout support
- `close()` (L283-304) - Clean connection teardown with error handling
- `quit()` (L277-281) - POP3 QUIT command with connection cleanup

**Protocol Communication:**
- `_putline()` (L114-117) - Sends raw data with CRLF termination
- `_putcmd()` (L122-125) - Sends command with encoding
- `_getline()` (L132-147) - Reads response line with length validation
- `_getresp()` (L153-158) - Gets single response, validates '+' prefix
- `_getlongresp()` (L163-174) - Gets multi-line response until '.' terminator

**POP3 Commands:**
- Authentication: `user()` (L203), `pass_()` (L211), `apop()` (L318-336)
- Mailbox operations: `stat()` (L221), `list()` (L234), `retr()` (L248), `dele()` (L256)
- Optional commands: `top()` (L339), `uidl()` (L348), `capa()` (L366), `stls()` (L395)

### Dependencies & Configuration

**External Dependencies:**
- `socket` - TCP connection management
- `ssl` (optional) - TLS/SSL support (sets `HAVE_SSL` flag)
- `hashlib` - MD5 hashing for APOP authentication
- `re` - Timestamp parsing for APOP

**Protocol Constants:**
- `POP3_PORT = 110`, `POP3_SSL_PORT = 995`
- `_MAXLINE = 2048` - Maximum line length protection
- Line terminators: `CRLF`, `CR`, `LF` for protocol compliance

### Architecture Notes

- Line-based protocol with strict CRLF handling and multiple terminator support
- Comprehensive error handling with custom exception type
- Debugging support via `_debugging` level and `set_debuglevel()`
- Audit logging integration with `sys.audit()` calls
- Binary/text encoding handling with UTF-8 default
- Socket cleanup with proper shutdown sequence and Windows compatibility

### Critical Constraints

- Mailbox locking: Server locks mailbox from authentication until QUIT
- Single-threaded design: One connection per instance
- Line length enforcement: 2048 byte maximum per RFC compliance
- SSL context management: Prevents double TLS establishment