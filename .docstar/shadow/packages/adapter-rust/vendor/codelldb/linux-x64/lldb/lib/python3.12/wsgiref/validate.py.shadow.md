# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/wsgiref/validate.py
@source-hash: 4132f87dcf11a332
@generated: 2026-02-09T18:06:17Z

## Purpose
WSGI compliance validation middleware that wraps applications to enforce WSGI specification requirements. Performs comprehensive runtime validation of WSGI applications, servers, and their interactions without modifying request/response data.

## Core Components

**validator(application) (L136-189)** - Main middleware factory that returns a lint_app wrapper function. Creates validation wrappers for all WSGI components and validates application call signatures.

**Wrapper Classes for WSGI Objects:**
- **InputWrapper (L191-221)** - Validates wsgi.input stream operations, ensuring proper argument counts and return types (bytes)
- **ErrorWrapper (L223-240)** - Validates wsgi.errors stream operations, ensuring string inputs to write methods
- **WriteWrapper (L242-249)** - Validates write callable from start_response, ensuring bytes input
- **IteratorWrapper (L260-293)** - Validates response iterator, checks bytes output and proper closure
- **PartialIteratorWrapper (L251-258)** - Helper for iterator validation chain

## Validation Functions

**Environment Validation (L295-358):**
- check_environ() - Validates WSGI environ dict structure, required keys, types, and CGI variables
- check_input()/check_errors() (L360-370) - Validates stream object interfaces

**Response Validation (L372-438):**
- check_status() - Validates HTTP status format (3-digit code + space + message)
- check_headers() - Validates header list structure, names, and values using regex patterns
- check_content_type() - Validates Content-Type presence/absence based on status codes
- check_exc_info() - Validates exception info tuple format
- check_iterator() - Prevents string/bytes iterators (performance anti-pattern)

## Key Patterns

**Validation Strategy:** Uses assert_() helper (L126-128) for consistent AssertionError raising with descriptive messages.

**Regex Patterns (L118-119):**
- header_re: Validates header name format (alphanumeric with hyphens/underscores)
- bad_header_value_re: Detects control characters in header values

**Warning System:** Uses custom WSGIWarning class (L121-124) for non-fatal spec violations (missing QUERY_STRING, unknown REQUEST_METHOD).

## Critical Invariants

- Applications must return iterators yielding bytes, never strings
- start_response must be called before iteration begins
- Iterator .close() must be called (warns to stderr if garbage collected unclosed)
- HTTP headers cannot contain newlines, colons, or control characters
- Content-Type required for responses with message bodies (except 204/304)
- SCRIPT_NAME/PATH_INFO must start with '/' if present
- wsgi.input/errors streams have restricted method access (no .close())

## Dependencies
Standard library: re, sys, warnings
Uses walrus operator (:=) requiring Python 3.8+