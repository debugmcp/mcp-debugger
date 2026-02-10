# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/email/utils.py
@source-hash: 65d259aded3b7d29
@generated: 2026-02-09T18:10:45Z

## Email Utilities Module

This module provides RFC-compliant email processing utilities as part of Python's standard library email package. Located in an LLDB vendor directory, this is a copy of Python's email.utils module.

**Core Purpose:** Provides functions for parsing, formatting, and encoding email addresses, dates, and RFC 2231 parameters according to email standards.

### Key Functions

**Address Processing:**
- `parseaddr(addr, *, strict=True)` (L324-351): Parses email addresses into (realname, email) tuples with strict validation by default
- `getaddresses(fieldvalues, *, strict=True)` (L152-193): Parses multiple address fields, returns list of (realname, email) tuples
- `formataddr(pair, charset='utf-8')` (L77-107): Formats (realname, email) tuple into RFC 2822 compliant string

**Date/Time Handling:**
- `formatdate(timeval=None, localtime=False, usegmt=False)` (L242-269): Formats timestamps as RFC 2822 date strings
- `format_datetime(dt, usegmt=False)` (L271-287): Converts datetime objects to RFC 2822 format
- `parsedate_to_datetime(data)` (L313-321): Parses date strings to datetime objects
- `localtime(dt=None, isdst=None)` (L467-486): Returns timezone-aware local datetime

**RFC 2231 Parameter Encoding:**
- `encode_rfc2231(s, charset=None, language=None)` (L375-387): Encodes parameters per RFC 2231
- `decode_rfc2231(s)` (L367-372): Decodes RFC 2231 encoded parameters
- `decode_params(params)` (L393-439): Processes parameter lists with continuation support
- `collapse_rfc2231_value(value, errors='replace', fallback_charset='us-ascii')` (L441-458): Collapses multi-part RFC 2231 values

**Utilities:**
- `make_msgid(idstring=None, domain=None)` (L290-310): Generates unique RFC 2822 Message-ID headers
- `unquote(str)` (L355-362): Removes quotes and escaping from strings

### Key Implementation Details

**Strict Parsing (L150, L158):** Modern addition supporting `strict=True` parameter for security-conscious parsing that rejects malformed input.

**Validation Pipeline:** 
- `_pre_parse_validation()` (L211-218): Validates parentheses balance
- `_post_parse_validation()` (L221-230): Checks for domain literal parsing failures
- `_check_parenthesis()` (L196-208): Ensures balanced parentheses in addresses

**String Processing:**
- `_has_surrogates()` (L52-61): Detects surrogate-escaped binary data
- `_sanitize()` (L65-71): Converts surrogate escapes to Unicode replacement chars
- `_strip_quoted_realnames()` (L125-147): Removes quoted sections for parsing
- `_iter_escaped_chars()` (L110-122): Iterator handling escaped characters

**Constants (L42-49):** Standard separators and regex patterns for email parsing.

### Dependencies
- `email._parseaddr`: Core parsing functionality including `AddressList`, `parsedate` functions
- `email.charset.Charset`: Character set handling for non-ASCII names
- Standard library: `os`, `re`, `time`, `random`, `socket`, `datetime`, `urllib.parse`

### Architecture Notes
- Extensive use of strict/non-strict parsing modes for security
- RFC 2231 parameter continuation handling with proper encoding detection
- Timezone-aware datetime processing with UTC/local time conversion
- Backward compatibility maintained while adding modern security features