# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/_pydatetime.py
@source-hash: 832de4317516c3a2
@generated: 2026-02-09T18:13:04Z

## Primary Purpose
Python's core datetime module implementation providing concrete date/time types and utilities. This is the pure Python implementation used when the C extension is unavailable, containing the complete datetime API including date, time, datetime, timedelta, timezone, and tzinfo classes.

## Constants and Utilities (L1-581)
- `MINYEAR=1, MAXYEAR=9999` (L26-27): Valid year range for all datetime objects
- `_MAXORDINAL=3652059` (L28): Maximum ordinal day number (date.max.toordinal())
- Calendar constants: `_DAYS_IN_MONTH`, `_DAYS_BEFORE_MONTH` (L40-47) for Gregorian calendar calculations
- Helper functions for date arithmetic:
  - `_is_leap(year)` (L49-51): Leap year detection
  - `_days_before_year(year)` (L53-56): Days before January 1st of given year
  - `_ymd2ord(year, month, day)` (L70-77): Convert Y-M-D to ordinal day
  - `_ord2ymd(n)` (L95-155): Convert ordinal day to Y-M-D tuple

## ISO Format Parsing (L274-499)
- `_find_isoformat_datetime_separator(dtstr)` (L278-332): Locates T separator in ISO datetime strings
- `_parse_isoformat_date(dtstr)` (L335-368): Parses ISO date formats including week dates
- `_parse_hh_mm_ss_ff(tstr)` (L374-420): Parses time components with fractional seconds
- `_parse_isoformat_time(tstr)` (L422-466): Complete ISO time format parser with timezone
- `_isoweek_to_gregorian(year, week, day)` (L469-498): Converts ISO week date to Gregorian

## Core Classes

### timedelta (L583-904)
Represents duration between two datetime objects. Stores `(days, seconds, microseconds)` internally.
- `__new__()` (L605-704): Complex normalization from various time units to internal representation
- Arithmetic operations: `__add__`, `__sub__`, `__mul__`, `__truediv__`, `__floordiv__`, `__mod__` (L753-845)
- `total_seconds()` (L732-735): Converts to total seconds as float
- Comparison methods using `_cmp()` (L849-881)

### date (L906-1232)
Concrete date type with year, month, day components.
- `__new__()` (L936-966): Constructor with pickle support detection
- Class methods: `fromtimestamp()`, `today()`, `fromordinal()`, `fromisoformat()`, `fromisocalendar()` (L970-1013)
- `weekday()`, `isoweekday()`, `isocalendar()` (L1175-1212): Week-based calculations
- `replace()` (L1103-1111): Return new date with modified fields
- Arithmetic with timedelta objects (L1154-1173)

### tzinfo (L1234-1293)
Abstract base class for timezone information.
- Abstract methods: `tzname()`, `utcoffset()`, `dst()` (L1241-1255)
- `fromutc()` (L1257-1282): Complex algorithm for UTC to local time conversion

### time (L1326-1677)
Time with optional timezone information.
- `__new__()` (L1351-1388): Constructor with pickle support and field validation
- `fromisoformat()` (L1549-1562): Parse ISO time strings
- Timezone methods: `utcoffset()`, `tzname()`, `dst()` (L1584-1619)
- Complex comparison logic in `_cmp()` (L1454-1480) handling naive vs aware times
- Hash calculation considering timezone offset (L1482-1501)

### datetime (L1679-2311)
Combined date and time, inheriting from date.
- `__new__()` (L1687-1720): Constructor combining date and time validation
- Timestamp methods: `_fromtimestamp()` (L1753-1794), `fromtimestamp()`, `now()` (L1797-1822)
- `fromisoformat()` (L1851-1879): Parse complete ISO datetime strings
- `astimezone()` (L2001-2024): Convert between timezones with complex offset handling
- Complex comparison logic in `_cmp()` (L2173-2208) with fold-aware equality
- Arithmetic operations with timedelta (L2210-2253)

### timezone (L2326-2448)
Concrete tzinfo implementation with fixed UTC offset.
- `__new__()` (L2331-2344): Validates offset range and handles UTC singleton
- `_name_from_offset()` (L2423-2440): Generates standard timezone names like "UTC+05:00"
- UTC singleton: `timezone.utc` (L2442)

## Key Design Patterns
- **Pickle Support**: All classes detect pickle data in constructors via string length/content checks
- **Fold Handling**: Time classes support `fold` parameter for disambiguating repeated times during DST transitions  
- **Ordinal Day System**: Internal date calculations use ordinal days since January 1, year 1
- **Microsecond Precision**: All time representations maintain microsecond accuracy
- **Naive vs Aware**: Datetime objects can be timezone-naive (tzinfo=None) or timezone-aware

## Critical Invariants
- Year range strictly enforced: 1 ≤ year ≤ 9999
- All time components validated: 0 ≤ hour ≤ 23, 0 ≤ minute ≤ 59, etc.
- Timezone offsets must be strictly between -24 and +24 hours
- Ordinal day calculations assume proleptic Gregorian calendar