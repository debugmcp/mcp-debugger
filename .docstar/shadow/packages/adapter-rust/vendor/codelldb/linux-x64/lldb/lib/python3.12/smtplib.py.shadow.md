# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/smtplib.py
@source-hash: f19369e751e199f5
@generated: 2026-02-09T18:10:09Z

## Purpose
Python SMTP/ESMTP client implementation following RFC 821, RFC 1869, RFC 2554, and RFC 2487. Provides classes for sending email via SMTP servers with support for authentication, TLS/SSL encryption, and various SMTP extensions.

## Key Classes

### SMTP (L190-999)
Main SMTP client class managing connections to SMTP/ESMTP servers.

**Key attributes:**
- `sock` (L221): Socket connection to server
- `file` (L222): File object for reading server responses
- `helo_resp`/`ehlo_resp` (L223, L225): Server greeting responses
- `esmtp_features` (L249): Dictionary of supported ESMTP extensions
- `does_esmtp` (L226): Boolean indicating ESMTP support
- `command_encoding` (L250): Character encoding for commands (ascii/utf-8)

**Core methods:**
- `__init__` (L229-275): Initialize connection, auto-connect if host provided
- `connect` (L315-346): Establish socket connection to SMTP server
- `send` (L348-365): Send raw data to server with encoding handling
- `putcmd`/`docmd` (L367-432): Send SMTP commands and get responses
- `getreply` (L380-427): Read and parse server responses with multiline support

**SMTP commands:**
- `helo`/`ehlo` (L435-494): Server greeting and capability negotiation
- `mail`/`rcpt` (L527-554): Envelope sender/recipient specification
- `data` (L556-583): Message data transmission with period escaping
- `starttls` (L752-795): Upgrade connection to TLS encryption
- `auth` (L616-662): Generic authentication framework

**High-level operations:**
- `sendmail` (L797-899): Complete mail transaction (MAIL→RCPT→DATA)
- `send_message` (L901-976): Send email.message.Message objects with header parsing
- `login` (L686-750): Authenticate using preferred methods (CRAM-MD5, PLAIN, LOGIN)

### SMTP_SSL (L1003-1033)
SSL-enabled SMTP subclass using encrypted sockets from connection start.
- `default_port` = 465 (L1014)
- `_get_socket` (L1025-1031): Wraps socket with SSL context

### LMTP (L1040-1087)  
Local Mail Transfer Protocol client, similar to SMTP but supports Unix domain sockets.
- `ehlo_msg` = "lhlo" (L1054): Uses LHLO instead of EHLO
- `connect` (L1062-1087): Handles both TCP and Unix socket connections

## Exception Hierarchy

All exceptions inherit from `SMTPException` (L72-73):
- `SMTPNotSupportedError` (L75-80): Unsupported command/option
- `SMTPServerDisconnected` (L82-88): Connection lost
- `SMTPResponseException` (L90-102): Base for server error responses
  - `SMTPSenderRefused` (L104-115): Sender address rejected
  - `SMTPDataError` (L130-131): DATA command rejected
  - `SMTPConnectError` (L133-134): Connection establishment failed
  - `SMTPHeloError` (L136-137): HELO/EHLO greeting failed
  - `SMTPAuthenticationError` (L139-144): Authentication failed
- `SMTPRecipientsRefused` (L117-127): All recipients rejected

## Utility Functions

- `quoteaddr` (L146-157): Format email addresses for SMTP commands
- `_addr_only` (L159-164): Extract address from display name format
- `quotedata` (L167-174): Escape periods and normalize line endings
- `_quote_periods` (L176-177): Binary period escaping for data
- `_fix_eols` (L179-180): Normalize line endings to CRLF

## Constants

- `SMTP_PORT` = 25, `SMTP_SSL_PORT` = 465, `LMTP_PORT` = 2003 (L62-63, L1038)
- `_MAXLINE` = 8192: Maximum line length (L66)
- `_MAXCHALLENGE` = 5: Maximum auth challenge attempts (L67)
- `CRLF` = "\r\n": Standard SMTP line terminator (L64)

## Authentication Methods

Built-in auth methods in SMTP class:
- `auth_cram_md5` (L664-671): HMAC-MD5 challenge-response
- `auth_plain` (L673-676): Plain text username/password
- `auth_login` (L678-684): LOGIN method with separate user/pass challenges

## Dependencies

- `socket`: Network connectivity
- `ssl`: TLS/SSL encryption (optional import, L182-187)
- `email.utils`, `email.message`, `email.generator`: Email message handling
- `base64`, `hmac`: Authentication encoding/hashing
- `re`: Pattern matching for server responses and data formatting