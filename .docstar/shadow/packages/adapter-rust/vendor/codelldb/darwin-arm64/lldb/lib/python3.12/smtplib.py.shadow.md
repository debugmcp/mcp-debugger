# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/smtplib.py
@source-hash: f19369e751e199f5
@generated: 2026-02-09T18:07:28Z

## Python SMTP Client Library

This is Python's standard `smtplib` module providing SMTP/ESMTP client functionality with support for authentication, TLS, and various SMTP extensions. Implements RFC 821 (SMTP), RFC 1869 (ESMTP), RFC 2554 (Authentication), and RFC 2487 (TLS).

### Core Classes

**SMTP (L190-999)**: Main SMTP client class managing connections to SMTP/ESMTP servers
- Connection management: `connect()` (L315), `close()` (L978), `quit()` (L991)
- Protocol commands: `helo()` (L435), `ehlo()` (L445), `mail()` (L527), `rcpt()` (L548), `data()` (L556)
- Authentication: `login()` (L686), `auth()` (L616), built-in auth methods (L664-684)
- TLS support: `starttls()` (L752)
- High-level operations: `sendmail()` (L797), `send_message()` (L901)
- Key attributes: `esmtp_features`, `does_esmtp`, `helo_resp`, `ehlo_resp`

**SMTP_SSL (L1003-1032)**: SSL-enabled SMTP subclass (only available if SSL support compiled)
- Inherits from SMTP, overrides `_get_socket()` (L1025) to wrap with SSL
- Default port 465, uses SSL context for secure connections

**LMTP (L1040-1087)**: Local Mail Transfer Protocol implementation 
- Extends SMTP for Unix socket connections and TCP
- Uses "lhlo" command instead of "ehlo" (L1054)
- Supports Unix domain sockets in `connect()` (L1062)

### Exception Hierarchy

Base exception: **SMTPException (L72)** extends OSError
- **SMTPNotSupportedError (L75)**: Unsupported commands/options
- **SMTPServerDisconnected (L82)**: Connection lost/not established
- **SMTPResponseException (L90)**: Base for server error responses
  - **SMTPSenderRefused (L104)**: Sender address rejected
  - **SMTPDataError (L130)**: DATA command failed
  - **SMTPConnectError (L133)**: Connection establishment failed
  - **SMTPHeloError (L136)**: HELO/EHLO command failed
  - **SMTPAuthenticationError (L139)**: Authentication failed
- **SMTPRecipientsRefused (L117)**: All recipients rejected

### Utility Functions

- **quoteaddr()** (L146): Quote email addresses per RFC 821
- **quotedata()** (L167): Quote message data, handle line endings
- **_addr_only()** (L159): Extract bare email address
- **_quote_periods()** (L176): Quote leading dots in binary data
- **_fix_eols()** (L179): Normalize line endings to CRLF

### Constants

- **SMTP_PORT = 25**, **SMTP_SSL_PORT = 465**, **LMTP_PORT = 2003**
- **CRLF = "\r\n"**, **bCRLF = b"\r\n"** 
- **_MAXLINE = 8192**: Maximum line length
- **_MAXCHALLENGE = 5**: Maximum AUTH challenges

### Key Patterns

- Connection state management with proper cleanup in `__exit__()` (L280)
- Protocol compliance with proper CRLF handling and line length limits
- Extensible authentication framework supporting CRAM-MD5, PLAIN, LOGIN
- Debug output controlled by `debuglevel` attribute
- Graceful fallback from ESMTP to basic SMTP
- Support for both string and bytes message data
- International email support via SMTPUTF8 extension