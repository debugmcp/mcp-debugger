# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/imaplib.py
@source-hash: 81a8a1705087119d
@generated: 2026-02-09T18:10:05Z

## IMAP4 Client Library

Python's standard IMAP4 client implementation based on RFC 2060, providing classes for connecting to and interacting with IMAP email servers.

### Primary Classes

**IMAP4 (L135-1281)** - Main IMAP4 client class supporting all IMAP4rev1 commands
- Constructor accepts host, port, timeout parameters (L188-212)
- Maintains connection state machine with states: LOGOUT, NONAUTH, AUTH, SELECTED (L190)
- Exception hierarchy: `error` (L184), `abort` (L185), `readonly` (L186)
- Context manager support via `__enter__`/`__exit__` (L275-285)

**IMAP4_SSL (L1284-1322)** - SSL/TLS variant of IMAP4 client
- Inherits from IMAP4, adds SSL context handling
- Uses `ssl._create_stdlib_context()` by default (L1303-1304)
- Overrides `_create_socket()` to wrap with SSL (L1308-1311)

**IMAP4_stream (L1324-1378)** - Subprocess-based IMAP connection
- Connects via external command using subprocess.Popen (L1350-1353)
- Separate read/write file handles (L1354-1355)

**_Authenticator (L1381-1423)** - Base64 authentication helper
- Encodes/decodes authentication data for SASL mechanisms
- Used internally by `authenticate()` method (L441)

### Core Connection Management

**Socket Operations (L291-357)**
- `_create_socket()` (L291-302): Creates TCP connection with optional timeout
- `open()` (L304-313): Establishes connection and file handle
- `read()`/`readline()` (L316-326): Data reading with _MAXLINE protection (L53)
- `send()` (L329-332): Data transmission with audit logging
- `shutdown()` (L335-348): Clean connection teardown

### Protocol State Management

**Connection Setup (L227-266)**
- `_connect()`: Tag generation, welcome message processing, capability detection
- Supports PREAUTH and standard authentication flows
- Version negotiation from AllowedVersions tuple (L44)

**Encoding Modes (L213-224)**
- `_mode_ascii()`: Standard ASCII mode with 'ascii' encoding
- `_mode_utf8()`: UTF-8 mode enabled via ENABLE UTF8=ACCEPT (L519-520)
- Dynamic regex compilation based on encoding mode

### Command Processing

**Command Infrastructure (L964-1056)**
- `_command()`: Core command sender with literal data support
- `_simple_command()` (L1228-1230): Wrapper for synchronous commands
- `_command_complete()` (L1041-1056): Response waiting and error handling
- Tagged command tracking via `tagged_commands` dict (L192)

**Response Processing (L1068-1145)**
- `_get_response()`: Main response parser handling tagged/untagged/continuation responses
- Regex-based parsing using compiled patterns (L106-131)
- Literal data handling for large responses
- Untagged response accumulation in `untagged_responses` dict (L193)

### IMAP4 Command Methods

All standard IMAP4rev1 commands implemented as lowercase methods:
- **Authentication**: `login()` (L603-614), `authenticate()` (L420-446), `logout()` (L634-644)
- **Mailbox Operations**: `select()` (L738-767), `create()` (L489-494), `delete()` (L497-502)
- **Message Operations**: `fetch()` (L537-549), `search()` (L720-735), `store()` (L844-852)
- **Extended Commands**: ACL, QUOTA, NAMESPACE, SORT, THREAD methods

**Dynamic Command Resolution (L269-273)**
- `__getattr__()` allows UPPERCASE command variants by mapping to lowercase methods

### Utility Functions

**Date/Time Conversion**
- `Time2Internaldate()` (L1487-1524): Converts various date formats to IMAP INTERNALDATE
- `Internaldate2tuple()` (L1428-1459): Parses IMAP dates to time tuples

**Data Processing**
- `Int2AP()` (L1463-1472): Integer to base-16 A-P string conversion
- `ParseFlags()` (L1476-1484): IMAP flags response parsing

### Constants and Configuration

- **Ports**: IMAP4_PORT=143, IMAP4_SSL_PORT=993 (L42-43)
- **Line Limits**: _MAXLINE=1000000 bytes to handle large responses (L53)
- **Protocol**: Commands dict maps command names to valid states (L58-102)
- **Regex Patterns**: Pre-compiled patterns for response parsing (L106-131)

### Debug Infrastructure

Conditional debug support (L245-1280):
- Command logging with configurable detail levels
- Interaction history tracking
- Response dumping utilities
- `print_log()` method for debugging failed connections

### Dependencies

- **Core**: socket, ssl, subprocess, re, time, calendar, datetime
- **Utilities**: binascii (base64), errno, random, sys
- **Optional**: ssl module with HAVE_SSL flag (L29-33)