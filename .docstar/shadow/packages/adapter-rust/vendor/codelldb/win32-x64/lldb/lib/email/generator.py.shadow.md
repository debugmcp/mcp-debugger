# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/email/generator.py
@source-hash: e5b7a15b4ae82089
@generated: 2026-02-09T18:10:50Z

## Primary Purpose
Email message flattening library that converts Python email Message objects to plain text or bytes output. Core component of Python's standard email package for serializing structured email data back to RFC-compliant format.

## Key Classes and Functions

### Generator Class (L27-404)
Main text generator for email messages. Handles conversion of Message object trees to plain text format.

**Constructor** (L37-67): Configures output file, From_ line mangling, header length limits, and email policy
**flatten()** (L73-120): Main entry point that converts Message tree to output, with Unix From_ delimiter support
**clone()** (L122-127): Creates identical generator instance with different output file
**write()** (L69-71): Delegates writing to configured output file object

**Protected Methods:**
- **_write()** (L166-203): Core message processing with buffered subpart handling and Content-Transfer-Encoding munging
- **_dispatch()** (L205-219): Content-type based method dispatch to specific handlers (_handle_<type>_<subtype>)
- **_write_headers()** (L225-238): Header serialization with policy-based folding and validation

**Content Handlers:**
- **_handle_text()** (L244-263): Text payload processing with charset handling and From_ line escaping
- **_handle_multipart()** (L268-324): Multipart message assembly with boundary generation and part concatenation
- **_handle_multipart_signed()** (L326-335): Preserves signed content integrity by disabling header wrapping
- **_handle_message_delivery_status()** (L337-356): Special handling for delivery status reports
- **_handle_message()** (L358-376): Processes message/rfc822 parts

**Utility Methods:**
- **_make_boundary()** (L384-399): Generates unique MIME boundaries avoiding conflicts with content
- **_new_buffer()** (L142-144): Creates StringIO buffer (overridden by subclasses)
- **_encode()** (L146-148): Identity encoding (overridden by subclasses)

### BytesGenerator Class (L406-454)
Extends Generator for bytes output instead of strings. Handles surrogate decoding and binary header folding.

**Key Overrides:**
- **write()** (L419-420): Encodes strings to bytes using surrogateescape
- **_new_buffer()** (L422-423): Returns BytesIO instead of StringIO  
- **_encode()** (L425-426): ASCII encoding for internal strings
- **_handle_text()** (L436-446): Preserves original bytes when surrogates detected

### DecodedGenerator Class (L458-512)
Text-only generator that replaces non-text parts with descriptive placeholders.

**Constructor** (L464-492): Accepts format string for non-text part substitution
**_dispatch()** (L494-512): Walks message tree, prints text parts and formatted placeholders for others

## Key Dependencies
- **re**: Regex patterns for newline handling (NLCRE L22) and From_ line detection (fcre L23)
- **email.utils**: Surrogate detection for encoding issues
- **email.errors**: HeaderWriteError for malformed headers
- **copy.deepcopy**: Message copying for encoding modifications
- **io.StringIO/BytesIO**: Buffering for subpart processing

## Important Constants and Patterns
- **NEWLINE_WITHOUT_FWSP** (L24): Detects improper header folding
- **_FMT** (L456): Default non-text part placeholder template
- **_fmt/_width** (L516-517): Boundary generation formatting

## Critical Design Patterns

**Buffered Processing**: Uses temporary buffers (_new_buffer) to handle subparts before writing headers, enabling content-dependent header modification.

**Policy-Driven Behavior**: Respects email.policy objects for line length, folding, and encoding decisions. Temporarily modifies message policies during processing.

**Content-Type Dispatch**: Dynamic method resolution based on MIME types (_handle_<maintype>_<subtype> fallback to _handle_<maintype>).

**Encoding State Management**: Tracks Content-Transfer-Encoding changes (_munge_cte) when handling charset conversion with surrogates.

## Architectural Constraints

- Preserves message object policies through context managers
- Maintains RFC compliance for multipart boundaries and header folding
- Handles encoding edge cases (surrogates, 8-bit content) gracefully
- Supports both string and bytes output through inheritance hierarchy