# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/http/client.py
@source-hash: d78f92c3b6e5aa77
@generated: 2026-02-09T18:11:23Z

## HTTP/1.1 Client Library

Python's HTTP/1.1 client implementation providing connection management, request/response handling, and SSL support. This is the standard library's `http.client` module, implementing RFC 2616 HTTP/1.1 protocol.

### Core Architecture

**State Machine**: HTTPConnection (L817-1446) implements a strict state machine with states:
- `_CS_IDLE` (L98): Ready for new request
- `_CS_REQ_STARTED` (L99): Request initiated but headers not sent
- `_CS_REQ_SENT` (L100): Request fully sent, awaiting response

State transitions are enforced to prevent protocol violations and ensure proper connection reuse.

### Key Classes

**HTTPResponse (L252-802)**: Response object implementing `io.BufferedIOBase`
- `begin()` (L324-395): Parses status line and headers, handles 100-Continue responses
- `read()` (L463-501): Handles chunked encoding, content-length, and connection closing
- `_read_chunked()` (L591-607): Implements RFC 2616 chunked transfer encoding
- `_check_close()` (L396-423): Determines connection persistence based on headers

**HTTPConnection (L817-1446)**: Main connection class
- `putrequest()` (L1136-1262): Validates and sends request line with automatic headers
- `putheader()` (L1292-1318): Validates and queues header fields
- `endheaders()` (L1320-1331): Sends buffered request with optional body
- `getresponse()` (L1384-1445): Returns HTTPResponse instance, enforces state machine
- `_send_request()` (L1338-1382): High-level request method with chunked encoding logic

**HTTPSConnection (L1452-1480)**: SSL-enabled connection extending HTTPConnection
- Uses `ssl._create_default_https_context()` with HTTP/1.1 ALPN support
- Wraps socket after tunnel establishment for proxy scenarios

### Protocol Implementation Details

**Header Validation**: Multiple regex patterns prevent header injection attacks:
- `_is_legal_header_name` (L139): Validates header field names
- `_is_illegal_header_value` (L140): Prevents CRLF injection in values
- `_contains_disallowed_method_pchar_re` (L154): Validates HTTP methods
- `_contains_disallowed_url_pchar_re` (L147): Prevents URL injection (CVE-2019-9740)

**Content Handling**: 
- `_get_content_length()` (L834-863): Automatic Content-Length calculation
- Chunked encoding for unknown-length bodies when HTTP/1.1
- `_METHODS_EXPECTING_BODY` (L158): Forces Content-Length: 0 for PATCH/POST/PUT

**Connection Management**:
- Automatic Host header generation with IPv6 and IDN support
- HTTP CONNECT tunneling via `set_tunnel()` (L888-923)
- TCP_NODELAY optimization in `connect()` (L998-1012)

### Utility Functions

**Header Processing**:
- `parse_headers()` (L245-249): RFC 2822 header parsing using email.parser
- `_read_headers()` (L213-229): Raw header line reading with limits
- `_encode()` (L161-173): Latin-1 encoding with informative error messages

**IPv6 Support**:
- `_wrap_ipv6()` (L947-950): Bracket wrapping for IPv6 addresses
- `_strip_ipv6_iface()` (L175-181): Interface scope removal

### Exception Hierarchy

All exceptions inherit from `HTTPException` (L1482-1485):
- `NotConnected` (L1487): Socket not established
- `InvalidURL` (L1490): Malformed URL (security-related)
- `ResponseNotReady` (L1527): Protocol state violation
- `IncompleteRead` (L1504-1516): Partial response data
- `BadStatusLine` (L1530-1535): Invalid HTTP status line
- `RemoteDisconnected` (L1542-1545): Unexpected connection close

### Security Features

- CVE-2019-9740 prevention via URL validation
- CVE-2019-18348 prevention via host validation  
- Header injection prevention through strict validation
- Control character filtering in methods and URLs

### Constants and Compatibility

- `HTTP_PORT = 80, HTTPS_PORT = 443` (L92-93)
- `_MAXLINE = 65536, _MAXHEADERS = 100` (L111-112): DoS protection limits
- Backwards compatibility via `responses` dict (L108) and globals update (L104)