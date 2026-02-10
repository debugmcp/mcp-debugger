# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/nntplib.py
@source-hash: 6a76a94b951b273a
@generated: 2026-02-09T18:10:32Z

## NNTP Client Library

Python library providing RFC-compliant NNTP (Network News Transfer Protocol) client implementation for connecting to news servers and managing newsgroup operations.

### Core Classes

**NNTP (L299-1015)**: Primary NNTP client class with full protocol support
- Handles socket connections, authentication, and command processing
- Supports both plain and SSL connections
- Key initialization parameters: host, port, user, password, readermode, timeout
- Uses UTF-8 encoding with 'surrogateescape' error handling for protocol compliance
- Manages capabilities negotiation and reader mode switching

**NNTP_SSL (L1018-1042)**: SSL-enabled NNTP client extending base NNTP class
- Uses SSL context for encrypted connections
- Default port NNTP_SSL_PORT (563) vs NNTP_PORT (119)

### Exception Hierarchy

**NNTPError (L99-106)**: Base exception class with response attribute
- **NNTPReplyError (L108-110)**: Unexpected [123]xx replies
- **NNTPTemporaryError (L112-114)**: 4xx server errors
- **NNTPPermanentError (L116-118)**: 5xx server errors
- **NNTPProtocolError (L120-122)**: Invalid response format
- **NNTPDataError (L124-126)**: Response data errors

### Key Data Structures

**GroupInfo (L162-163)**: Named tuple for newsgroup information (group, last, first, flag)
**ArticleInfo (L165-166)**: Named tuple for article metadata (number, message_id, lines)

### Protocol Implementation

**Command Processing Methods:**
- `_putcmd()` (L453-458): Send commands with UTF-8 encoding
- `_getresp()` (L477-491): Parse server responses and raise appropriate exceptions
- `_getlongresp()` (L493-537): Handle multi-line responses with optional file output
- `_shortcmd()` (L539-543): Send command and get single-line response
- `_longcmd()` (L545-549): Send command and get multi-line response

**Core NNTP Operations:**
- `group()` (L683-707): Select newsgroup and get statistics
- `article()/head()/body()` (L790-802, L762-774, L776-788): Retrieve message content
- `post()` (L905-910): Submit articles to server
- `list()` (L628-641): Get newsgroup listings
- `xover()/over()` (L826-838, L840-865): Get article overviews
- `capabilities()` (L582-594): Query server capabilities

**Authentication & Security:**
- `login()` (L938-977): AUTHINFO authentication with optional .netrc support
- `starttls()` (L993-1014): Upgrade connection to TLS
- `_setreadermode()` (L979-990): Switch to reader mode

### Utility Functions

**decode_header() (L170-179)**: Decode RFC-compliant email headers to Unicode
**_parse_overview_fmt() (L181-204)**: Parse LIST OVERVIEW.FMT responses
**_parse_overview() (L206-233)**: Parse OVER/XOVER command responses
**_parse_datetime() (L235-255)**: Parse NNTP date/time strings to datetime objects
**_unparse_datetime() (L257-280)**: Format datetime objects for NNTP commands

### Constants & Configuration

- `_MAXLINE = 2048` (L95): Maximum line length for protocol safety
- `_LONGRESP` (L134-147): Response codes indicating multi-line data
- `_DEFAULT_OVERVIEW_FMT` (L150-151): Default overview format fields
- Protocol uses CRLF line terminators and handles dot-stuffing per RFC

### Architectural Notes

- Maintains backward compatibility while supporting RFC 3977 enhancements
- Implements automatic capability negotiation at connection time
- Provides both high-level convenience methods and low-level protocol access
- Thread-safe connection handling with proper resource cleanup
- Supports context manager protocol for automatic connection management