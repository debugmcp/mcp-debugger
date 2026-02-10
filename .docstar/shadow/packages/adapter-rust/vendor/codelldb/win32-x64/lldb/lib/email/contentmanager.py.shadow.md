# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/email/contentmanager.py
@source-hash: 2d81026aef17e478
@generated: 2026-02-09T18:10:41Z

## Email Content Manager

Provides a pluggable system for handling email message content serialization and deserialization through handler registration patterns.

### Core Architecture

**ContentManager (L7-58)**: Central registry managing content handlers through two dictionaries:
- `get_handlers`: Maps content types to extraction functions
- `set_handlers`: Maps object types to content setting functions

Key methods:
- `get_content(msg, *args, **kw)` (L16-25): Retrieves content using hierarchical handler lookup (specific type → main type → fallback)
- `set_content(msg, obj, *args, **kw)` (L30-37): Sets content after finding appropriate handler, blocks multipart messages
- `_find_set_handler(msg, obj)` (L39-58): Complex type resolution using MRO traversal and qualified name matching

### Default Content Handlers

**raw_data_manager (L61)**: Pre-configured ContentManager instance with built-in handlers:

**Text Content (L64-68)**: 
- `get_text_content()`: Decodes text payloads using charset parameter, defaults to ASCII with 'replace' error handling
- Registered for 'text' maintype

**Binary Content (L71-75)**:
- `get_non_text_content()`: Returns decoded binary payload
- Registered for 'audio', 'image', 'video', 'application' maintypes

**Message Content (L78-94)**:
- `get_message_content()`: Extracts first payload item for rfc822/external-body
- `get_and_fixup_unknown_message_content()`: Handles unknown message subtypes as bytes per RFC 2046

### Content Setting Infrastructure

**Preparation/Finalization (L97-129)**:
- `_prepare_set()`: Sets Content-Type header and validates/applies additional headers
- `_finalize_set()`: Applies Content-Disposition, filename, Content-ID, and custom parameters

**Text Encoding (L144-194)**:
- `_encode_text()`: Sophisticated content transfer encoding selection using heuristics
- `_encode_base64()` (L135-141): Custom base64 encoder with line length control
- `set_text_content()`: Comprehensive text content handler supporting charset conversion and encoding selection

**Message Embedding (L197-227)**:
- `set_message_content()`: Handles message/rfc822 and message/external-body with RFC compliance validation
- Enforces encoding restrictions per message subtype specifications

**Binary Content (L230-251)**:
- `set_bytes_content()`: Handles bytes/bytearray/memoryview with multiple encoding options
- Registered for bytes, bytearray, memoryview types

### Key Dependencies

- `email.charset`: Character set handling and alias resolution
- `email.message`: Message object integration
- `email.errors`: Header validation and error handling  
- `quoprimime`: Quoted-printable encoding
- `binascii`: Base64 and quoted-printable encoding utilities

### Design Patterns

- **Strategy Pattern**: Handler registration enables pluggable content processing
- **Chain of Responsibility**: Hierarchical handler lookup (specific → general → fallback)
- **Factory Pattern**: Type-based handler selection for content setting
- **Template Method**: Common preparation/finalization steps with specialized content handling