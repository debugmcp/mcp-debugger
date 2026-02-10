# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/imaplib.py
@source-hash: 81a8a1705087119d
@generated: 2026-02-09T18:08:58Z

## IMAP4 Client Library

This is Python's standard library implementation of an IMAP4 email client, providing RFC 2060/3501 compliant functionality for accessing email servers.

### Core Classes

**IMAP4 (L135-1281)**: Main IMAP4 client class
- Constructor takes host, port, timeout parameters (L188)
- Manages connection state machine: LOGOUT → NONAUTH → AUTH → SELECTED
- Supports all IMAP4rev1 commands as methods (append, authenticate, fetch, search, etc.)
- Exception hierarchy: error (L184), abort (L185), readonly (L186)
- Context manager support via __enter__/__exit__ (L275-286)

**IMAP4_SSL (L1284-1322)**: SSL-enabled IMAP4 client (requires ssl module)
- Inherits from IMAP4, adds SSL context wrapping
- Uses IMAP4_SSL_PORT (993) by default

**IMAP4_stream (L1324-1378)**: IMAP4 over subprocess pipe
- For connecting via shell commands (e.g., rsh, ssh tunnels)
- Uses subprocess.Popen for process management

**_Authenticator (L1381-1423)**: Base64 authentication helper
- Handles encoding/decoding for SASL authentication mechanisms

### Key Protocol Elements

**Commands Dictionary (L58-102)**: Maps IMAP4 commands to valid connection states
- Enforces state machine constraints for command execution
- Used by _command() for validation

**Regular Expressions (L106-131)**: Protocol parsing patterns
- InternalDate, Flags, Response_code, Untagged_response patterns
- Compiled per encoding mode (ASCII vs UTF-8)

**Connection Management**:
- open() (L304): Creates socket connection
- _create_socket() (L291): Overridable socket factory
- send()/read()/readline() (L329/316/321): I/O primitives
- shutdown() (L335): Clean connection teardown

**Command Processing**:
- _command() (L964): Core command execution with literal support
- _simple_command() (L1228): Wrapper for basic commands
- _get_response() (L1068): Protocol response parser
- _get_tagged_response() (L1148): Waits for command completion

**State Management**:
- tagpre/tagnum (L231/215): Unique command tagging
- untagged_responses (L193): Server push notifications
- tagged_commands (L192): Pending command tracking

### Utility Functions

**Internaldate2tuple() (L1428)**: Parses IMAP internal date format to time.struct_time
**Time2Internaldate() (L1487)**: Converts various date formats to IMAP internal date string
**ParseFlags() (L1476)**: Converts IMAP flags response to Python tuple
**Int2AP() (L1463)**: Converts integers to base-16 A-P representation for tagging

### Protocol Features

- UTF-8 support via enable('UTF8=ACCEPT') and _mode_utf8() (L220)
- STARTTLS for connection upgrading (L809)
- Multiple authentication mechanisms (LOGIN, CRAM-MD5, custom via authenticate())
- Literal string handling for large message data
- Comprehensive response parsing and error handling
- Debug logging system with configurable levels

### Architectural Notes

- Follows RFC 2060/3501 IMAP4rev1 specification
- State machine enforces valid command sequences
- Extensible via xatom() for server-specific extensions
- Thread-safe design (each instance maintains independent state)
- Handles server push notifications (EXISTS, EXPUNGE, etc.)
- Graceful error recovery with connection state cleanup