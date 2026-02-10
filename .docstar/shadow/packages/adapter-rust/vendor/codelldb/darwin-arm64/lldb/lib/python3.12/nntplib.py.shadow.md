# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/nntplib.py
@source-hash: 6a76a94b951b273a
@generated: 2026-02-09T18:07:25Z

## NNTP Client Library (Network News Transfer Protocol)

**Primary Purpose**: Complete Python implementation of an NNTP client for accessing news servers according to RFC 977, RFC 2980, and RFC 3977. Provides both plain and SSL connections with full protocol command support.

### Core Classes

**NNTP (L299-1015)**: Main client class handling NNTP protocol communication
- Connection management with socket and file objects (L335-348)
- UTF-8 encoding/decoding with surrogateescape error handling (L312-313)
- Command/response pipeline with debugging support (L435-491)
- Context manager support (__enter__/__exit__, L384-396)

**NNTP_SSL (L1018-1041)**: SSL/TLS-enabled subclass of NNTP
- Uses SSL context for encrypted connections (L1020-1029)
- Overrides _create_socket() for SSL wrapping (L1031-1039)

### Exception Hierarchy (L99-126)
- **NNTPError**: Base exception with response attribute
- **NNTPReplyError**: Unexpected [123]xx replies
- **NNTPTemporaryError**: 4xx server errors
- **NNTPPermanentError**: 5xx server errors
- **NNTPProtocolError**: Invalid response format
- **NNTPDataError**: Response data parsing errors

### Key Protocol Methods

**Connection & Authentication**:
- `login()` (L938-978): AUTHINFO authentication with optional netrc support
- `starttls()` (L993-1014): STARTTLS command for encryption upgrade
- `quit()` (L929-936): Clean connection termination

**Article Operations**:
- `article()/head()/body()` (L790-802, L762-774, L776-788): Retrieve message parts
- `stat()/next()/last()` (L734-754): Article navigation
- `post()/ihave()` (L905-919): Message submission

**Group Operations**:
- `group()` (L683-707): Select newsgroup, get article counts
- `list()` (L628-641): List available groups
- `newgroups()/newnews()` (L596-626): Query new content

**Overview/Header Operations**:
- `over()/xover()` (L840-865, L826-838): Article overview data
- `xhdr()` (L810-824): Header extraction

### Utility Functions

**decode_header()** (L170-179): Decode RFC-encoded header strings
**_parse_overview_fmt()** (L181-204): Parse LIST OVERVIEW.FMT responses
**_parse_overview()** (L206-233): Parse OVER/XOVER command responses
**_parse_datetime()/_unparse_datetime()** (L235-280): Date/time format conversion

### Named Tuples
- **GroupInfo** (L162-163): Group metadata (group, last, first, flag)
- **ArticleInfo** (L165-166): Article info (number, message_id, lines)

### Internal Protocol Handlers
- `_getresp()` (L477-491): Parse single-line responses, handle error codes
- `_getlongresp()` (L493-537): Handle multi-line responses with dot-stuffing
- `_putcmd()/_putline()` (L453-458, L444-451): Send commands with proper encoding

### Configuration Constants
- **NNTP_PORT/NNTP_SSL_PORT** (L130-131): Standard port numbers
- **_LONGRESP** (L134-147): Response codes indicating multi-line data
- **_DEFAULT_OVERVIEW_FMT** (L150-151): Default overview field format
- **_MAXLINE** (L95): Maximum line length protection

### Architecture Notes
- UTF-8 encoding throughout with surrogateescape error handling for fault tolerance
- Automatic capability detection and caching
- Support for both legacy and modern NNTP versions
- Reader mode handling for server compatibility
- Comprehensive SSL/TLS support with STARTTLS upgrade capability

### Demo Script (L1044-1093)
Command-line interface demonstrating library usage with argument parsing and article display functionality.