# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/email/mime/application.py
@source-hash: b82a944ccba03e7e
@generated: 2026-02-09T18:06:06Z

## Primary Purpose
Email MIME library component for handling application/* MIME document types. Part of Python's standard email package, providing a concrete implementation for binary/application data attachments.

## Key Components

### MIMEApplication Class (L13-37)
- **Inherits from**: MIMENonMultipart (L13)
- **Purpose**: Creates MIME documents for application/* content types (binary data, executables, documents)
- **Key Method**: `__init__` (L16-37)
  - Accepts raw binary data (`_data`)
  - Configurable MIME subtype (defaults to 'octet-stream')
  - Pluggable encoding strategy via `_encoder` parameter (defaults to base64)
  - Validates subtype is not None (L32-33)
  - Sets payload and applies encoding (L36-37)

## Dependencies
- `email.encoders` (L9): Provides encoding functions (base64 default)
- `email.mime.nonmultipart.MIMENonMultipart` (L10): Base class for non-multipart MIME types

## Architectural Patterns
- **Template Method**: Uses pluggable encoder functions for different encoding strategies
- **Parameter Object**: Accepts arbitrary keyword parameters passed through to base class
- **Inheritance**: Extends MIMENonMultipart for application-specific behavior

## Critical Constraints
- Subtype validation: `_subtype` cannot be None (raises TypeError)
- Binary data handling: Designed for raw bytes, not text
- Encoding requirement: Always applies an encoder function to the payload

## Usage Context
Typically used for email attachments like PDFs, executables, or other binary files that need MIME encoding for email transport.