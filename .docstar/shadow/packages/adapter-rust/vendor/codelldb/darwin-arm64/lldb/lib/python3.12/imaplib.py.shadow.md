# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/imaplib.py
@source-hash: 81a8a1705087119d
@generated: 2026-02-09T18:07:26Z

## IMAP4 Client Implementation

**Primary Purpose**: Complete IMAP4/IMAP4rev1 protocol client implementation with SSL, streaming, and authentication support.

### Core Classes

**IMAP4 (L135-1280)**: Main IMAP4 client class with comprehensive protocol support
- State machine: LOGOUT → NONAUTH → AUTH → SELECTED (L188-266)
- Connection management via `open()` (L304-314), `shutdown()` (L335-349)
- All IMAP4rev1 commands as lowercase methods (e.g., `login()` L603-614, `select()` L738-767)
- Exception hierarchy: `error` → `abort` → `readonly` (L184-186)
- UTF-8 mode switching via `_mode_utf8()` (L220-224) and `_mode_ascii()` (L213-218)
- Command execution flow: `_simple_command()` → `_command()` → `_command_complete()` (L1228-1056)

**IMAP4_SSL (L1284-1322)**: SSL-enabled subclass (when ssl available)
- Wraps socket with SSL context in `_create_socket()` (L1308-1311)
- Default port 993 (L1301)

**IMAP4_stream (L1324-1378)**: Subprocess-based connection
- Uses `subprocess.Popen()` for command-based connections (L1350-1353)
- Separate read/write file handles (L1354-1355)

**_Authenticator (L1381-1423)**: Base64 authentication processor
- Handles AUTHENTICATE command conversation flow (L1390-1394)
- Base64 encoding/decoding for auth mechanisms (L1396-1423)

### Key Protocol Elements

**Commands Dictionary (L58-102)**: Maps IMAP4 commands to valid states
- Enforces state machine constraints in `_command()` (L966-971)

**Response Parsing Regexes (L106-131)**:
- `Continuation` (L106): Server continuation responses
- `Untagged_response` (L125): Untagged server responses  
- `InternalDate` (L108-112): Date format parsing
- `Response_code` (L124): Bracketed response codes

**Tag Management**: Unique command tags via `Int2AP()` (L1463-1472) and `_new_tag()` (L1212-1217)

### Response Processing Architecture

**Response Flow**: `_get_response()` (L1068-1146) → `_get_tagged_response()` (L1148-1179)
- Handles tagged, untagged, and continuation responses
- Literal data processing (L1114-1131)
- Response classification and storage in `untagged_responses` dict (L193)

**Utility Methods**:
- `recent()` (L363-377): Get recent message notifications
- `response()` (L380-387): Retrieve stored untagged responses

### Utility Functions

**Date/Time Conversion**:
- `Time2Internaldate()` (L1487-1524): Convert Python datetime to IMAP format
- `Internaldate2tuple()` (L1428-1459): Parse IMAP date to time tuple

**Data Conversion**:
- `ParseFlags()` (L1476-1484): Parse IMAP flags response
- `Int2AP()` (L1463-1472): Integer to A-P string (for tags)

### Configuration Constants

- `IMAP4_PORT = 143`, `IMAP4_SSL_PORT = 993` (L42-43)
- `_MAXLINE = 1000000`: Response line length limit (L53)
- `Debug`: Global debug level control (L41)
- `AllowedVersions`: Supported protocol versions (L44)

### Debug Infrastructure

**Debug Methods (L1245-1279)**: Conditional compilation debug support
- `_mesg()`: Timestamped debug output (L1247-1252)
- `_dump_ur()`: Untagged response dumping (L1254-1259)  
- `print_log()`: Command interaction history (L1268-1279)
- Command logging in `_cmd_log` dict (L1261-1266)

### Test Infrastructure (L1528-1632)

Command-line test suite with two test sequences covering basic IMAP operations, mailbox management, and message handling.