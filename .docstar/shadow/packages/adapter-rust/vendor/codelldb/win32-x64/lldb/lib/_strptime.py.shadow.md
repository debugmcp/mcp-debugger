# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/_strptime.py
@source-hash: 302a4b9cf8fa7511
@generated: 2026-02-09T18:12:55Z

## Purpose
Reimplementation of Python's `strptime` functionality for parsing time strings. Core time parsing engine that converts formatted date/time strings into structured time data. Part of the LLDB debugger toolchain, providing locale-aware time parsing capabilities.

## Key Classes

### LocaleTime (L30-168)
Central locale-aware time configuration class. Discovers and caches locale-specific time formatting information at initialization.

**Key attributes:**
- `f_weekday`, `a_weekday` (L34-35): Full and abbreviated weekday names
- `f_month`, `a_month` (L36-39): Full and abbreviated month names (13-item lists with dummy [0])
- `am_pm` (L40): AM/PM representation
- `LC_date_time`, `LC_date`, `LC_time` (L41-43): Locale format strings
- `timezone` (L44-45): Daylight/non-daylight timezone sets

**Core methods:**
- `__init__()` (L49-78): Validates locale consistency during initialization, raises ValueError if locale/timezone changes mid-init
- `__calc_weekday()` (L80-86): Extracts weekday names from calendar module
- `__calc_month()` (L88-93): Extracts month names from calendar module
- `__calc_am_pm()` (L95-105): Uses magic date (1999,3,17) to extract AM/PM strings via strftime
- `__calc_date_time()` (L107-150): Complex format string generation using replacement pairs and magic date
- `__calc_timezone()` (L152-167): Builds timezone sets from time.tzname

### TimeRE (L170-263)
Dictionary-based regex generator for time format directives. Converts strptime format codes into named regex patterns.

**Key methods:**
- `__init__()` (L173-217): Builds comprehensive regex mapping for all strptime directives
- `__seqToRE()` (L219-236): Converts locale sequences to regex alternations, sorted longest-first
- `pattern()` (L238-259): Transforms format string to full regex, escaping special chars
- `compile()` (L261-263): Returns compiled case-insensitive regex

## Key Functions

### _strptime (L293-543)
Main parsing engine. Thread-safe with global cache management.

**Parameters:** 
- `data_string`: Input time string
- `format`: strptime format string (default: "%a %b %d %H:%M:%S %Y")

**Returns:** Tuple of (time_struct_tuple, microseconds, gmtoff_microseconds)

**Key logic:**
- Cache management (L303-330): Thread-locked global regex cache with locale invalidation
- Regex matching and validation (L331-337)
- Directive parsing loop (L351-467): Handles all strptime format codes
- ISO week/year validation (L471-488): Enforces ISO directive compatibility rules
- Julian day calculations (L500-529): Handles week-of-year to Julian conversions

### Helper Functions
- `_getlang()` (L26-28): Returns current locale
- `_calc_julian_from_U_or_W()` (L272-290): Converts week-of-year + weekday to Julian day
- `_strptime_time()` (L545-549): Wrapper returning time.struct_time
- `_strptime_datetime()` (L551-565): Wrapper returning datetime objects with timezone support

## Global State
- `_cache_lock` (L265): Thread synchronization for cache access
- `_TimeRE_cache` (L268): Global TimeRE instance with locale data
- `_regex_cache` (L270): LRU-style format string regex cache (max 5 entries)

## Dependencies
- `time`, `locale`, `calendar`: Core Python time/locale modules
- `re`: Regex compilation and matching
- `datetime`: Modern date/time objects with timezone support
- `_thread`: Thread-safe locking primitives

## Critical Patterns
- **Magic date usage**: Uses (1999,3,17,22,44,55,2,76,0) consistently for format extraction
- **Locale validation**: Checks for locale changes during initialization to prevent mixed locale data
- **Thread safety**: Global cache protected by threading lock
- **Regex optimization**: Longest-first matching prevents substring ambiguity
- **ISO compliance**: Strict validation of ISO week/year directive combinations