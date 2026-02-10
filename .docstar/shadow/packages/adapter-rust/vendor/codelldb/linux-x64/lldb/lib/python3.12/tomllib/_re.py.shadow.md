# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/tomllib/_re.py
@source-hash: 75b8e0e428594f6d
@generated: 2026-02-09T18:06:08Z

## Purpose
TOML parsing utility module providing regular expressions and conversion functions for parsing numbers, dates, times, and datetimes from TOML format strings. Part of the `tomllib` package for TOML 1.0.0 specification compliance.

## Key Components

### Regular Expressions (L19-49)
- **RE_NUMBER** (L19-37): Complex regex for parsing TOML numbers including hex (0x), binary (0b), octal (0o), decimal integers, and floats with optional fractional/exponent parts
- **RE_LOCALTIME** (L38): Regex for time format HH:MM:SS with optional microseconds
- **RE_DATETIME** (L39-49): Comprehensive regex for ISO 8601 datetime parsing including date, optional time, and timezone offset

### Conversion Functions
- **match_to_datetime** (L52-84): Converts RE_DATETIME matches to `datetime.datetime` or `datetime.date` objects, handles timezone parsing including Zulu time ('Z') and offset formats
- **match_to_localtime** (L98-101): Converts RE_LOCALTIME matches to `datetime.time` objects with microsecond precision
- **match_to_number** (L104-107): Converts RE_NUMBER matches to appropriate numeric types (int/float) using provided parse_float callable

### Utility Functions
- **cached_tz** (L87-95): LRU-cached timezone factory that creates `timezone` objects from hour/minute offset strings with sign

## Dependencies
- Standard library: `datetime`, `functools.lru_cache`, `re`, `typing`
- Internal: `._types.ParseFloat` type alias

## Architecture Notes
- Uses verbose regex patterns with extensive comments for maintainability
- Employs caching for timezone objects to avoid redundant creation
- Follows TOML specification for numeric literal formats (underscores, different bases)
- Handles microseconds by padding to 6 digits and truncating excess
- Supports both local datetime (no timezone) and timezone-aware datetime parsing