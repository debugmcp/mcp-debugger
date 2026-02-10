# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/imaplib.py
@source-hash: 81a8a1705087119d
@generated: 2026-02-09T18:13:23Z

## IMAP4 Client Implementation

**Primary Purpose**: Full-featured IMAP4/IMAP4rev1 client library implementing RFC 2060 protocol for email server communication.

**Key Classes & Functions**:

- **IMAP4 (L135-1280)**: Main client class with complete IMAP4rev1 command set
  - State management: LOGOUT/NONAUTH/AUTH/SELECTED states (L190, L266)
  - Connection handling: socket-based communication with timeout support (L188-212)
  - Command execution: tagged command system with response parsing (L964-1038)
  - Exception hierarchy: error/abort/readonly for different failure modes (L184-186)

- **IMAP4_SSL (L1284-1321)**: SSL/TLS variant extending IMAP4 with encrypted connections
  - Uses ssl.SSLContext for secure communication (L1303-1311)
  - Inherits all IMAP4 functionality with encrypted transport

- **IMAP4_stream (L1324-1378)**: Subprocess-based variant for shell command connections
  - Uses subprocess.Popen for process-based communication (L1350-1355)

- **_Authenticator (L1381-1423)**: Base64 authentication conversation handler
  - Provides encode/decode for SASL authentication mechanisms (L1396-1423)

**Core Protocol Support**:
- All standard IMAP4rev1 commands as methods (append, authenticate, capability, etc.)
- UTF-8 support via ENABLE UTF8=ACCEPT (L511-521)
- STARTTLS for upgrading to encrypted connections (L809-829)
- Authentication methods: LOGIN, CRAM-MD5, and extensible AUTHENTICATE (L603-646)

**Response Processing**:
- Pattern matching with compiled regex for server responses (L106-131)
- Untagged response collection and retrieval (L944-956, L1233-1242)
- Literal data handling for large message parts (L1114-1132)

**Utility Functions**:
- **Internaldate2tuple (L1428-1459)**: Parse IMAP INTERNALDATE to time.struct_time
- **Time2Internaldate (L1487-1524)**: Convert Python datetime to IMAP format
- **ParseFlags (L1476-1484)**: Extract flags from IMAP FLAGS response
- **Int2AP (L1463-1472)**: Convert integer to base-16 A-P representation

**Configuration Constants**:
- Commands dict (L58-102): Valid IMAP4 commands and allowed states
- Protocol settings: ports (L42-43), line limits (L53), encodings (L213-224)

**Debug Infrastructure** (L245-1279):
- Comprehensive logging system with multiple debug levels
- Command history tracking and interaction dumping
- Message timestamp logging with microsecond precision