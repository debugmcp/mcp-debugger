# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/poplib.py
@source-hash: 08609dc8298e62bf
@generated: 2026-02-09T18:07:56Z

## Purpose
Python POP3 client implementation following RFC 1939 for email retrieval. Provides both plain and SSL/TLS connection classes for accessing POP3 mail servers.

## Core Classes
- **POP3 (L51-416)**: Main client class supporting minimal and optional POP3 command sets
  - Handles TCP socket connections, line-based protocol communication
  - UTF-8 encoding by default, configurable debugging levels
- **POP3_SSL (L419-450)**: SSL/TLS variant extending POP3 with secure connections
  - Only available when SSL module is present (`HAVE_SSL`)

## Key Connection Methods
- **__init__ (L98-108)**: Establishes connection, performs SSL handshake if applicable
- **_create_socket (L109-112)**: Creates underlying socket connection with timeout support
- **close (L283-304)**: Graceful connection teardown with error handling
- **quit (L277-281)**: POP3 QUIT command with automatic connection closure

## Protocol Communication (L114-189)
- **_putline/_putcmd**: Send commands to server with CRLF termination
- **_getline**: Read server responses with line length limits (_MAXLINE=2048)
- **_getresp**: Parse single-line responses, validate '+' status prefix
- **_getlongresp**: Handle multi-line responses terminated by '.' line
- **_shortcmd/_longcmd**: High-level command dispatch patterns

## POP3 Commands
**Authentication:**
- user()/pass_() (L203-218): USER/PASS authentication sequence
- apop() (L318-336): APOP digest authentication using MD5 hashing

**Message Operations:**
- stat() (L221-231): Get mailbox statistics (count, size)
- list() (L234-245): List messages with optional message number
- retr() (L248-253): Retrieve complete message content
- dele() (L256-261): Mark message for deletion
- top() (L339-345): Retrieve message headers plus N body lines

**Session Management:**
- noop() (L264-269): Keep-alive command
- rset() (L272-274): Reset deletion marks
- quit() (L277-281): Commit changes and close session

**Optional Extensions:**
- uidl() (L348-357): Unique ID listing
- capa() (L366-392): Server capability discovery
- stls() (L395-414): Start TLS encryption on existing connection
- utf8() (L360-363): Enable UTF-8 mode

## Configuration Constants
- POP3_PORT=110, POP3_SSL_PORT=995 (L34, L37)
- Line terminators: CR, LF, CRLF (L40-42)
- Maximum line length protection: _MAXLINE=2048 (L48)

## Dependencies
- Core: socket, sys, errno, re modules
- SSL support conditional on ssl module availability
- hashlib for APOP MD5 digest computation

## Test Script
Includes command-line test program (L453-467) demonstrating basic POP3 session workflow.