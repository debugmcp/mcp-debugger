# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/email/mime/nonmultipart.py
@source-hash: 4eb9ad32603d66fc
@generated: 2026-02-09T18:06:05Z

**Primary Purpose**: Base class for MIME message types that are not multipart, enforcing the constraint that non-multipart MIME messages cannot have additional subparts attached.

**Key Components**:
- `MIMENonMultipart` class (L13-21): Inherits from `MIMEBase` and serves as a base class for all non-multipart MIME message types
- `attach()` method (L16-21): Overridden to raise `MultipartConversionError` when attempting to attach subparts, preventing API misuse

**Dependencies**:
- `email.errors`: Provides `MultipartConversionError` exception
- `email.mime.base.MIMEBase`: Parent class providing base MIME functionality

**Architectural Pattern**: 
Template method pattern implementation where the base class enforces behavioral constraints through method overriding. The class acts as a safety mechanism in the email MIME hierarchy.

**Critical Invariant**: 
Non-multipart MIME messages must never allow attachment of additional subparts. This constraint is enforced at runtime by raising an exception rather than allowing silent failure or incorrect message structure.

**Usage Context**: 
This class is intended to be subclassed by specific MIME types (like text/plain, image/jpeg, etc.) that are inherently non-multipart. Direct instantiation is not the typical use case.