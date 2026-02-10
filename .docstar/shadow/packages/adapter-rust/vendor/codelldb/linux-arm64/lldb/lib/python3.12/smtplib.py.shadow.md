# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/smtplib.py
@source-hash: f19369e751e199f5
@generated: 2026-02-09T18:09:11Z

## SMTP Client Library

**Purpose**: Complete SMTP/ESMTP client implementation following RFC 821, RFC 1869 (ESMTP), RFC 2554 (AUTH), and RFC 2487 (TLS).

### Core Classes

**SMTP (L190-1000)**: Main SMTP client class managing server connections and protocol operations
- Connection management: `connect()` (L315), `close()` (L978), context manager support (L277-288)
- Protocol commands: `helo()` (L435), `ehlo()` (L445), `mail()` (L527), `rcpt()` (L548), `data()` (L556)
- Authentication: `login()` (L686), `auth()` (L616) with CRAM-MD5/PLAIN/LOGIN support
- TLS support: `starttls()` (L752)
- High-level operations: `sendmail()` (L797), `send_message()` (L901)

**SMTP_SSL (L1003-1033)**: SSL-encrypted SMTP subclass (requires SSL support)
- Inherits from SMTP, overrides socket creation with SSL wrapper
- Default port 465, custom `_get_socket()` (L1025)

**LMTP (L1040-1087)**: Local Mail Transfer Protocol implementation
- Extends SMTP for Unix socket support
- Uses "lhlo" command instead of "ehlo" (L1054)
- Custom `connect()` method handles Unix domain sockets (L1062)

### Exception Hierarchy

Base exception: **SMTPException (L72)**
- **SMTPNotSupportedError (L75)**: Unsupported commands/options
- **SMTPServerDisconnected (L82)**: Connection issues
- **SMTPResponseException (L90)**: Base for server error responses
  - **SMTPSenderRefused (L104)**: Sender address rejected
  - **SMTPDataError (L130)**: DATA command rejected
  - **SMTPConnectError (L133)**: Connection establishment failed
  - **SMTPHeloError (L136)**: HELO/EHLO rejected
  - **SMTPAuthenticationError (L139)**: Authentication failed
- **SMTPRecipientsRefused (L117)**: All recipients rejected

### Utility Functions

- **quoteaddr() (L146)**: Quote email addresses per RFC 821
- **quotedata() (L167)**: Quote message data, handle line endings
- **_addr_only() (L159)**: Extract address from email string
- **_fix_eols() (L179)**: Normalize line endings to CRLF
- **_quote_periods() (L176)**: Escape leading periods in binary data

### Key Constants

- `SMTP_PORT = 25`, `SMTP_SSL_PORT = 465`, `LMTP_PORT = 2003` (L62-63, L1038)
- `_MAXLINE = 8192`: Maximum line length (L66)
- `_MAXCHALLENGE = 5`: Authentication challenge limit (L67)

### Protocol Features

- ESMTP extension parsing in `ehlo()` (L463-494)
- Authentication challenge-response handling (L648-659)
- Message size calculation for ESMTP SIZE extension (L866)
- International email support via SMTPUTF8 (L958-965)
- TLS state reset after STARTTLS (L786-789)

### Architecture Notes

- Uses socket-based communication with optional SSL/TLS wrapping
- Maintains connection state (`helo_resp`, `ehlo_resp`, `esmtp_features`)
- Implements proper SMTP command pipelining and response parsing
- Supports both string and binary message handling
- Comprehensive error handling with specific exception types