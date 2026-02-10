# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/urllib/response.py
@source-hash: 7e6c3b6d7a95f0d7
@generated: 2026-02-09T18:12:21Z

**urllib.response.py** - Response wrapper classes for urllib HTTP operations

**Primary Purpose:**
Provides file-like wrapper classes that enhance basic file objects with HTTP-specific functionality like headers, URLs, status codes, and cleanup hooks. All classes inherit from `tempfile._TemporaryFileWrapper` for proper resource management.

**Core Classes:**

- **`addbase` (L14-35)**: Base wrapper class providing file-like interface with context management
  - Inherits from `tempfile._TemporaryFileWrapper` for garbage collection
  - `__init__(fp)` (L19-22): Wraps file object, maintains backward-compatible `.fp` reference
  - `__enter__/__exit__` (L28-34): Context manager support with closed file validation

- **`addclosehook` (L37-55)**: Extends addbase with custom cleanup callbacks
  - `__init__(fp, closehook, *hookargs)` (L40-43): Stores cleanup function and arguments
  - `close()` (L45-54): Executes hook before calling parent close, ensures cleanup even on exceptions

- **`addinfo` (L57-66)**: Adds HTTP header access to file wrapper
  - `__init__(fp, headers)` (L60-62): Stores headers object
  - `info()` (L64-65): Returns headers (typically email.message.Message-like object)

- **`addinfourl` (L68-84)**: Full HTTP response wrapper with headers, URL, and status code
  - `__init__(fp, headers, url, code=None)` (L71-74): Complete HTTP response metadata
  - `geturl()` (L83-84): Returns original request URL
  - `getcode()` (L80-81): Returns HTTP status code
  - `status` property (L76-78): Alternative access to status code

**Key Dependencies:**
- `tempfile`: Base functionality for file wrapper behavior
- Standard file-like interface expected by urllib consumers

**Architectural Patterns:**
- Decorator pattern: Each class adds functionality while maintaining file interface
- Progressive enhancement: Base → hooks → info → full URL response
- Context manager protocol for proper resource cleanup

**Critical Invariants:**
- All classes maintain `.fp` reference for API compatibility
- Context managers validate file state before operations
- Close hooks execute before parent cleanup to ensure proper resource management