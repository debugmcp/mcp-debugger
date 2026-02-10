# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/nntplib.py
@source-hash: 6a76a94b951b273a
@generated: 2026-02-09T18:07:54Z

## NNTP Client Library

A comprehensive NNTP (Network News Transfer Protocol) client implementation supporting RFC 977, RFC 2980, and RFC 3977. Provides both regular and SSL-encrypted connections to NNTP servers for newsgroup management and article retrieval.

### Core Classes

**NNTP (L299-1015)**: Primary NNTP client class with complete protocol support
- Connection management with timeout and debugging support
- Authentication via AUTHINFO and optional .netrc integration  
- Context manager support (`__enter__`/`__exit__` L384-396)
- Article operations: `article()`, `head()`, `body()` (L790-802, L762-774, L776-788)
- Group management: `group()`, `list()`, `newgroups()` (L683-707, L628-641, L596-610)
- Overview operations: `xover()`, `over()` (L826-838, L840-865)
- Posting capabilities: `post()`, `ihave()` (L905-910, L912-919)

**NNTP_SSL (L1018-1041)**: SSL/TLS-enabled subclass of NNTP
- Inherits all NNTP functionality with encrypted transport
- Custom socket creation with SSL context support

### Exception Hierarchy

**NNTPError (L99-106)**: Base exception with response storage
- **NNTPReplyError (L108-110)**: Unexpected 1xx/2xx/3xx replies
- **NNTPTemporaryError (L112-114)**: 4xx server errors  
- **NNTPPermanentError (L116-118)**: 5xx server errors
- **NNTPProtocolError (L120-122)**: Invalid response format
- **NNTPDataError (L124-126)**: Response data parsing errors

### Data Structures

**GroupInfo (L162-163)**: Named tuple for group information (group, last, first, flag)
**ArticleInfo (L165-166)**: Named tuple for article metadata (number, message_id, lines)

### Key Utilities

**decode_header() (L170-179)**: Decodes MIME-encoded header values
**_parse_overview() (L206-233)**: Parses OVER/XOVER command responses
**_parse_datetime() (L235-255)**: Converts NNTP date/time strings to datetime objects
**_unparse_datetime() (L257-280)**: Formats datetime objects for NNTP commands

### Protocol Implementation

- UTF-8 encoding with 'surrogateescape' error handling for commands/responses
- Binary mode for raw message data (POST, IHAVE, ARTICLE, HEAD, BODY)
- Automatic capability detection and caching
- Support for both legacy and modern NNTP protocol versions
- Line length protection (_MAXLINE = 2048, L95)

### Connection Features

- Automatic MODE READER negotiation for reader-specific commands
- STARTTLS support for upgrading to encrypted connections (L993-1014)
- Comprehensive authentication with fallback mechanisms
- Proper resource cleanup and connection management

### Constants

- Standard ports: NNTP_PORT = 119, NNTP_SSL_PORT = 563 (L130-131)
- Long response codes in _LONGRESP set (L134-147)
- Default overview format in _DEFAULT_OVERVIEW_FMT (L150-151)