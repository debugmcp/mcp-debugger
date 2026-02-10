# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/tomllib/_re.py
@source-hash: 75b8e0e428594f6d
@generated: 2026-02-09T18:11:15Z

## Purpose and Responsibility
Regular expression utility module for TOML parsing that handles datetime, time, and number parsing from string matches. Part of the tomllib package for TOML format parsing.

## Key Components

### Regular Expression Patterns
- `_TIME_RE_STR` (L17): String pattern for time format HH:MM:SS with optional microseconds
- `RE_NUMBER` (L19-37): Compiled regex for parsing TOML numbers (hex, binary, octal, decimal, float with scientific notation)
- `RE_LOCALTIME` (L38): Compiled regex for local time parsing using `_TIME_RE_STR`
- `RE_DATETIME` (L39-49): Compiled regex for ISO 8601 datetime parsing with optional timezone offset

### Core Functions
- `match_to_datetime()` (L52-84): Converts `RE_DATETIME` regex matches to `datetime` or `date` objects. Handles timezone parsing including UTC ('Z') and offset formats (±HH:MM). Returns `date` if no time component present.
- `match_to_localtime()` (L98-101): Converts `RE_LOCALTIME` matches to `time` objects with microsecond precision
- `match_to_number()` (L104-107): Converts `RE_NUMBER` matches to appropriate numeric types (int or float via `parse_float` callback)

### Utility Functions
- `cached_tz()` (L87-95): LRU-cached factory for timezone objects from hour/minute offset strings. Uses `timedelta` for offset calculation.

## Dependencies
- Standard library: `datetime`, `functools.lru_cache`, `re`, `typing`
- Internal: `._types.ParseFloat` - callback type for float parsing

## Key Patterns
- Uses verbose regex patterns with comments for maintainability
- Leverages `lru_cache` for timezone object reuse to optimize memory
- Handles microsecond precision by left-padding with zeros to 6 digits
- Supports TOML number formats including underscores as separators
- Gracefully handles optional components (fractional seconds, timezone offsets)

## Critical Constraints
- Time validation relies on regex patterns - invalid times may raise `ValueError` in datetime constructors
- Microsecond precision limited to 6 digits (standard Python datetime limitation)
- Integer parsing uses base 0 to auto-detect hex/binary/octal prefixes