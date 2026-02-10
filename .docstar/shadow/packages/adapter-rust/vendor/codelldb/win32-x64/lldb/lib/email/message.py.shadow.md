# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/email/message.py
@source-hash: 70db4f3ef586530f
@generated: 2026-02-09T18:10:44Z

## Python Email Message Module

Core email message handling implementation from Python's standard library email package. Provides RFC 2822-compliant message objects with header manipulation and payload handling.

### Primary Components

**Message Class (L135-975)**
Main email message object implementing partial mapping interface for headers. Stores headers as list of (name, value) tuples in `_headers` attribute (L152) and payload in `_payload` attribute (L154). Default content type is 'text/plain' (L160).

Key functionality:
- Header operations: get/set/delete headers with case-insensitive lookup
- Payload handling: string for single parts, list for multipart messages  
- Content-Type parameter manipulation (charset, boundary, etc.)
- Serialization via `as_string()` (L167) and `as_bytes()` (L196)
- Content Transfer Encoding decode support (quoted-printable, base64, uuencode)

**MIMEPart Class (L977-1198)**
Enhanced Message subclass with modern email handling. Uses default email policy instead of compat32. Adds:
- Content management via policy's content_manager (L1125-1133)
- Body/attachment separation logic with `get_body()` (L1038) and `iter_attachments()` (L1062)
- Multipart creation methods: `make_related/alternative/mixed()` (L1162-1169)
- Content addition methods: `add_related/alternative/attachment()` (L1181-1188)

**EmailMessage Class (L1200-1205)**
Top-level user-facing class. Automatically adds MIME-Version header when content is set.

### Utility Functions

- `_splitparam()` (L29): Parse header parameters at semicolon boundaries
- `_formatparam()` (L39): Format key=value pairs with RFC 2231 encoding support
- `_parseparam()` (L73): Parse semicolon-separated parameter lists with quote handling
- `_decode_uu()` (L104): UUEncode decoder with error recovery
- `_unquotevalue()` (L93): Remove quotes from parameter values

### Key Dependencies

- `email.utils`: Header utilities and RFC 2231 encoding
- `email.generator`: Message serialization (Generator, BytesGenerator)  
- `email.policy`: Policy-based message handling
- `email._policybase.compat32`: Backward compatibility policy
- `quopri`, `binascii`: Content transfer encoding support

### Architecture Notes

Headers stored as ordered list maintaining insertion order. Policy object controls parsing/formatting behavior. Multipart messages contain list of Message objects as payload. Content-Transfer-Encoding handled transparently during payload decode.