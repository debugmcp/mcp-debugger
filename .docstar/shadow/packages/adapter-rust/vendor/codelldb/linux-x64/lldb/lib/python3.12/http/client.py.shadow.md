# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/http/client.py
@source-hash: d78f92c3b6e5aa77
@generated: 2026-02-09T18:06:21Z

## HTTP/1.1 Client Library

**Primary Purpose:** Complete HTTP/1.1 client implementation providing connection management, request/response handling, and protocol compliance for Python applications.

### Core Architecture

**State Machine Design (L6-69):** Implements a rigorous HTTP connection state machine with states:
- `_CS_IDLE` (L98): Ready for new request
- `_CS_REQ_STARTED` (L99): Request headers being built  
- `_CS_REQ_SENT` (L100): Request sent, awaiting response

State transitions enforce RFC compliance preventing premature requests and ensuring proper connection lifecycle management.

### Key Classes

**HTTPResponse (L252-802):** HTTP response parser and reader
- `__init__()` (L261): Initializes from socket with method context
- `begin()` (L324): Parses status line and headers, handles 100-continue responses
- `read()/readinto()` (L463/L503): Content reading with chunked transfer support
- `_read_chunked()` (L591): Implements RFC chunked encoding protocol
- `_safe_read()` (L633): Ensures complete reads or raises IncompleteRead
- `getheader()/getheaders()` (L728/L748): Header access methods

**HTTPConnection (L817-1446):** HTTP client connection manager
- `__init__()` (L865): Sets up connection parameters, validates host
- `connect()` (L998): Establishes TCP connection with tunneling support
- `putrequest()` (L1136): Initiates request with method/URL validation
- `putheader()` (L1292): Adds headers with validation
- `endheaders()` (L1320): Finalizes request and sends body
- `getresponse()` (L1384): Returns HTTPResponse instance
- `_send_request()` (L1338): High-level request sending with chunked encoding logic

**HTTPSConnection (L1452-1480):** SSL/TLS wrapper extending HTTPConnection
- Uses SSL context for encrypted connections
- Handles server name indication (SNI)

### Utility Functions

- `_encode()` (L161): Latin-1 encoding with descriptive error messages
- `_read_headers()` (L213): Reads headers with line/count limits
- `parse_headers()` (L245): Converts raw headers to HTTPMessage objects
- `_create_https_context()` (L804): Creates SSL context with HTTP/1.1 ALPN

### Security Features

**Input Validation:**
- Method validation (L1267): Prevents header injection via control characters
- URL validation (L1276): Prevents CVE-2019-9740 via control character filtering  
- Host validation (L1284): Prevents CVE-2019-18348
- Header validation (L1303/L1313): Validates names and values

**Protocol Compliance:**
- Content-Length calculation (L834): Automatic for body types
- Chunked encoding support (L1126): HTTP/1.1 transfer encoding
- IPv6 address handling (L947): Proper bracket wrapping
- Tunneling support (L952): HTTP CONNECT for proxies

### Constants and Configuration

- `HTTP_PORT=80`, `HTTPS_PORT=443` (L92-93): Default ports
- `_MAXLINE=65536`, `_MAXHEADERS=100` (L111-112): Protocol limits
- Regex patterns for validation (L139-154): Header/URL character restrictions
- `_METHODS_EXPECTING_BODY` (L158): Methods requiring Content-Length

### Exception Hierarchy

Complete exception set extending HTTPException (L482-546):
- Connection state errors (CannotSendRequest, ResponseNotReady)
- Protocol errors (BadStatusLine, UnknownProtocol)  
- Data errors (IncompleteRead, LineTooLong)
- Network errors (RemoteDisconnected, NotConnected)

### Dependencies

- `email.parser/message`: Header parsing
- `socket`: Network connectivity  
- `ssl`: HTTPS support (optional)
- `urllib.parse`: URL handling
- `io`: Stream interfaces

This implementation provides production-ready HTTP client functionality with comprehensive error handling, security validations, and full HTTP/1.1 protocol support including persistent connections, chunked encoding, and SSL/TLS.