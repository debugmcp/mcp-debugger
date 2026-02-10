# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/locale.py
@source-hash: 3988c5419552d5b9
@generated: 2026-02-09T18:13:36Z

## Purpose
Python locale support module providing low-level C library locale API access, high-level number formatting, and locale aliasing engine. Contains locale name normalization, number/currency formatting, and extensive locale alias mappings for cross-platform compatibility.

## Core Architecture

### Fallback Implementation Strategy (L45-100)
- Try importing `_locale` module for native C library support
- On ImportError, provides pure Python emulation with basic 'C' locale support
- Defines locale constants (LC_ALL, LC_CTYPE, etc.) and Error exception
- Implements fallback `localeconv()`, `setlocale()`, `strcoll()`, `strxfrm()` functions

### Locale Convention Override System (L102-114)  
- Wraps native `localeconv()` with `_override_localeconv` dict for testing
- `localeconv()` decorator allows runtime override of locale formatting parameters

## Key Functions

### Number Formatting APIs (L116-327)
- `_grouping_intervals()` (L122): Iterator for locale-specific digit grouping
- `_group()` (L138): Applies thousands separators based on locale grouping rules
- `_strip_padding()` (L169): Removes excess whitespace from formatted numbers
- `_format()` (L183): Core formatting function with locale-aware number conversion
- `format_string()` (L213): High-level string formatting with locale support
- `currency()` (L250): Currency formatting with symbol positioning and sign handling
- `str()` (L297): Locale-aware float-to-string conversion
- `delocalize()`/`localize()` (L301-319): Convert between locale and normalized formats
- `atof()`/`atoi()` (L321-327): Parse locale-formatted numbers to Python types

### Locale Name Processing (L338-462)
- `normalize()` (L381): Comprehensive locale name normalization with encoding/modifier support
- `_replace_encoding()` (L347): Encoding substitution in locale names
- `_append_modifier()` (L370): Handles special modifiers like @euro
- `_parse_localename()` (L464): Extracts language code and encoding from locale string
- `_build_localename()` (L498): Constructs locale string from (language, encoding) tuple

### System Integration Functions (L519-691)
- `getdefaultlocale()` (L519): **DEPRECATED** - Determines system default locale from environment
- `_getdefaultlocale()` (L552): Internal implementation checking platform-specific methods
- `getlocale()` (L582): Returns current locale setting for given category
- `setlocale()` (L600): Enhanced setlocale with aliasing support
- `resetlocale()` (L617): **DEPRECATED** - Resets to default locale
- `getencoding()` (L639-650): Platform-specific encoding detection
- `getpreferredencoding()` (L655-690): User's preferred encoding with UTF-8 mode support

## Database Components

### Encoding Alias Mapping (L708-765)
- `locale_encoding_alias` dict: Maps Python codec names to C library encoding names
- Handles non-standard encoding names and provides normalization
- Includes mappings for ISO8859, UTF-8, CP125x, KOI8-x encodings

### Comprehensive Locale Aliases (L889-1478)
- `locale_alias` dict: 580+ entries mapping common locale names to canonical forms
- Covers major world languages with regional variants
- Includes historical mappings and common misspellings
- Format: 'language[_territory][.encoding][@modifier]'

### Windows Locale Integration (L1494-1705)
- `windows_locale` dict: Maps Windows LCID values to POSIX locale strings
- Enables cross-platform locale identification
- Covers 200+ Windows language/region combinations

## Testing and Utilities
- `_test()` (L329): Number formatting demonstration
- `_print_locale()` (L707): Comprehensive locale settings diagnostic tool
- Module-level test execution support (L772-779)

## Dependencies
- Core: sys, re, functools, encodings, _collections_abc
- Platform-specific: _locale (when available)
- Runtime: os (for environment variable access)

## Key Constants
- LC_* categories for different locale aspects (numeric, time, etc.)
- CHAR_MAX (127) for grouping termination
- Regex pattern `_percent_re` for format string parsing