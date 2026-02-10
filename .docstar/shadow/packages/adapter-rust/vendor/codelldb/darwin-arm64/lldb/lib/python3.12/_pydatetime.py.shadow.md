# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/_pydatetime.py
@source-hash: 832de4317516c3a2
@generated: 2026-02-09T18:07:17Z

## Purpose
Pure Python implementation of datetime types. This is the fallback implementation used when the C extension is unavailable, providing concrete date/time classes and timezone support.

## Key Constants & Globals
- `MINYEAR = 1`, `MAXYEAR = 9999` (L26-27): Valid year range
- `_MAXORDINAL = 3652059` (L28): Maximum ordinal date value
- `_DAYS_IN_MONTH`, `_DAYS_BEFORE_MONTH` (L40-47): Calendar lookup tables
- `_DI400Y`, `_DI100Y`, `_DI4Y` (L79-81): Leap year cycle constants
- `UTC` (L442): Global UTC timezone instance

## Core Date/Time Utilities
- `_is_leap(year)` (L49-51): Leap year detection
- `_ymd2ord(year, month, day)` (L70-77): Convert Y/M/D to ordinal
- `_ord2ymd(n)` (L95-155): Convert ordinal to Y/M/D using 400-year cycle algorithm
- `_isoweek_to_gregorian(year, week, day)` (L469-498): ISO week conversion
- `_check_date_fields()`, `_check_time_fields()` (L525-553): Input validation

## Formatting & Parsing
- `_format_time()` (L168-187): Time string formatting with timespec support
- `_format_offset()` (L189-205): UTC offset formatting
- `_wrap_strftime()` (L208-272): Enhanced strftime with %f, %z, %Z support
- `_parse_isoformat_date()` (L335-368): ISO date parsing including week dates
- `_parse_isoformat_time()` (L422-466): ISO time parsing with timezone
- `_find_isoformat_datetime_separator()` (L278-333): Complex separator detection

## Primary Classes

### timedelta (L583-904)
Time duration representation with days/seconds/microseconds storage.
- `__new__()` (L605-704): Complex normalization of all time units
- Arithmetic operations: `__add__`, `__sub__`, `__mul__`, `__truediv__` (L753-832)
- Comparison methods with `_cmp()` helper (L849-881)
- `total_seconds()` (L732-735): Convert to float seconds

### date (L906-1231)
Concrete date implementation.
- `__new__()` (L936-966): Constructor with pickle support detection
- Factory methods: `fromtimestamp()`, `today()`, `fromordinal()`, `fromisoformat()`, `fromisocalendar()` (L970-1013)
- `isocalendar()` (L1186-1212): Returns `IsoCalendarDate` namedtuple
- Date arithmetic with timedelta (L1154-1173)
- `weekday()`, `isoweekday()` (L1175-1184): Day-of-week calculations

### tzinfo (L1234-1293)
Abstract timezone base class defining interface:
- `tzname()`, `utcoffset()`, `dst()` (L1241-1255): Must be overridden
- `fromutc()` (L1257-1282): Complex UTC conversion algorithm

### time (L1326-1676)
Time-of-day with optional timezone.
- `__new__()` (L1351-1388): Constructor with pickle support and fold parameter
- Comparison with timezone-aware logic in `_cmp()` (L1454-1480)
- `fromisoformat()` (L1548-1562): ISO time string parsing
- Timezone methods: `utcoffset()`, `tzname()`, `dst()` (L1584-1619)

### datetime (L1679-2311)
Combined date and time, inheriting from date.
- `__new__()` (L1687-1720): Combines date and time validation
- `_fromtimestamp()` (L1753-1794): Internal timestamp conversion with fold detection
- Factory methods: `fromtimestamp()`, `now()`, `combine()`, `fromisoformat()` (L1796-1879)
- `_mktime()` (L1894-1926): Complex local time conversion algorithm
- `astimezone()` (L2001-2024): Timezone conversion
- Enhanced comparison logic handling naive/aware mixing (L2173-2208)

### timezone (L2326-2448)
Concrete timezone implementation with fixed UTC offset.
- `__new__()` (L2331-2344): Validates offset bounds, returns UTC singleton for zero
- `_name_from_offset()` (L2422-2440): Generates standard timezone names
- UTC singleton pattern with `timezone.utc` (L2442)

## Architecture Notes
- Uses 400-year cycle algorithm for efficient date calculations
- Extensive pickle support throughout all classes
- Complex timezone-aware comparison logic handling edge cases
- Fold parameter support for handling DST transitions
- ISO format parsing with comprehensive edge case handling
- Proleptic Gregorian calendar extended indefinitely in both directions

## Dependencies
- `time` module for system time functions
- `math` module for floating point operations
- `sys` for platform detection
- `operator.index` for integer conversion