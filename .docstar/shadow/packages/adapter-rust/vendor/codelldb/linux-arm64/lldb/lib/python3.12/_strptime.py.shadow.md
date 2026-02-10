# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/_strptime.py
@source-hash: 302a4b9cf8fa7511
@generated: 2026-02-09T18:08:38Z

## Purpose
Core Python strptime implementation providing locale-aware date/time string parsing functionality. Converts formatted time strings into structured time objects using regex pattern matching and locale-specific formatting rules.

## Key Classes

### LocaleTime (L30-168)
Thread-safe locale information container that discovers and caches locale-specific time formatting data:
- **Initialization (L49-78)**: Validates consistent locale state during setup with thread-safety checks
- **Weekday calculation (L80-86)**: Extracts abbreviated/full weekday names from calendar module
- **Month calculation (L88-93)**: Extracts abbreviated/full month names with dummy [0] entry
- **AM/PM calculation (L95-105)**: Uses magic date (1999,3,17) to derive locale AM/PM strings
- **Date/time format calculation (L107-150)**: Complex format string derivation using replacement pairs
- **Timezone calculation (L152-167)**: Builds timezone sets for DST/non-DST matching

### TimeRE (L170-263)
Regex-based format directive converter extending dict:
- **Initialization (L173-217)**: Pre-builds regex patterns for all strptime directives (%Y, %m, etc.)
- **__seqToRE (L219-236)**: Converts locale sequences to regex alternations, longest-first ordering
- **pattern (L238-259)**: Transforms format strings to regex patterns, escaping special chars
- **compile (L261-263)**: Returns compiled regex with case-insensitive matching

## Key Functions

### _strptime (L293-543)
Primary parsing function implementing full strptime logic:
- **Input validation (L298-301)**: Type checking for string arguments
- **Cache management (L303-330)**: Thread-safe regex cache with locale invalidation
- **Pattern matching (L331-337)**: Regex matching with comprehensive error handling
- **Field extraction (L339-467)**: Processes all directive groups (y, Y, G, m, B, b, d, H, I, M, S, f, A, a, w, u, j, U, W, V, z, Z)
- **ISO week handling (L471-488)**: Validates ISO year/week directive combinations
- **Julian day calculation (L500-529)**: Complex logic for week-based and ordinal date conversion
- **Leap year handling (L490-496, L535-539)**: Special case for Feb 29 without year

### _calc_julian_from_U_or_W (L272-290)
Calculates Julian day from year, week number, and day of week with support for both Sunday (%U) and Monday (%W) week starts.

### Helper Functions
- **_getlang (L26-28)**: Returns current locale LC_TIME setting
- **_strptime_time (L545-549)**: Wrapper returning time.struct_time
- **_strptime_datetime (L551-565)**: Wrapper returning datetime objects with timezone support

## Global State
- **_cache_lock (L265)**: Thread lock for cache synchronization
- **_TimeRE_cache (L268)**: Shared TimeRE instance with automatic locale invalidation
- **_regex_cache (L270)**: Compiled regex cache with size limit (_CACHE_MAX_SIZE = 5)

## Architecture Patterns
- **Locale awareness**: All parsing respects current system locale settings
- **Thread safety**: Comprehensive locking around shared caches and locale checks
- **Caching strategy**: Dual-level caching (TimeRE patterns + compiled regexes) with invalidation
- **Error handling**: Detailed ValueError messages for parsing failures and format errors
- **Timezone support**: Full timezone parsing including GMT offsets and named zones

## Dependencies
- **Standard library**: time, locale, calendar, re, datetime, _thread
- **Magic constants**: Uses date (1999,3,17) for consistent locale probing across functions