# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/_pydatetime.py
@source-hash: 832de4317516c3a2
@generated: 2026-02-09T18:07:50Z

## Python datetime module implementation (_pydatetime.py)

This is the pure Python implementation of Python's datetime module, providing comprehensive date and time handling with timezone support. It implements all major datetime classes and utilities for date/time arithmetic, parsing, and formatting.

### Key Classes and Components

**timedelta (L583-905)**: Duration between two datetime objects. Stores internal representation as days, seconds, microseconds. Supports arithmetic operations, comparison, and division. Key methods include `total_seconds()` (L732-735), arithmetic operators (L753-846), and comparison methods (L849-878).

**date (L906-1232)**: Represents calendar dates. Core constructors include `__new__()` (L936-966), `fromtimestamp()` (L970-976), `today()` (L978-982), `fromordinal()` (L984-992), and `fromisoformat()` (L994-1006). Key methods: `isoformat()` (L1058-1067), `weekday()` (L1175-1177), `isocalendar()` (L1186-1212), and arithmetic operations (L1154-1173).

**time (L1326-1677)**: Time of day with optional timezone. Constructor at L1351-1388 handles pickle support and validation. Comparison methods (L1424-1480) include timezone-aware logic. Key methods: `isoformat()` (L1529-1544), `fromisoformat()` (L1548-1562), timezone methods `utcoffset()` (L1584-1591), `tzname()` (L1593-1604), `dst()` (L1606-1619).

**datetime (L1679-2312)**: Combines date and time, inheriting from date. Complex constructor (L1687-1720) with pickle support. Key class methods: `fromtimestamp()` (L1796-1804), `now()` (L1818-1822), `combine()` (L1837-1848), `fromisoformat()` (L1850-1879). Important instance methods: `timestamp()` (L1929-1935), `astimezone()` (L2001-2024), complex comparison logic (L2173-2208).

**tzinfo (L1234-1293)**: Abstract base class for timezone implementations. Defines interface: `tzname()` (L1241-1243), `utcoffset()` (L1245-1247), `dst()` (L1249-1255), and complex `fromutc()` algorithm (L1257-1282).

**timezone (L2326-2449)**: Concrete tzinfo implementation for fixed UTC offsets. Constructor (L2331-2344) with validation. Includes special UTC singleton (L2442). Methods: `utcoffset()` (L2390-2394), `tzname()` (L2396-2402), static `_name_from_offset()` (L2422-2440).

**IsoCalendarDate (L1295-1323)**: Named tuple for ISO calendar results with year, week, weekday properties.

### Utility Functions

**Calendar arithmetic**: `_is_leap()` (L49-51), `_days_before_year()` (L53-56), `_ymd2ord()` (L70-77), `_ord2ymd()` (L95-155) for proleptic Gregorian calendar conversions.

**ISO format parsing**: `_parse_isoformat_date()` (L335-368), `_parse_isoformat_time()` (L422-466), `_parse_hh_mm_ss_ff()` (L374-420) for parsing ISO 8601 strings.

**String formatting**: `_format_time()` (L168-187), `_format_offset()` (L189-205), `_wrap_strftime()` (L208-272) for timezone-aware formatting.

**Validation helpers**: `_check_date_fields()` (L525-536), `_check_time_fields()` (L538-553), `_check_tzinfo_arg()` (L555-557).

### Architecture Patterns

- **Immutable value objects**: All datetime types are immutable with `__slots__` for memory efficiency
- **Pickle support**: Complex serialization logic throughout with version compatibility
- **Timezone handling**: Sophisticated UTC offset and DST calculations with fold disambiguation
- **Proleptic Gregorian calendar**: Extends modern calendar rules indefinitely in both directions
- **ISO 8601 compliance**: Comprehensive parsing and formatting support

### Critical Invariants

- Year range: 1-9999 (MINYEAR/MAXYEAR constants L26-27)
- Microsecond precision throughout
- Timezone-aware vs naive datetime distinction
- Fold parameter for DST transition disambiguation
- Ordinal day numbering starting from January 1, year 1

### Dependencies

- `time` module for system time functions
- `math` module for floating-point operations  
- `sys` for platform detection
- `operator.index` for integer conversion

The module includes extensive algorithmic documentation (L2451-2645) explaining timezone conversion mathematics and edge cases.