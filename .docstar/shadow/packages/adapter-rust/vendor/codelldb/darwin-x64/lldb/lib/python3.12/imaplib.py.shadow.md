# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/imaplib.py
@source-hash: 81a8a1705087119d
@generated: 2026-02-09T18:07:59Z

## IMAP4 Client Library

**Primary Purpose**: Complete RFC 2060-compliant IMAP4 client implementation for email server communication.

### Core Classes

**IMAP4 (L135-1280)**: Main client class providing full IMAP4rev1 protocol support
- **State Management**: Tracks connection state (NONAUTH/AUTH/SELECTED/LOGOUT) (L190)
- **Socket Operations**: Handles connection, reading, writing via `open()` (L304), `read()` (L316), `readline()` (L321), `send()` (L329), `shutdown()` (L335)
- **Command Interface**: All IMAP4 commands as lowercase methods (append, authenticate, capability, etc.)
- **Exception Hierarchy**: `error` (L184), `abort` (L185), `readonly` (L186) for different failure modes
- **UTF8 Support**: Dynamic encoding switching via `_mode_ascii()` (L213) and `_mode_utf8()` (L220)

**IMAP4_SSL (L1284-1321)**: SSL-enabled IMAP4 client (requires SSL support)
- **SSL Integration**: Wraps socket with SSL context in `_create_socket()` (L1308)
- **Default Port**: Uses 993 for secure connections

**IMAP4_stream (L1324-1378)**: Stream-based IMAP4 via subprocess
- **Process Management**: Uses `subprocess.Popen()` for external command execution (L1350)
- **I/O Redirection**: Separate read/write file handles for bidirectional communication

**_Authenticator (L1381-1423)**: Base64 authentication handler
- **Encoding/Decoding**: Manages SASL authentication data transformation

### Key Infrastructure

**Protocol Constants (L38-102)**:
- **Commands Dict (L58-102)**: Maps each IMAP4 command to valid states
- **Response Patterns (L106-131)**: Compiled regex for parsing server responses
- **Global Settings**: Debug level, port numbers, line limits

**Response Processing**:
- **Tagged Responses**: Command completion tracking via `_get_tagged_response()` (L1148)
- **Untagged Responses**: Server push notifications via `_get_response()` (L1068)
- **Continuation Handling**: Multi-part command support for authentication and literals

### Public Utility Functions

**Time/Date Conversion**:
- `Internaldate2tuple()` (L1428): Parse IMAP INTERNALDATE to Python time tuple
- `Time2Internaldate()` (L1487): Convert Python datetime to IMAP format

**Data Utilities**:
- `Int2AP()` (L1463): Convert integer to A-P string (tag generation)
- `ParseFlags()` (L1476): Extract message flags from server response

### Protocol Features

**Authentication Methods**:
- Plain login via `login()` (L603)
- CRAM-MD5 via `login_cram_md5()` (L617) 
- Generic SASL via `authenticate()` (L420)

**Mailbox Operations**:
- Selection: `select()`/`examine()` for read-write/read-only access
- Management: `create()`, `delete()`, `rename()` for mailbox lifecycle
- ACL Support: `getacl()`, `setacl()`, `deleteacl()` for permissions

**Message Operations**:
- Retrieval: `fetch()` (L537) with flexible part specification
- Search: `search()` (L720) with charset support, `sort()` (L795), `thread()` (L863)
- Modification: `store()` (L844) for flags, `copy()` (L481), `expunge()` (L523)

**Extensions**:
- QUOTA support via `getquota()`/`setquota()`
- ANNOTATION support via `getannotation()`/`setannotation()`
- STARTTLS for connection upgrade
- UTF8 mode switching for international support

### Architecture Patterns

**Command Pattern**: All IMAP commands follow consistent `_simple_command()` -> `_command()` -> `_command_complete()` flow
**State Machine**: Strict state validation prevents invalid command sequences
**Error Hierarchy**: Graduated exception types enable appropriate error handling strategies
**Debug Infrastructure**: Comprehensive logging and interaction tracking for troubleshooting