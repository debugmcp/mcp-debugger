# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/xml/sax/_exceptions.py
@source-hash: 26564d5742496196
@generated: 2026-02-09T18:06:10Z

**Purpose**: Defines exception hierarchy for SAX (Simple API for XML) parsing operations, providing specialized error types for XML processing scenarios.

**Core Exception Classes**:

- **SAXException (L5-37)**: Base exception class for XML errors/warnings
  - Constructor takes message and optional nested exception (L15-20)
  - `getMessage()` and `getException()` accessors (L22-28)
  - Custom `__getitem__` override prevents indexing confusion (L34-37)
  - Can wrap another exception for error chaining

- **SAXParseException (L42-96)**: Location-aware parsing errors extending SAXException
  - Constructor requires message, exception, and locator object (L55-66)
  - Caches location data at construction time to prevent stale references (L60-66)
  - Location accessors: `getColumnNumber()`, `getLineNumber()`, `getPublicId()`, `getSystemId()` (L68-83)
  - Enhanced string representation includes file:line:column format (L85-96)

- **SAXNotRecognizedException (L101-106)**: For unrecognized features/properties
  - Inherits from SAXException with no additional functionality
  - Used when XMLReader encounters unknown identifiers

- **SAXNotSupportedException (L111-117)**: For unsupported operations
  - Raised when XMLReader cannot perform requested service
  - Base class for more specific unsupported operation errors

- **SAXReaderNotAvailable (L121-127)**: Driver/module availability errors
  - Extends SAXNotSupportedException
  - Raised during import failures or when external programs unavailable

**Key Patterns**:
- Exception chaining: nested exceptions preserved through inheritance
- Location caching: SAXParseException captures locator state immediately to handle object lifecycle issues
- Defensive programming: custom `__getitem__` prevents confusing error messages

**Dependencies**: Relies on locator objects with `getSystemId()`, `getColumnNumber()`, `getLineNumber()`, and `getPublicId()` methods for location tracking.