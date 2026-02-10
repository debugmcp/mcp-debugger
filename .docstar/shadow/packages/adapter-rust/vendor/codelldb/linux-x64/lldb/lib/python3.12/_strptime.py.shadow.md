# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/_strptime.py
@source-hash: 302a4b9cf8fa7511
@generated: 2026-02-09T18:09:32Z

**Primary Purpose**: Locale-aware string-to-time parsing implementation providing platform-agnostic strptime functionality. Core module for parsing time strings using format directives, handling locale-specific time representations, timezone information, and various calendar systems.

**Architecture Pattern**: Two-tier caching system with thread-safe locale detection and regex compilation caching for performance optimization.

## Key Classes

**LocaleTime (L30-167)**: Locale-aware time information container
- Discovers and caches locale-specific time formatting from system locale
- Attributes: f_weekday/a_weekday (full/abbreviated weekdays), f_month/a_month (months), am_pm, timezone sets
- Thread-safety: Validates locale consistency during initialization (L75-78)
- Timezone handling: Uses time.tzname with daylight saving detection (L152-167)

**TimeRE (L170-263)**: Format directive to regex converter (inherits dict)
- Maps strptime directives (%Y, %m, %d, etc.) to named regex patterns
- Key methods:
  - `__seqToRE()` (L219-236): Converts locale lists to regex alternatives (longest-first sorting)
  - `pattern()` (L238-259): Transforms format strings to regex patterns with proper escaping
  - `compile()` (L261-263): Returns compiled regex with case-insensitive matching

## Core Functions

**_strptime() (L293-543)**: Primary parsing engine
- Returns (time_struct_tuple, microseconds, gmtoff_microseconds)
- Thread-safe caching with global lock (_cache_lock L265)
- Comprehensive directive processing: handles ISO weeks, julian days, timezone offsets
- Error handling: Invalid format detection, unconverted data detection
- Special cases: Leap year handling (L490-497), AM/PM conversion (L380-395)

**_strptime_time() (L545-549)**: time.struct_time wrapper
**_strptime_datetime() (L551-565)**: datetime object constructor with timezone support

## Global State & Caching

- `_TimeRE_cache` (L268): Global TimeRE instance with locale info
- `_regex_cache` (L270): Compiled regex cache (max 5 entries)
- `_cache_lock` (L265): Thread synchronization for cache access
- Cache invalidation triggers: locale change, timezone change (L306-311)

## Dependencies

- **calendar**: Weekday/month name lookup
- **time**: System time formatting and timezone info  
- **locale**: Locale detection and formatting
- **datetime**: Date arithmetic and timezone objects
- **re**: Regex compilation and matching
- **_thread**: Lock allocation for thread safety

## Critical Invariants

- Locale consistency during LocaleTime initialization
- Thread-safe access to global caches
- Proper handling of ambiguous timezone names
- ISO week compatibility restrictions (L471-488)
- Julian day calculation consistency

## Notable Implementation Details

- Magic date (1999,3,17,22,44,55,2,76,0) used for format string analysis (L115)
- Leap year fix for Feb 29 without year specification (L490-497)
- Timezone offset parsing supports fractional seconds (L430-452)
- Week numbering: %U (Sunday start) vs %W (Monday start) detection (L139-147)