# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/nntplib.py
@source-hash: 6a76a94b951b273a
@generated: 2026-02-09T18:14:33Z

## NNTP Client Library - Network News Transfer Protocol Implementation

**Purpose**: Complete Python client implementation for NNTP (Network News Transfer Protocol) supporting RFC 977, RFC 2980, and RFC 3977. Provides both plain and SSL-encrypted connections for accessing Usenet newsgroups and articles.

### Core Classes

**NNTP (L299-1015)**: Main client class for NNTP connections
- **Connection Management**: Socket creation (L398-402), file wrapper creation (L340), context manager support (L384-396)
- **Protocol Handling**: Command sending (_putcmd L453), response parsing (_getresp L477), multi-line response handling (_getlongresp L493)
- **Authentication**: Login with username/password or netrc (L938-978), reader mode activation (_setreadermode L979)
- **Core Commands**: GROUP (L683), ARTICLE/HEAD/BODY (L790/762/776), STAT/NEXT/LAST (L734/748/752)
- **Extended Commands**: XOVER/OVER (L826/840), XHDR (L810), LIST variants (L628), NEWGROUPS/NEWNEWS (L596/612)
- **Capabilities**: Server capability detection (L413), overview format parsing (_getoverviewfmt L561)

**NNTP_SSL (L1018-1041)**: SSL-encrypted NNTP client extending NNTP
- Overrides socket creation to apply SSL wrapping (L1031-1039)
- Default port NNTP_SSL_PORT (563)

### Exception Hierarchy (L99-126)
- **NNTPError**: Base exception class
- **NNTPReplyError**: Unexpected 1xx/2xx/3xx replies
- **NNTPTemporaryError**: 4xx server errors  
- **NNTPPermanentError**: 5xx server errors
- **NNTPProtocolError**: Invalid response format
- **NNTPDataError**: Malformed response data

### Data Structures
- **GroupInfo (L162)**: Named tuple (group, last, first, flag) for group information
- **ArticleInfo (L165)**: Named tuple (number, message_id, lines) for article metadata
- **_LONGRESP (L134)**: Response codes indicating multi-line responses
- **_DEFAULT_OVERVIEW_FMT (L150)**: Default OVER/XOVER field format

### Key Utility Functions
- **decode_header (L170)**: Decodes RFC 2047 encoded headers using email.header
- **_parse_overview_fmt (L181)**: Parses LIST OVERVIEW.FMT responses
- **_parse_overview (L206)**: Parses OVER/XOVER command responses into structured data
- **_parse_datetime/_unparse_datetime (L235/257)**: Date/time conversion for NNTP commands
- **_encrypt_on (L285)**: SSL socket wrapping helper

### Protocol Constants
- **NNTP_PORT (L130)**: Standard port 119
- **NNTP_SSL_PORT (L131)**: SSL port 563  
- **_MAXLINE (L95)**: Maximum line length 2048 bytes
- **_CRLF (L160)**: Line terminator b'\r\n'

### Encoding Strategy
- All commands/responses use UTF-8 with 'surrogateescape' error handling
- Raw message data (POST, IHAVE, ARTICLE, HEAD, BODY) handled as bytes
- Automatic encoding/decoding for protocol compliance

### Notable Features
- **Capability Negotiation**: Automatic capability detection on connect
- **STARTTLS Support**: Opportunistic TLS encryption (L993-1014)
- **Netrc Integration**: Automatic credential loading from ~/.netrc
- **File Output Support**: Many commands accept file parameter for direct output
- **Debugging Support**: Multi-level debug output (set_debuglevel L435)

### Command-Line Interface (L1044-1093)
Standalone script mode for fetching and displaying newsgroup articles with SSL support and configurable parameters.