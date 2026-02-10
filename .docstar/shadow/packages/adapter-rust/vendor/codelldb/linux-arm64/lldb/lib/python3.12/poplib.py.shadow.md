# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/poplib.py
@source-hash: 08609dc8298e62bf
@generated: 2026-02-09T18:09:08Z

## Primary Purpose
POP3 client implementation providing both standard and SSL-encrypted connections to POP3 email servers. Based on RFC 1939 POP3 specification with support for optional extensions.

## Key Classes and Functions

### POP3 (L51-415)
Main POP3 client class supporting both minimal and optional command sets.

**Core Infrastructure:**
- `__init__(host, port=110, timeout)` (L98-107): Establishes connection, performs audit logging, creates socket and file objects
- `_create_socket(timeout)` (L109-112): Creates TCP connection with timeout validation
- `_putline(line)` (L114-117): Low-level line sending with debugging and audit support
- `_putcmd(line)` (L122-125): Command transmission with encoding
- `_getline()` (L132-147): Line reception with length limits (_MAXLINE=2048), handles various CRLF combinations
- `_getresp()` (L153-158): Single response parsing, validates '+' prefix
- `_getlongresp()` (L163-174): Multi-line response parsing with dot-termination and byte-stuffing
- `_shortcmd(line)` (L179-181): Send command, get single response
- `_longcmd(line)` (L186-188): Send command, get multi-line response

**POP3 Protocol Commands:**
- `user(user)` (L203-208): USER authentication
- `pass_(pswd)` (L211-218): PASS authentication (locks mailbox)
- `stat()` (L221-231): Mailbox statistics, returns (message_count, total_size)
- `list(which=None)` (L234-245): Message listing
- `retr(which)` (L248-253): Message retrieval
- `dele(which)` (L256-261): Message deletion
- `noop()` (L264-269): No-operation keepalive
- `rset()` (L272-274): Reset deletion marks
- `quit()` (L277-281): Graceful disconnect with server commit

**Optional Extensions:**
- `apop(user, password)` (L318-336): APOP authentication using timestamp + MD5
- `top(which, howmuch)` (L339-345): Retrieve message headers + N lines
- `uidl(which=None)` (L348-357): Unique ID listing
- `capa()` (L366-392): Server capabilities discovery (RFC 2449)
- `stls(context=None)` (L395-414): STARTTLS encryption upgrade
- `utf8()` (L360-363): UTF-8 mode activation (RFC 6856)

**Connection Management:**
- `close()` (L283-304): Robust cleanup with exception handling for already-closed connections
- `getwelcome()` (L193-194): Returns server welcome message
- `set_debuglevel(level)` (L197-198): Debug output control

### POP3_SSL (L419-449)
SSL-enabled POP3 client extending POP3 class.
- `__init__(host, port=995, context=None)` (L431-436): SSL context setup
- `_create_socket(timeout)` (L438-442): Creates SSL-wrapped socket
- `stls(context=None)` (L444-449): Disabled - raises exception (SSL already established)

## Important Dependencies
- `socket`: TCP connection management
- `ssl`: TLS/SSL encryption (optional, HAVE_SSL flag)
- `hashlib`: MD5 hashing for APOP authentication
- `sys`: Audit logging and argument parsing
- `errno`: Error code handling in connection cleanup

## Protocol Constants
- `POP3_PORT = 110`, `POP3_SSL_PORT = 995` (L34, 37)
- `_MAXLINE = 2048` (L48): Line length limit for security
- `CRLF = b'\r\n'` (L42): Protocol line terminator
- `encoding = 'UTF-8'` (L96): Default character encoding

## Architectural Patterns
- **Command-Response Pattern**: All POP3 operations use _shortcmd/_longcmd wrappers
- **Layered Protocol**: Raw socket → line-based → command-response → high-level methods  
- **Graceful Degradation**: SSL support conditionally available based on import success
- **Security Audit**: sys.audit() calls for connection and command operations
- **Error Handling**: Single exception type `error_proto` for all protocol errors

## Critical Invariants
- Mailbox locked from successful authentication until QUIT
- All commands must be properly terminated with CRLF
- Multi-line responses terminated by lone '.' on line
- Byte-stuffing: lines starting with '..' have first '.' stripped
- Connection cleanup handles already-closed sockets gracefully
- SSL connections cannot use STLS (already encrypted)