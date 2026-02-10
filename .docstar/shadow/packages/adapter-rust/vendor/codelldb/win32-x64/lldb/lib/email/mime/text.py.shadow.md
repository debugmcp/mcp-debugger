# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/email/mime/text.py
@source-hash: 71c56a41675a3680
@generated: 2026-02-09T18:06:07Z

## Purpose
Standard Python library module for creating text-based MIME email message objects. Provides a specialized MIME class for handling text/* content types with automatic charset detection and encoding.

## Key Components

### MIMEText Class (L12-40)
Primary class extending `MIMENonMultipart` to create text-based MIME documents.

**Constructor `__init__` (L15-40):**
- Parameters: `_text` (message content), `_subtype` (defaults to 'plain'), `_charset` (optional), `policy` (keyword-only)
- Implements automatic charset detection (L30-35): attempts 'us-ascii' encoding first, falls back to 'utf-8' on Unicode errors
- Calls parent constructor with 'text' main type and specified subtype
- Sets message payload with text content and determined charset

## Dependencies
- `email.mime.nonmultipart.MIMENonMultipart`: Base class for non-multipart MIME objects
- Standard library encoding/charset handling

## Architectural Patterns
- Inheritance from MIMENonMultipart for MIME structure
- Automatic charset detection with fallback strategy (us-ascii → utf-8)
- Parameter validation through parent class initialization
- Payload setting as final initialization step

## Key Behaviors
- Text content encoding validation happens during initialization
- Charset parameter becomes part of Content-Type header via parent class
- Content-Transfer-Encoding header automatically set based on charset selection