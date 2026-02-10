# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/_strptime.py
@source-hash: 302a4b9cf8fa7511
@generated: 2026-02-09T18:07:04Z

**Primary Purpose**: Python implementation of strptime functionality for parsing time strings into structured time data, providing locale-aware string-to-datetime conversion with regex-based pattern matching.

**Core Architecture**:
- **LocaleTime (L30-168)**: Caches locale-specific time formatting information (weekday names, month names, AM/PM, timezone data) with thread-safety validation during initialization
- **TimeRE (L170-264)**: Dictionary-based regex generator that converts strftime format directives into compiled regex patterns for matching
- **_strptime (L293-544)**: Main parsing engine that matches input strings against format patterns and extracts time components

**Key Functions**:
- **_getlang (L26-28)**: Returns current locale's LC_TIME setting
- **_calc_julian_from_U_or_W (L272-291)**: Calculates Julian day from year, week number, and day of week
- **_strptime_time (L545-549)**: Wrapper returning time.struct_time
- **_strptime_datetime (L551-565)**: Wrapper returning datetime instances with timezone support

**Critical Components**:
- **Regex pattern cache (_regex_cache, L270)**: Thread-safe LRU cache (max 5 entries) for compiled format patterns
- **Global TimeRE cache (_TimeRE_cache, L268)**: Shared locale-aware regex generator with invalidation on locale/timezone changes
- **Thread lock (_cache_lock, L265)**: Protects cache access and locale validation

**Format Directive Mappings (L184-213)**:
- Numeric patterns: d, f, H, I, G, j, m, M, S, U, w, u, V, Y, y, z
- Locale-dependent: A/a (weekdays), B/b (months), p (AM/PM), Z (timezone)
- Composite: c (datetime), x (date), X (time)

**Parsing Logic**:
1. Validates input types and acquires cache lock
2. Checks for locale/timezone changes and rebuilds cache if needed
3. Compiles format string to regex or retrieves from cache
4. Matches input string and extracts named groups
5. Processes each directive type with specific conversion logic
6. Handles ambiguous cases (ISO weeks, Julian days, leap years)
7. Returns structured time data with timezone information

**Error Handling**:
- ValueError for invalid formats, bad directives, unconverted data
- TypeError for non-string inputs
- Locale change detection during initialization

**Dependencies**: time, locale, calendar, re, datetime, _thread modules for core functionality and thread-safety.