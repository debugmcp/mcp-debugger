# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/smtplib.py
@source-hash: f19369e751e199f5
@generated: 2026-02-09T18:08:05Z

## SMTP Client Library Implementation

This is Python's standard library `smtplib` module, providing comprehensive SMTP/ESMTP client functionality with SSL/TLS support and authentication mechanisms.

### Core Classes

**SMTP (L190-1000)**: Main SMTP client class managing server connections and protocol operations
- Connection management: `connect()` (L315), `close()` (L978), `quit()` (L991)  
- Protocol commands: `helo()` (L435), `ehlo()` (L445), `mail()` (L527), `rcpt()` (L548), `data()` (L556)
- High-level operations: `sendmail()` (L797), `send_message()` (L901)
- Authentication: `login()` (L686), `auth()` (L616) with CRAM-MD5, PLAIN, LOGIN methods
- TLS support: `starttls()` (L752)
- Debug utilities: `set_debuglevel()` (L290), `_print_debug()` (L299)

**SMTP_SSL (L1003-1032)**: SSL-wrapped SMTP client extending base SMTP class
- Uses SSL context for encrypted connections on port 465
- Overrides `_get_socket()` (L1025) to wrap socket with SSL

**LMTP (L1040-1088)**: Local Mail Transfer Protocol client extending SMTP
- Supports Unix domain sockets via modified `connect()` (L1062)
- Uses "lhlo" greeting instead of "ehlo"

### Exception Hierarchy

**SMTPException (L72)**: Base exception class
- **SMTPNotSupportedError (L75)**: Server doesn't support requested feature
- **SMTPServerDisconnected (L82)**: Connection issues
- **SMTPResponseException (L90)**: Base for server error responses
  - **SMTPSenderRefused (L104)**: Sender address rejected
  - **SMTPRecipientsRefused (L117)**: All recipients rejected
  - **SMTPDataError (L130)**: Data transmission failure
  - **SMTPConnectError (L133)**: Connection establishment failure
  - **SMTPHeloError (L136)**: HELO/EHLO command failure
  - **SMTPAuthenticationError (L139)**: Authentication failure

### Utility Functions

- `quoteaddr()` (L146): Quote email addresses per RFC 821
- `_addr_only()` (L159): Extract address without display name
- `quotedata()` (L167): Quote message data, escape leading periods
- `_quote_periods()` (L176): Binary version of period escaping
- `_fix_eols()` (L179): Normalize line endings to CRLF

### Key Constants

- `SMTP_PORT = 25` (L62): Standard SMTP port
- `SMTP_SSL_PORT = 465` (L63): SSL SMTP port  
- `LMTP_PORT = 2003` (L1038): LMTP port
- `_MAXLINE = 8192` (L66): Maximum line length
- `_MAXCHALLENGE = 5` (L67): Maximum authentication challenges

### Protocol Features

- RFC 821 (SMTP), RFC 1869 (ESMTP), RFC 2554 (AUTH), RFC 2487 (STARTTLS) compliance
- ESMTP extension parsing in `ehlo()` with feature detection via `has_extn()` (L496)
- SMTPUTF8 support for international email addresses
- Multiple authentication mechanisms with fallback logic
- Comprehensive error handling and server response parsing