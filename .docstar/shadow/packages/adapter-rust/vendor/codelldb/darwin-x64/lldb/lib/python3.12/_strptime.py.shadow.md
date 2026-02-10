# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/_strptime.py
@source-hash: 302a4b9cf8fa7511
@generated: 2026-02-09T18:07:40Z

## Time String Parsing Module (_strptime.py)

**Primary Purpose**: Provides robust parsing of time strings according to format directives, implementing Python's strptime functionality with locale-aware pattern matching.

### Core Classes

**LocaleTime (L30-168)**: Manages locale-specific time formatting information
- Discovers and caches weekday/month names, AM/PM indicators, timezone data
- `__init__` (L49-78): Thread-safe initialization with locale consistency checks
- `__calc_weekday` (L80-86): Extracts weekday names from calendar module
- `__calc_month` (L88-93): Extracts month names from calendar module  
- `__calc_am_pm` (L95-105): Determines AM/PM representations using magic date
- `__calc_date_time` (L107-150): Creates format strings for %c, %x, %X directives
- `__calc_timezone` (L152-167): Handles timezone name extraction and daylight savings

**TimeRE (L170-263)**: Regex-based format directive processor, extends dict
- `__init__` (L173-217): Creates comprehensive regex patterns for all strptime directives
- `__seqToRE` (L219-236): Converts sequences to regex alternations (longest-first matching)
- `pattern` (L238-259): Transforms format strings into regex patterns
- `compile` (L261-263): Returns compiled regex objects with case-insensitive matching

### Key Functions

**_getlang (L26-28)**: Returns current locale language setting for LC_TIME

**_calc_julian_from_U_or_W (L272-290)**: Calculates Julian day from year, week number, and weekday
- Handles both %U (Sunday-start) and %W (Monday-start) week numbering
- Accounts for partial week 0 scenarios

**_strptime (L293-543)**: Core parsing engine
- Returns tuple: (time_struct_data, microseconds, gmtoff_microseconds)
- Thread-safe caching with locale change detection (L303-313)
- Comprehensive directive parsing (L351-467)
- ISO week/year validation and compatibility checks (L469-488)
- Julian day calculation and date reconstruction (L500-529)

**_strptime_time (L545-549)**: Wrapper returning standard time.struct_time

**_strptime_datetime (L551-565)**: Wrapper returning datetime objects with timezone support

### Global State & Caching

- `_cache_lock` (L265): Thread synchronization for cache access
- `_TimeRE_cache` (L268): Shared TimeRE instance for performance
- `_regex_cache` (L270): LRU-style regex compilation cache (max 5 entries)
- Cache invalidation triggers: locale changes, timezone changes

### Architecture Patterns

- **Thread Safety**: Comprehensive locking around shared caches and locale detection
- **Lazy Evaluation**: Regex compilation on-demand with caching
- **Graceful Degradation**: Handles missing locale information (empty strings, platform variations)
- **Magic Date Strategy**: Uses (1999,3,17,22,44,55,2,76,0) for consistent locale format extraction

### Critical Constraints

- Locale consistency enforced during LocaleTime initialization
- ISO week directives (%G, %V) require specific companion directives
- Julian day calculations handle year boundaries and leap years
- Timezone parsing supports various offset formats including fractional seconds