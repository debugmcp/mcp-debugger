# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/locale.py
@source-hash: 3988c5419552d5b9
@generated: 2026-02-09T18:08:59Z

## Purpose
Python 3.12 locale support module providing comprehensive internationalization and localization capabilities. Offers low-level C library locale API access, high-level number formatting, and extensive locale aliasing engine for cross-platform locale name normalization.

## Architecture
The module uses a **fallback strategy**: attempts to import native `_locale` module (L47), falling back to pure Python emulation (L49-94) with 'C' locale defaults when unavailable. Implements **decorator pattern** with `localeconv()` override mechanism (L108-113) for testing purposes.

## Core Components

### Locale Management
- `setlocale(category, locale=None)` (L600-615): Enhanced wrapper around C library setlocale, supports string/tuple locale specifications with automatic normalization
- `getlocale(category=LC_CTYPE)` (L582-598): Returns current locale as (language, encoding) tuple
- `resetlocale(category=LC_ALL)` (L617-635): **DEPRECATED** - resets to system default locale

### Number Formatting Engine
- `format_string(f, val, grouping=False, monetary=False)` (L213-248): Locale-aware string formatting using regex pattern matching (L180-181)
- `currency(val, symbol=True, grouping=False, international=False)` (L250-295): Complex currency formatting with position-sensitive sign placement
- `_group(s, monetary=False)` (L138-166): Core grouping algorithm using `_grouping_intervals()` generator (L122-135)
- `_localize(formatted, grouping=False, monetary=False)` (L193-211): Applies locale-specific decimal/thousand separators

### Parsing/Conversion Functions
- `atof(string, func=float)` (L321-323): String-to-float with locale-aware decimal parsing
- `atoi(string)` (L325-327): String-to-integer conversion
- `delocalize(string)` (L301-315): Strips locale formatting for numeric parsing
- `str(val)` (L297-299): Float-to-string with locale formatting

### Locale Name Resolution Engine
- `normalize(localename)` (L381-462): **Multi-stage lookup algorithm** with fallback hierarchy:
  1. Full name with encoding/modifier
  2. Name without modifier  
  3. Name without encoding
  4. Base language name only
- `_parse_localename(localename)` (L464-496): Extracts (language, encoding) from locale string
- `_build_localename(localetuple)` (L498-517): Constructs locale string from tuple

### Encoding Detection
- `getencoding()` (L641-650): Platform-specific encoding detection with Android special case (L642-645)
- `getpreferredencoding(do_setlocale=True)` (L655-690): **CONDITIONALLY COMPILED** based on CODESET availability, includes UTF-8 mode detection

### Legacy/Deprecated Functions
- `getdefaultlocale(envvars=...)` (L519-549): **DEPRECATED in Python 3.15** - environment variable parsing for default locale
- `_getdefaultlocale(envvars=...)` (L552-579): Internal implementation with Windows language ID mapping

## Data Tables
- `locale_alias` (L889-1478): **588 entries** mapping common locale names to canonical forms
- `locale_encoding_alias` (L708-760): **49 entries** mapping Python codec names to C library encodings  
- `windows_locale` (L1494-1705): **211 entries** mapping Windows LCIDs to locale strings

## Constants
Defines standard locale categories (LC_ALL, LC_CTYPE, LC_COLLATE, etc.) either from `_locale` module or fallback values (L53-60).

## Test/Debug Functions
- `_test()` (L329-336): Basic formatting demonstration
- `_print_locale()` (L707-761): Comprehensive locale environment analysis
- Main block (L772-779): Interactive testing when run as script

## Key Patterns
- **Graceful degradation**: Native C library preferred, pure Python fallback
- **Extensive aliasing**: Handles platform/distribution locale name variations
- **Regex-based formatting**: Uses compiled pattern for format string parsing
- **Generator-based grouping**: Memory-efficient number segmentation