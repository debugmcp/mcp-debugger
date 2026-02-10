# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/email/errors.py
@source-hash: dbfb4bbfc85e9d55
@generated: 2026-02-09T18:10:38Z

## Primary Purpose
This module defines the complete exception and defect hierarchy for Python's email package, providing structured error handling for email parsing, validation, and processing operations.

## Exception Hierarchy

**Core Exceptions (L8-34):**
- `MessageError` (L8): Base exception class for all email package errors
- `MessageParseError` (L12): Base for parsing-related errors, inherits from MessageError
- `HeaderParseError` (L16): Specific to header parsing failures  
- `BoundaryError` (L20): When MIME boundary terminators cannot be found
- `MultipartConversionError` (L24): Multiple inheritance from MessageError + TypeError for multipart conversion failures
- `CharsetError` (L28): Invalid character encoding specifications
- `HeaderWriteError` (L32): Header serialization/writing failures

## Defect Classes for Error Recovery

**Base Defect Classes (L37-90):**
- `MessageDefect` (L37): Base class for recoverable parsing issues, inherits from ValueError
  - Constructor (L40-43): Accepts optional line number parameter for error location tracking
- `HeaderDefect` (L85): Specialized base class for header-specific defects

**Message Structure Defects (L45-82):**
- `NoBoundaryInMultipartDefect` (L45): Missing boundary parameter in multipart messages
- `StartBoundaryNotFoundDefect` (L48): Declared boundary never encountered
- `CloseBoundaryNotFoundDefect` (L51): Unmatched start boundary
- `FirstHeaderLineIsContinuationDefect` (L54): Malformed header start
- `MisplacedEnvelopeHeaderDefect` (L57): Unix-from header in wrong location
- `MissingHeaderBodySeparatorDefect` (L60): Missing header/body delimiter
- `MultipartInvariantViolationDefect` (L65): Multipart claim without subparts
- `InvalidMultipartContentTransferEncodingDefect` (L68): Invalid encoding on multipart container
- `UndecodableBytesDefect` (L71): Encoding/decoding failures
- Base64 defects (L74-81): Three classes for base64 validation issues

**Header-Specific Defects (L91-117):**
- `InvalidHeaderDefect` (L91): General header validation failures
- `HeaderMissingRequiredValue` (L94): Required header values absent
- `NonPrintableDefect` (L97): ASCII control character detection
  - Custom implementation (L100-106) with specialized string representation
- `ObsoleteHeaderDefect` (L108): RFC 5322 compliance violations
- `NonASCIILocalPartDefect` (L111): Unicode issues in email addresses
- `InvalidDateDefect` (L116): Date parsing/validation failures

## Key Design Patterns

**Inheritance Strategy:** Two-tier hierarchy with MessageError/MessageDefect as base classes, allowing distinction between fatal errors and recoverable defects.

**Error Context:** Several classes store additional context (line numbers, problematic characters) to aid debugging.

**Backward Compatibility:** Line 63 maintains alias `MalformedHeaderDefect` for legacy code.

**RFC Compliance:** Multiple defect classes specifically reference RFC 5322 standards, indicating strong standards adherence.