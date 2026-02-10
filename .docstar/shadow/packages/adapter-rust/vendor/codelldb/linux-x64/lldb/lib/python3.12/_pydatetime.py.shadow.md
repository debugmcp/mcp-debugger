# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/_pydatetime.py
@source-hash: 832de4317516c3a2
@generated: 2026-02-09T18:10:36Z

## Primary Purpose
Pure Python implementation of the datetime module providing concrete date/time types and utilities. This is the fallback implementation when C extensions are unavailable, part of the LLDB Python environment in the Rust adapter toolchain.

## Constants and Limits
- `MINYEAR = 1, MAXYEAR = 9999` (L26-27): Valid year range
- `_MAXORDINAL = 3652059` (L28): Maximum ordinal date value
- `_DAYS_IN_MONTH` (L40): Days per month lookup table
- `_DAYS_BEFORE_MONTH` (L42-47): Cumulative days before each month

## Core Utility Functions
- `_cmp(x, y)` (L16-17): Three-way comparison helper
- `_get_class_module(self)` (L19-24): Module name normalization for repr
- `_is_leap(year)` (L49-51): Leap year detection
- `_ymd2ord(year, month, day)` (L70-77): Convert Y-M-D to ordinal day
- `_ord2ymd(n)` (L95-155): Convert ordinal day to Y-M-D (complex algorithm)

## Calendar Utilities  
- `_days_before_year(year)` (L53-56): Days before Jan 1 of year
- `_days_in_month(year, month)` (L58-63): Days in specific month/year
- `_isoweek1monday(year)` (L2314-2323): ISO week 1 Monday calculation
- `_isoweek_to_gregorian(year, week, day)` (L469-498): ISO week to Gregorian conversion

## Parsing and Formatting
- `_parse_isoformat_date(dtstr)` (L335-368): Parse ISO date strings
- `_parse_isoformat_time(tstr)` (L422-466): Parse ISO time strings
- `_parse_hh_mm_ss_ff(tstr)` (L374-420): Parse time components with fractions
- `_format_time(hh, mm, ss, us, timespec)` (L168-187): Format time with precision control
- `_format_offset(off, sep)` (L189-205): Format timezone offset
- `_wrap_strftime(object, format, timetuple)` (L208-272): Enhanced strftime with %z, %Z, %f support

## Validation Functions
- `_check_date_fields(year, month, day)` (L525-536): Validate and normalize date components
- `_check_time_fields(hour, minute, second, microsecond, fold)` (L538-553): Validate time components
- `_check_tzinfo_arg(tz)` (L555-557): Validate tzinfo parameter
- `_check_utc_offset(name, offset)` (L513-523): Validate UTC offset range

## Main Classes

### timedelta (L583-904)
Duration between two datetime objects. Stores `(days, seconds, microseconds)` in normalized form.
- Constructor with comprehensive unit conversion (L605-704)
- Arithmetic operations: add, subtract, multiply, divide (L753-845)
- Comparison operations (L849-877)
- `total_seconds()` method (L732-735)

### date (L906-1231)
Date without time information.
- Constructors: `__new__`, `fromtimestamp`, `today`, `fromordinal`, `fromisoformat`, `fromisocalendar`
- Properties: year, month, day (readonly)
- Methods: `timetuple`, `toordinal`, `weekday`, `isoweekday`, `isocalendar`, `isoformat`, `strftime`, `ctime`
- Arithmetic with timedelta objects (L1154-1173)

### tzinfo (L1234-1292)
Abstract base class for timezone information.
- Abstract methods: `tzname`, `utcoffset`, `dst` (must override)
- `fromutc` method with complex DST handling algorithm (L1257-1282)

### time (L1326-1676)  
Time of day with optional timezone.
- Properties: hour, minute, second, microsecond, tzinfo, fold
- Methods: `isoformat`, `strftime`, `utcoffset`, `tzname`, `dst`, `replace`
- Complex comparison logic handling naive vs aware times (L1454-1480)

### datetime (L1679-2311)
Combined date and time, inherits from date.
- Comprehensive timestamp conversion with fold detection (L1753-1794)
- Timezone conversion via `astimezone` (L2001-2024)
- Complex comparison and arithmetic operations
- Pickle support with protocol versioning

### timezone (L2326-2448)
Concrete tzinfo implementation for fixed UTC offsets.
- `UTC` singleton for UTC timezone (L2442)
- Automatic name generation from offset (L2422-2440)
- Validation of offset ranges (±24 hours)

## Special Classes
- `IsoCalendarDate` (L1295-1323): Named tuple for ISO calendar results

## Key Architectural Decisions
- Uses proleptic Gregorian calendar indefinitely extended
- Microsecond precision throughout
- Comprehensive pickle support with version compatibility
- Fold attribute for disambiguating repeated times during DST transitions
- Extensive input validation and normalization
- Pure Python implementation optimized for correctness over speed

## Critical Invariants
- All internal time representations are normalized
- UTC offsets must be strictly between -24 and +24 hours
- Year range strictly enforced: 1-9999
- Ordinal day 1 = January 1, year 1
- Microseconds always in range 0-999999