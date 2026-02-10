# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/wsgiref/validate.py
@source-hash: 4132f87dcf11a332
@generated: 2026-02-09T18:11:24Z

**Purpose**: WSGI compliance validation middleware that wraps applications to enforce strict adherence to the WSGI specification. Acts as a debugging/testing tool to catch WSGI violations at runtime.

**Core Architecture**: 
- Main entry point: `validator(application)` function (L136-189) returns a wrapped WSGI application
- Wrapper approach: Creates proxy objects around WSGI components to validate usage patterns
- Validation strategy: Uses assertions to immediately fail on spec violations, warnings for edge cases

**Key Validation Components**:

**Input/Output Wrappers**:
- `InputWrapper` (L191-221): Validates wsgi.input usage - enforces bytes return types, proper method signatures, prevents close() calls
- `ErrorWrapper` (L223-240): Validates wsgi.errors usage - enforces string inputs, prevents close() calls  
- `WriteWrapper` (L242-249): Validates start_response writer - enforces bytes input
- `IteratorWrapper` (L260-293): Validates response iterator - ensures bytes yielding, proper lifecycle, start_response timing

**Validation Functions**:
- `check_environ()` (L295-358): Comprehensive environ dictionary validation - required keys, type checking, CGI variable validation
- `check_status()` (L372-384): Status string format validation - 3-digit codes, proper formatting
- `check_headers()` (L386-409): Header list validation - tuple format, name/value constraints, forbidden headers
- `check_content_type()` (L411-425): Content-Type presence rules based on status codes
- `check_exc_info()` (L427-429): Exception info tuple validation
- `check_iterator()` (L432-437): Iterator type validation - prevents string/bytes iterators

**Validation Patterns**:
- Uses custom `assert_()` helper (L126-128) instead of built-in assert for consistent error handling
- `check_string_type()` (L130-134) utility for type validation
- Custom `WSGIWarning` class (L121-124) for specification edge cases
- Comprehensive regex patterns for header validation (L118-119)

**Critical Constraints**:
- Environ must be exact dict type, not subclass
- All CGI variables must be strings (non-unicode)
- Headers must be exact list of 2-tuples
- Response iterator must yield bytes, never strings
- wsgi.input/errors objects cannot be closed by application
- start_response must be called before iterator consumption begins

**Dependencies**: Standard library only (re, sys, warnings)