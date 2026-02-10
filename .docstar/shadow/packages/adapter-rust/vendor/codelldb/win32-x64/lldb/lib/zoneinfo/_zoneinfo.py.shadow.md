# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/zoneinfo/_zoneinfo.py
@source-hash: ebb9b679519a2325
@generated: 2026-02-09T18:11:32Z

**Purpose:** Python timezone implementation using IANA timezone database files (tzdata). Core component of Python's `zoneinfo` module providing timezone-aware datetime operations.

**Key Classes:**

- `ZoneInfo` (L30-297): Main timezone class inheriting from `tzinfo`. Implements comprehensive timezone handling with caching, transition calculations, and DST support.
  - `__new__` (L40-52): Factory method with two-tier caching (weak + strong LRU)
  - `no_cache` (L54-59): Creates uncached instances
  - `from_file` (L78-88): Creates instances from file objects
  - `utcoffset/dst/tzname` (L105-112): Core tzinfo interface methods
  - `fromutc` (L114-156): Converts UTC to local time with fold detection
  - `_find_trans` (L158-183): Finds appropriate transition info for datetime
  - `_load_file` (L225-296): Parses tzdata files and constructs internal structures

- `_ttinfo` (L396-416): Timezone transition info container storing UTC offset, DST offset, and timezone name

- `_TZStr` (L421-508): Handles POSIX TZ string format for timezone rules with dynamic DST calculations
  - `_get_trans_info` (L461-483): Determines DST status for local time
  - `_get_trans_info_fromutc` (L485-507): Determines DST status for UTC time

- `_DayOffset` (L516-541): Represents day-of-year DST transition dates (Julian/non-Julian)

- `_CalendarOffset` (L543-621): Represents calendar-based DST transition dates (Mth week day)

**Key Functions:**

- `_load_timedelta` (L25-27): LRU-cached timedelta factory (512 entries)
- `_parse_tz_str` (L623-698): Parses POSIX TZ strings into `_TZStr` or `_ttinfo` objects
- `_parse_dst_start_end` (L701-724): Parses DST transition date specifications
- `_parse_transition_time` (L727-746): Parses transition time format
- `_parse_tz_delta` (L749-772): Parses timezone offset strings

**Architecture:**
- Two-tier caching: weak references + LRU strong cache (8 entries default)
- Supports both file-based tzdata and TZ strings
- Handles complex DST transitions with fold detection
- Optimized timedelta caching to reduce object creation
- Binary tzdata file parsing through `_common.load_data`

**Dependencies:**
- Internal: `_common`, `_tzpath` modules for tzdata handling
- External: Standard library modules for datetime, caching, parsing

**Critical Invariants:**
- Cached instances maintain referential equality
- DST fold detection requires proper transition ordering
- TZ string parsing must handle edge cases (missing DST, invalid formats)
- Timedelta cache prevents memory exhaustion while maintaining performance