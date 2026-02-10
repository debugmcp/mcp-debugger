# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/email/encoders.py
@source-hash: 690b275529788cc4
@generated: 2026-02-09T18:10:27Z

**Primary Purpose**: Email message payload encoding utilities for MIME content transfer encoding. Part of Python's email package, providing functions to encode message payloads using standard transfer encodings and set appropriate headers.

**Key Functions**:
- `encode_base64(msg)` (L25-34): Encodes message payload in Base64 format, sets Content-Transfer-Encoding header to 'base64'
- `encode_quopri(msg)` (L36-44): Encodes message payload in quoted-printable format, sets Content-Transfer-Encoding header to 'quoted-printable' 
- `encode_7or8bit(msg)` (L47-62): Automatically detects and sets Content-Transfer-Encoding header to '7bit' or '8bit' based on ASCII compatibility test
- `encode_noop(msg)` (L64-65): No-operation encoder that does nothing to the message
- `_qencode(s)` (L19-22): Internal helper that applies quoted-printable encoding with space character encoding (spaces → '=20')

**Dependencies**:
- `base64.encodebytes` (imported as `_bencode`) for Base64 encoding
- `quopri.encodestring` (imported as `_encodestring`) for quoted-printable encoding

**Key Patterns**:
- All encoding functions modify the message object in-place, setting both payload and Content-Transfer-Encoding header
- Functions expect message objects with `get_payload(decode=True)`, `set_payload()`, and header assignment capabilities
- Uses defensive programming in `encode_7or8bit()` with ASCII decode attempt to determine encoding type
- Custom quoted-printable implementation handles space encoding that standard library omits

**Critical Behavior**:
- `encode_7or8bit()` defaults to '7bit' encoding when payload is None (L50-53)
- Space characters require manual encoding in quoted-printable (L22)
- All encoders assume binary payload data retrieved via `get_payload(decode=True)`