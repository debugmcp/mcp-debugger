# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/poplib.py
@source-hash: 08609dc8298e62bf
@generated: 2026-02-09T18:07:26Z

## Purpose
Standard library implementation of POP3 (Post Office Protocol version 3) client for email retrieval. Provides both plain and SSL/TLS connection support with complete POP3 command set implementation.

## Core Classes

**POP3 (L51-415)** - Main POP3 client class
- Constructor: `__init__(host, port=POP3_PORT, timeout)` (L98-107) - establishes connection and reads welcome message
- Connection management: `_create_socket()` (L109-112), `close()` (L283-304), `quit()` (L277-281)
- Protocol layer: `_putline()` (L114-117), `_getline()` (L132-147), `_getresp()` (L153-158)
- Command helpers: `_shortcmd()` (L179-181), `_longcmd()` (L186-188), `_getlongresp()` (L163-174)

**POP3_SSL (L419-449)** - SSL/TLS variant (conditionally defined if ssl available)
- Inherits from POP3, wraps socket with SSL context
- Constructor: `__init__(host, port=POP3_SSL_PORT, timeout, context)` (L431-436)
- Overrides `_create_socket()` (L438-442) and `stls()` (L444-449)

**error_proto (L31)** - Exception class for protocol errors

## POP3 Commands Implementation

**Authentication:**
- `user()` (L203-208) - send username
- `pass_()` (L211-218) - send password (note underscore to avoid keyword conflict)
- `apop()` (L318-336) - APOP authentication with MD5 digest

**Mailbox Operations:**
- `stat()` (L221-231) - get message count and total size
- `list()` (L234-245) - list messages or get specific message info
- `retr()` (L248-253) - retrieve complete message
- `dele()` (L256-261) - mark message for deletion
- `top()` (L339-345) - retrieve message headers + N body lines

**Session Management:**
- `noop()` (L264-269) - keep-alive command
- `rset()` (L272-274) - unmark deleted messages
- `quit()` (L277-281) - commit changes and close connection

**Optional/Extended Commands:**
- `uidl()` (L348-357) - get unique message IDs
- `capa()` (L366-392) - get server capabilities as dictionary
- `stls()` (L395-414) - start TLS on plain connection
- `utf8()` (L360-363) - enable UTF-8 mode
- `rpop()` (L311-313) - remote POP (rarely used)

## Key Constants & Configuration

- `POP3_PORT = 110` (L34), `POP3_SSL_PORT = 995` (L37) - standard ports
- `_MAXLINE = 2048` (L48) - line length limit for security
- `CRLF = b'\r\n'` (L42) - protocol line terminator
- `encoding = 'UTF-8'` (L96) - default character encoding
- `timestamp` regex (L316) - for APOP challenge extraction

## Dependencies & Imports
- `socket` - TCP connection handling
- `ssl` (optional) - TLS/SSL support, sets `HAVE_SSL` flag (L21-25)
- `hashlib` - MD5 hashing for APOP (imported on demand in L333)
- `sys` - audit logging and command line interface
- `errno`, `re` - error handling and regex matching

## Architecture Notes
- Line-based protocol with careful CRLF handling across different server implementations
- Implements POP3 dot-stuffing protocol (L167-170) for message termination
- Includes security audit hooks via `sys.audit()` (L103, L116)
- Debugging support via `set_debuglevel()` (L197-198) with multi-level output
- Graceful connection cleanup with proper socket shutdown sequence

## Usage Pattern
Mailbox is locked from successful authentication until `quit()` - typical flow is connect → authenticate → retrieve messages → quit. Protocol is inherently stateful and blocking.

## Test/Demo Code
Command-line interface (L453-467) demonstrates basic usage: connect, authenticate, list, retrieve all messages, and quit.