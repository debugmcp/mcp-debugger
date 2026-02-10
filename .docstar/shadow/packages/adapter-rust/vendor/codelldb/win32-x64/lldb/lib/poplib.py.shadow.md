# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/poplib.py
@source-hash: 08609dc8298e62bf
@generated: 2026-02-09T18:13:25Z

## Purpose
Python POP3 client library implementing RFC-compliant email retrieval protocol. Provides both plain TCP and SSL/TLS connection support for accessing POP3 mail servers. Located in a vendor directory suggesting bundled third-party dependency.

## Key Classes and Functions

### POP3 (L51-415)
Main POP3 client class supporting both minimal and optional command sets.

**Core Methods:**
- `__init__(host, port=POP3_PORT, timeout=...)` (L98-107): Establishes connection, performs initial handshake
- `user(user)` (L203-208): Sends USER command for authentication
- `pass_(pswd)` (L211-218): Sends PASS command, locks mailbox until quit()
- `stat()` (L221-231): Returns message count and total size as tuple
- `list(which=None)` (L234-245): Lists messages or specific message info
- `retr(which)` (L248-253): Retrieves complete message
- `dele(which)` (L256-261): Marks message for deletion
- `quit()` (L277-281): Commits changes and closes connection
- `close()` (L283-304): Safely closes socket and file handles

**Internal Protocol Methods:**
- `_putcmd(line)` (L122-125): Sends command with encoding
- `_getline()` (L132-147): Reads single line with CRLF handling and length limits
- `_getresp()` (L153-158): Gets server response, validates '+' prefix
- `_getlongresp()` (L163-174): Handles multi-line responses ending with '.'

**Optional Commands:**
- `apop(user, password)` (L318-336): MD5-based authentication using server timestamp
- `top(which, howmuch)` (L339-345): Retrieves message headers plus N body lines
- `uidl(which=None)` (L348-357): Gets unique message identifiers
- `capa()` (L366-392): Returns server capabilities as dictionary
- `stls(context=None)` (L395-414): Upgrades connection to TLS
- `utf8()` (L360-363): Enables UTF-8 mode per RFC 6856

### POP3_SSL (L419-449)
SSL/TLS variant of POP3 class, only available when ssl module is imported.
- `__init__(host, port=POP3_SSL_PORT, *, timeout=..., context=None)` (L431-436): Creates SSL-wrapped connection
- `_create_socket(timeout)` (L438-442): Overrides to wrap socket with SSL context
- `stls(context=None)` (L444-449): Raises exception since TLS already established

### Exception Classes
- `error_proto` (L31): Exception for protocol errors and invalid responses

## Key Constants
- `POP3_PORT = 110` (L34): Standard POP3 port
- `POP3_SSL_PORT = 995` (L37): SSL POP3 port
- `_MAXLINE = 2048` (L48): Maximum line length limit
- `CRLF`, `CR`, `LF` (L40-42): Line terminator constants

## Dependencies
- `socket`: Network communication
- `ssl`: TLS/SSL support (optional, checked at runtime)
- `errno`, `re`, `sys`: Standard library utilities
- `hashlib`: MD5 hashing for APOP authentication (imported lazily)

## Critical Patterns
- **Resource Management**: Proper socket/file cleanup in `close()` with exception handling
- **Protocol Compliance**: Strict adherence to POP3 line-based protocol with CRLF handling
- **Security**: SSL context validation, audit events for security monitoring
- **Error Handling**: Custom exception type for protocol-specific errors
- **Encoding**: UTF-8 encoding by default with proper bytes/string handling

## Constraints
- Mailbox locked from successful authentication until quit()
- Line length limited to 2048 bytes for security
- Non-blocking sockets (timeout=0) explicitly forbidden
- SSL availability checked at module import time