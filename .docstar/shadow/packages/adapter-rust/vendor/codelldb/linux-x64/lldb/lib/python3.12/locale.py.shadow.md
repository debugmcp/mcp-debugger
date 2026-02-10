# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/locale.py
@source-hash: 3988c5419552d5b9
@generated: 2026-02-09T18:09:52Z

## Purpose

Python's locale support module providing low-level access to C library locale APIs, high-level number formatting, and locale aliasing engine. Handles locale-aware string operations, number formatting with localization, and mapping of locale names to standard formats.

## Key Components

### Core Locale Functions
- `setlocale(category, locale=None)` (L600-615): Sets system locale for given category, with locale aliasing support
- `getlocale(category=LC_CTYPE)` (L582-598): Returns current locale as (language, encoding) tuple
- `resetlocale(category=LC_ALL)` (L617-635): Resets locale to default (deprecated)
- `localeconv()` (L108-113): Returns locale-specific formatting parameters with override support

### Number Formatting & Localization
- `format_string(f, val, grouping=False, monetary=False)` (L213-248): Locale-aware string formatting using % syntax
- `currency(val, symbol=True, grouping=False, international=False)` (L250-295): Formats currency values per locale
- `str(val)` (L297-299): Converts float to locale-aware string
- `_localize(formatted, grouping=False, monetary=False)` (L192-211): Core localization engine
- `_group(s, monetary=False)` (L138-166): Applies locale-specific digit grouping

### String Conversion Functions  
- `atof(string, func=float)` (L321-323): Parses locale-formatted float
- `atoi(string)` (L325-327): Parses locale-formatted integer
- `delocalize(string)` (L301-315): Converts locale string to normalized format
- `localize(string, grouping=False, monetary=False)` (L317-319): Applies locale formatting

### Locale Name Processing
- `normalize(localename)` (L381-462): Normalizes locale codes using alias lookup with fallback strategy
- `_parse_localename(localename)` (L464-496): Parses locale into (language, encoding) components
- `_build_localename(localetuple)` (L498-517): Constructs locale string from tuple
- `getdefaultlocale(envvars=(...))` (L519-549): Determines default locale from environment (deprecated)

### Fallback Implementation
- Fallback locale emulation (L52-94) when `_locale` module unavailable
- `_strcoll(a,b)` (L33-37), `_strxfrm(s)` (L39-43): Backup string comparison functions

## Key Data Structures

### Locale Mappings
- `locale_alias` (L889-1478): Comprehensive locale name aliases mapping (~590 entries)
- `locale_encoding_alias` (L708-760): Encoding name normalization mappings  
- `windows_locale` (L1494-1705): Windows language ID to locale mappings (~210 entries)

### Internal State
- `_override_localeconv` (L106): Testing override dictionary for localeconv
- `_percent_re` (L180-181): Regex for parsing % format specifiers
- `_setlocale` (L345): Reference to low-level setlocale function

## Architecture Patterns

### Graceful Degradation
Module provides fallback implementations when system locale support unavailable, ensuring basic functionality on all platforms.

### Caching & Override
- `localeconv()` decorated with override support for testing
- Extensive pre-computed alias tables for performance

### Multi-stage Lookup
`normalize()` implements 4-stage fallback strategy:
1. Full name with encoding/modifier
2. Without modifier  
3. Without encoding
4. Base language only

## Dependencies
- `_locale`: System locale interface (optional)
- `encodings`: Character encoding support
- `re`, `functools`: Standard utilities

## Critical Invariants
- Locale strings use dot notation: "language.encoding"  
- Grouping intervals terminate with CHAR_MAX (127)
- Currency formatting requires valid frac_digits (not 127)
- All locale operations are stateful and affect global process locale