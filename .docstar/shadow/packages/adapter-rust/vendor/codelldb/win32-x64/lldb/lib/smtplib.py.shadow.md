# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/smtplib.py
@source-hash: f19369e751e199f5
@generated: 2026-02-09T18:13:17Z

## Purpose
Python SMTP client library providing RFC 821 (SMTP), RFC 1869 (ESMTP), RFC 2554 (SMTP Authentication), and RFC 2487 (Secure SMTP/TLS) compliance. Part of the Python standard library, vendored within a LLDB debugging environment.

## Core Classes

### SMTP (L190-999)
Main SMTP client class managing connections to SMTP/ESMTP servers.

**Key Attributes:**
- `sock` (L221): Socket connection to server
- `file` (L222): File-like wrapper for socket reads
- `esmtp_features` (L249): Dictionary of server ESMTP extensions
- `does_esmtp` (L226): Boolean indicating ESMTP support
- `debuglevel` (L219): Debug output verbosity level

**Connection Methods:**
- `__init__()` (L229-275): Initialize client, auto-connect if host provided
- `connect()` (L315-346): Establish socket connection to SMTP server
- `close()` (L978-989): Close socket and file connections
- `quit()` (L991-999): Send QUIT command and close connection

**Protocol Methods:**
- `helo()` (L435-443): Send HELO command for SMTP identification
- `ehlo()` (L445-494): Send EHLO command, parse ESMTP extensions
- `mail()` (L527-546): Send MAIL FROM command with ESMTP options
- `rcpt()` (L548-554): Send RCPT TO command for recipient
- `data()` (L556-583): Send DATA command and message content
- `sendmail()` (L797-899): Complete mail transaction (MAIL/RCPT/DATA sequence)

**Authentication Methods:**
- `login()` (L686-750): Authenticate using preferred auth methods
- `auth()` (L616-662): Generic authentication handler with challenge-response
- `auth_plain()` (L673-676): PLAIN authentication implementation
- `auth_login()` (L678-684): LOGIN authentication implementation
- `auth_cram_md5()` (L664-671): CRAM-MD5 authentication implementation

**Security:**
- `starttls()` (L752-795): Upgrade connection to TLS encryption

### SMTP_SSL (L1003-1033)
SSL-encrypted SMTP subclass, available only when SSL support is compiled in.
- Inherits from SMTP, overrides socket creation to use SSL context
- Default port 465 (L1014)

### LMTP (L1040-1087)
Local Mail Transfer Protocol implementation extending SMTP.
- Supports Unix domain sockets (L1062-1087)
- Uses "lhlo" instead of "ehlo" (L1054)
- Default port 2003 (L1038)

## Exception Hierarchy (L72-144)
- `SMTPException` (L72): Base exception class
- `SMTPResponseException` (L90): Exceptions with SMTP error codes
- `SMTPSenderRefused` (L104): Sender address rejected
- `SMTPRecipientsRefused` (L117): All recipients rejected
- `SMTPDataError` (L130): DATA command failed
- `SMTPConnectError` (L133): Connection establishment failed
- `SMTPAuthenticationError` (L139): Authentication failed

## Utility Functions
- `quoteaddr()` (L146-157): Quote email addresses per RFC 821
- `quotedata()` (L167-174): Quote message data, escape leading periods
- `_fix_eols()` (L179-180): Normalize line endings to CRLF
- `_quote_periods()` (L176-177): Escape leading periods in binary data

## Constants
- `SMTP_PORT = 25` (L62): Standard SMTP port
- `SMTP_SSL_PORT = 465` (L63): SMTP over SSL port
- `_MAXLINE = 8192` (L66): Maximum line length for server responses
- `_MAXCHALLENGE = 5` (L67): Maximum AUTH challenges allowed

## Architecture Notes
- Socket-based communication with buffered file I/O for reading
- Extensive debug output support via `debuglevel` attribute
- Context manager support for automatic cleanup
- Graceful handling of server disconnections
- ESMTP feature detection and negotiation
- Support for international email addresses (SMTPUTF8)