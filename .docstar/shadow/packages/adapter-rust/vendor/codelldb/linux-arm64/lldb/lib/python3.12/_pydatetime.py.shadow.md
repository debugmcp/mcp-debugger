# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/_pydatetime.py
@source-hash: 832de4317516c3a2
@generated: 2026-02-09T18:08:43Z

## Python datetime module implementation

This is a comprehensive pure Python implementation of datetime types for concrete date/time handling, serving as fallback when C extensions aren't available. The module provides complete date/time arithmetic and formatting capabilities.

### Core Constants and Limits
- **MINYEAR/MAXYEAR** (L26-27): Valid year range 1-9999
- **_MAXORDINAL** (L28): Maximum ordinal date value (3652059)
- **Calendar data** (L40-47): Month lengths and cumulative day counts for Gregorian calendar

### Utility Functions
- **Gregorian calendar functions** (L49-156): Core date arithmetic
  - `_is_leap(year)` (L49): Leap year detection
  - `_ymd2ord(year, month, day)` (L70): Convert date to ordinal number
  - `_ord2ymd(n)` (L95): Convert ordinal to year/month/day with complex 400-year cycle handling
- **ISO format parsing** (L275-466): Complete ISO 8601 date/time string parsing
  - `_parse_isoformat_date(dtstr)` (L335): Handles YYYY-MM-DD and week formats
  - `_parse_isoformat_time(tstr)` (L422): Parses HH:MM:SS with timezone
- **Formatting utilities** (L168-272): String formatting with timezone awareness

### Main Classes

#### timedelta (L583-904)
Duration type representing difference between datetime objects. Supports arithmetic operations, comparisons, and various time units (days, seconds, microseconds, etc.).
- Constructor normalizes all inputs to internal (days, seconds, microseconds) representation
- Implements full operator support: +, -, *, /, //, %, divmod, comparison
- Properties: `days`, `seconds`, `microseconds` (L738-751)
- `total_seconds()` method (L732) for decimal seconds conversion

#### date (L906-1232)
Concrete date type with year, month, day components.
- Constructors: `__new__`, `fromtimestamp`, `today`, `fromordinal`, `fromisoformat`, `fromisocalendar`
- Core methods: `timetuple`, `toordinal`, `weekday`, `isoweekday`, `isocalendar`
- String methods: `isoformat`, `strftime`, `ctime`, `__str__`
- Arithmetic: supports addition/subtraction with timedelta objects
- ISO calendar support via `isocalendar()` (L1186) returning named tuple

#### tzinfo (L1234-1293)
Abstract base class for timezone information. Subclasses must implement:
- `tzname(dt)`: timezone name string
- `utcoffset(dt)`: offset from UTC as timedelta
- `dst(dt)`: DST offset as timedelta
- `fromutc(dt)` (L1257): Convert UTC datetime to local time with complex DST handling

#### time (L1326-1676)
Time-of-day with optional timezone support.
- Components: hour, minute, second, microsecond, tzinfo, fold
- Timezone-aware comparison logic in `_cmp()` (L1454)
- ISO format support via `isoformat()` and `fromisoformat()`
- Hash computation handles timezone normalization

#### datetime (L1679-2311)
Combined date and time, inheriting from date class.
- Comprehensive timestamp conversion with `_fromtimestamp()` (L1753) including fold detection
- Timezone conversion via `astimezone()` (L2001) with local timezone detection
- Arithmetic operations with timedelta objects
- Complex comparison logic handling naive vs aware datetimes in `_cmp()` (L2173)
- Pickle support with protocol-aware serialization

#### timezone (L2326-2448)
Concrete tzinfo implementation for fixed UTC offsets.
- Singleton UTC instance: `timezone.utc` (L2442)
- Automatic name generation from offset via `_name_from_offset()` (L2422)
- Validation: offsets must be strictly between -24h and +24h

### Key Architectural Patterns
- **Immutable value objects**: All datetime types are immutable with __slots__ optimization
- **Proleptic Gregorian calendar**: Extends current calendar rules indefinitely in both directions
- **Ordinal day system**: Internal representation using day numbers since January 1, Year 1
- **Timezone-aware vs naive**: Explicit handling of timezone presence/absence throughout
- **ISO 8601 compliance**: Complete support for ISO date/time format parsing/generation
- **Fold handling**: Disambiguation of repeated times during DST transitions

### Critical Invariants
- Year range strictly enforced: 1 ≤ year ≤ 9999
- Month range: 1 ≤ month ≤ 12
- Day validation based on month and leap year status  
- Timezone offset limits: -timedelta(hours=24) < offset < timedelta(hours=24)
- Ordinal dates: 1 ≤ ordinal ≤ 3652059

The implementation includes extensive comments explaining complex algorithms, particularly the timezone conversion logic (L2451-2645) which handles DST transitions and edge cases.