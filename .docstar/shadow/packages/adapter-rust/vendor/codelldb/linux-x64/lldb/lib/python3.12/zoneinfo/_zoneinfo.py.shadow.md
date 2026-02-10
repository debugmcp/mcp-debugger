# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/zoneinfo/_zoneinfo.py
@source-hash: ebb9b679519a2325
@generated: 2026-02-09T18:06:26Z

## Purpose
Implements timezone support through the `ZoneInfo` class, providing IANA timezone database integration with caching, DST calculations, and TZ string parsing. This is the core timezone implementation for Python's `zoneinfo` module.

## Key Classes

### ZoneInfo (L30-394)
Primary timezone class extending `tzinfo`. Implements a sophisticated caching system with both weak and strong references to optimize memory usage.

**Key methods:**
- `__new__()` (L40-52): Factory method implementing two-tier caching (weak + strong LRU cache with size limit of 8)
- `no_cache()` (L54-59): Creates uncached instances for specialized use cases
- `from_file()` (L77-88): Creates instances directly from file objects, disables pickling
- `utcoffset()`, `dst()`, `tzname()` (L105-112): Standard tzinfo interface methods
- `fromutc()` (L114-156): Complex UTC-to-local conversion handling DST transitions and fold detection
- `_find_trans()` (L158-183): Core transition lookup using binary search on local timestamps
- `_load_file()` (L225-296): Parses timezone data files and constructs internal structures

**Internal state:**
- `_trans_utc`: UTC transition timestamps
- `_trans_local`: Local transition timestamps (two arrays for fold handling)
- `_ttinfos`: Transition time info objects
- `_tti_before`: Default timezone info before first transition
- `_tz_after`: Timezone info after last transition (can be `_TZStr` for complex rules)

### _ttinfo (L396-416)
Immutable timezone transition info container with slots optimization.
- Stores `utcoff` (UTC offset), `dstoff` (DST offset), `tzname` (timezone name)
- Used throughout the system to represent timezone states

### _TZStr (L421-508)  
Handles POSIX TZ string rules for zones with algorithmic DST transitions.
- `transitions()` (L456-459): Calculates DST start/end for given year
- `_get_trans_info()` (L461-483): Determines current timezone state with fold handling
- `_get_trans_info_fromutc()` (L485-507): UTC-based transition info with ambiguity detection

### _DayOffset (L516-541)
Represents day-of-year based DST transition rules (Julian/non-Julian days).

### _CalendarOffset (L543-621)
Represents calendar-based DST transition rules (e.g., "2nd Sunday in March").
- `year_to_epoch()` (L589-620): Complex calculation for Nth weekday of month

## Key Functions

### _load_timedelta (L25-27)
LRU cached timedelta factory (512 item cache) to reduce object creation overhead.

### _parse_tz_str (L623-698)
Parses POSIX TZ strings into `_TZStr` or `_ttinfo` objects. Handles complex regex parsing for standard/DST abbreviations, offsets, and transition rules.

### Utility Functions
- `_post_epoch_days_before_year()` (L510-513): Gregorian calendar calculations
- `_parse_dst_start_end()` (L701-724): Parses DST transition date specifications
- `_parse_transition_time()` (L727-746): Parses time components with sign handling
- `_parse_tz_delta()` (L749-772): Parses timezone offset strings

## Architecture Notes

**Caching Strategy**: Two-tier system using `WeakValueDictionary` for automatic cleanup and `OrderedDict` LRU cache for frequently accessed zones.

**DST Handling**: Complex fold detection logic in `fromutc()` handles ambiguous/non-existent times during transitions. Uses dual timestamp arrays (`_trans_local[0]` and `_trans_local[1]`) for different fold interpretations.

**Data Sources**: Supports both file-based timezone data (IANA tzdata) and algorithmic rules (POSIX TZ strings).

**Performance Optimizations**: 
- Cached timedelta objects
- Binary search for transition lookups  
- Slots-based classes for memory efficiency
- Fixed-offset detection for optimization

## Constants
- `EPOCH` (L11): 1970-01-01 datetime reference
- `EPOCHORDINAL` (L12): Ordinal day number for epoch
- `_NO_TTINFO` (L418): Sentinel for missing timezone info