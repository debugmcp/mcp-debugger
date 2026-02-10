# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/nntplib.py
@source-hash: 6a76a94b951b273a
@generated: 2026-02-09T18:09:02Z

## Python NNTP (Network News Transfer Protocol) Client Library

**Primary Purpose**: Complete RFC-compliant NNTP client implementation for connecting to newsgroup servers, supporting authentication, SSL/TLS, and all standard NNTP operations.

### Core Classes

**NNTP (L299-1015)**: Main client class handling all NNTP protocol operations
- **Connection Management**: Socket creation (L398-402), SSL/TLS support via STARTTLS (L993-1014)
- **Authentication**: Login with username/password and .netrc support (L938-977)
- **Protocol Handling**: Command sending (_putcmd L453-458), response parsing (_getresp L477-491)
- **Article Operations**: HEAD/BODY/ARTICLE retrieval (L762-802), posting (L905-919)
- **Group Management**: LIST/GROUP commands (L628-707), newsgroup descriptions (L666-681)
- **Overview Support**: XOVER/OVER for article summaries (L826-865)

**NNTP_SSL (L1018-1041)**: SSL-enabled variant inheriting from NNTP
- Uses SSL port 563 by default
- Wraps socket in SSL context during creation (L1031-1039)

### Exception Hierarchy (L99-126)
- **NNTPError**: Base exception with response attribute
- **NNTPReplyError**: Unexpected 1xx-3xx replies
- **NNTPTemporaryError**: 4xx server errors  
- **NNTPPermanentError**: 5xx server errors
- **NNTPProtocolError**: Malformed responses
- **NNTPDataError**: Invalid response data

### Key Utility Functions

**decode_header (L170-179)**: Decodes RFC2047-encoded email headers into unicode
**_parse_overview_fmt (L181-204)**: Parses LIST OVERVIEW.FMT server responses
**_parse_overview (L206-233)**: Processes XOVER/OVER command output into structured data
**_parse_datetime/_unparse_datetime (L235-280)**: NNTP date/time format conversion

### Data Structures
- **GroupInfo (L162-163)**: Named tuple for group metadata (group, last, first, flag)
- **ArticleInfo (L165-166)**: Named tuple for article info (number, message_id, lines)

### Protocol Constants
- **Ports**: NNTP_PORT=119, NNTP_SSL_PORT=563 (L130-131)
- **Response codes**: _LONGRESP set defines multi-line responses (L134-147)
- **Overview format**: _DEFAULT_OVERVIEW_FMT for article summaries (L150-151)

### Key Methods by Category

**Connection**: __init__, _create_socket, _close, quit, starttls, login
**Articles**: article, head, body, stat, next, last, post, ihave  
**Groups**: group, list, newgroups, descriptions
**Overview**: over, xover, _getoverviewfmt
**Utilities**: help, date, capabilities, slave

### Architectural Notes
- UTF-8 encoding with 'surrogateescape' error handling for fault tolerance
- Raw message data (POST/ARTICLE) handled as bytes to preserve encoding
- Automatic capability detection on connect
- Context manager support for connection cleanup
- Extensive debugging support via set_debuglevel