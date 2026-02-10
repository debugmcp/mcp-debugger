# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/http/cookies.py
@source-hash: c99f0a5bcb2592dc
@generated: 2026-02-09T18:11:13Z

## Purpose
HTTP cookie handling library implementing RFC 2109 cookie specification. Provides dictionary-like interface for creating, parsing, and serializing HTTP cookies with support for cookie attributes (path, domain, expires, secure, etc.).

## Key Classes

### `CookieError` (L145-146)
Custom exception class for cookie-related errors including invalid attributes and illegal keys.

### `Morsel` (L236-405)
Container for a single cookie key-value pair with attributes. Inherits from dict to store cookie attributes.
- **Core Properties**: `key`, `value`, `coded_value` (L280-289) - read-only access to cookie data
- **Reserved Attributes**: Maps lowercase to proper case for HTTP headers (L257-267): expires, path, domain, max-age, secure, httponly, version, samesite
- **Validation**: `__setitem__` (L291-295), `setdefault` (L297-301), `update` (L319-326) enforce reserved attribute names
- **Cookie Setting**: `set()` (L331-340) validates key legality and stores cookie data
- **Output Methods**: 
  - `output()` (L354-355) - HTTP header format
  - `js_output()` (L362-370) - JavaScript document.cookie format
  - `OutputString()` (L372-403) - core serialization logic with attribute handling

### `BaseCookie` (L442-580)
Base cookie container class inheriting from dict. Manages multiple Morsel objects.
- **Value Processing**: `value_decode()` (L445-452), `value_encode()` (L454-461) - hooks for custom value transformation
- **Cookie Management**: `__setitem__` (L473-480) creates Morsels, `__set()` (L467-471) internal setter
- **Output Methods**:
  - `output()` (L482-488) - HTTP Set-Cookie headers
  - `js_output()` (L499-505) - JavaScript format
- **Parsing**: `load()` (L507-519) accepts strings or dictionaries, `__parse_string()` (L521-579) implements full RFC-compliant cookie parsing with validation

### `SimpleCookie` (L582-594)
Concrete implementation extending BaseCookie with automatic string conversion and quote/unquote handling for cookie values.

## Core Functions

### String Processing
- `_quote()` (L174-184) - Escapes special characters using RFC 2068/2109 rules
- `_unquote()` (L195-213) - Reverses quoting, handles escaped sequences
- `_unquote_replace()` (L189-193) - Helper for octal escape sequence conversion
- `_getdate()` (L228-233) - Formats timestamps for cookie expiration in GMT

## Key Data Structures

### Character Sets & Translation
- `_LegalChars` (L162) - Characters allowed in unquoted cookie values
- `_UnescapedChars` (L163) - Characters that don't need escaping
- `_Translator` (L165-170) - Translation table for character escaping
- `_is_legal_key` (L172) - Regex validator for cookie names

### Cookie Parsing
- `_CookiePattern` (L419-436) - Complex regex for parsing cookie strings with support for quoted values, expires format, and attribute detection

## Dependencies
- `re` - Pattern matching for cookie parsing and validation
- `string` - Character constants for legal character sets  
- `types` - Generic type aliasing support
- `time` (imported in `_getdate`) - Timestamp operations

## Notable Patterns
- **Template Method**: BaseCookie defines structure, SimpleCookie provides concrete value handling
- **Dictionary Interface**: Both Morsel and BaseCookie extend dict for familiar usage
- **Validation Pipeline**: Multi-stage validation for cookie names, values, and attributes
- **RFC Compliance**: Implements RFC 2109 with browser compatibility extensions
- **Separation of Concerns**: Clear division between parsing, validation, storage, and serialization