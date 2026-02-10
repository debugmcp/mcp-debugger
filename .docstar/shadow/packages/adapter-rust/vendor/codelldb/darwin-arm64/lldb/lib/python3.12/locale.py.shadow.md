# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/locale.py
@source-hash: 3988c5419552d5b9
@generated: 2026-02-09T18:07:21Z

## Core Purpose
Python's locale support module providing low-level access to C library locale APIs, high-level number formatting, and locale name aliasing. Enables locale-aware string comparison, number formatting, and currency display.

## Key Components

### Locale Constants and Emulation (L25-100)
- **LC_* constants**: Category constants for locale operations (LC_ALL, LC_CTYPE, LC_COLLATE, etc.)
- **Fallback implementation**: Pure Python locale emulation when _locale module unavailable (L49-100)
- **_strcoll/_strxfrm (L33-43)**: Basic locale-unaware string operations as fallbacks

### Core Locale Functions (L582-690)
- **getlocale (L582-598)**: Returns current locale setting as (language, encoding) tuple
- **setlocale (L600-615)**: Sets locale for given category, with aliasing support
- **resetlocale (L617-635)**: Resets to default locale (deprecated)
- **getencoding (L638-650)**: Returns current locale encoding, with fallback logic
- **getpreferredencoding (L655-690)**: Returns user's preferred encoding with UTF-8 mode handling

### Number Formatting Engine (L116-327)
- **format_string (L213-248)**: Locale-aware string formatting with grouping support
- **currency (L250-295)**: Formats currency according to locale conventions
- **_group (L138-166)**: Applies thousands separators based on locale grouping rules
- **_localize (L193-211)**: Converts formatted numbers to locale-specific representation
- **atof/atoi (L321-327)**: Parse locale-formatted numbers to Python types

### Locale Name Normalization (L381-579)
- **normalize (L381-462)**: Normalizes locale names to canonical form
- **_parse_localename (L464-496)**: Parses locale string into (language, encoding) components
- **_build_localename (L498-517)**: Constructs locale string from components
- **getdefaultlocale (L519-579)**: Determines default locale from environment (deprecated)

### Locale Data Tables (L708-1705)
- **locale_encoding_alias (L708-760)**: Maps encoding names to C library names
- **locale_alias (L889-1478)**: Comprehensive locale name aliases (X11-derived)
- **windows_locale (L1494-1705)**: Windows language identifier to locale mappings

### Utility Functions
- **localeconv override (L102-113)**: Wrapped locale convention function with test overrides
- **delocalize (L301-315)**: Converts locale-formatted numbers to standard format
- **str (L297-299)**: Locale-aware float to string conversion

## Architecture Patterns
- **Graceful fallback**: C module import with pure Python emulation
- **Aliasing engine**: Multi-stage locale name resolution
- **Format string parsing**: Regex-based percent formatting with locale awareness
- **Data-driven**: Large static tables for locale mappings

## Critical Dependencies
- **_locale module**: C extension for actual locale operations
- **encodings module**: Character encoding normalization
- **sys.flags**: UTF-8 mode and encoding warning detection
- **os.environ**: Environment variable locale detection

## Usage Context
Used by Python's standard library for locale-sensitive operations. Applications requiring internationalization use this for number formatting, currency display, and locale detection. The aliasing system handles cross-platform locale name variations.