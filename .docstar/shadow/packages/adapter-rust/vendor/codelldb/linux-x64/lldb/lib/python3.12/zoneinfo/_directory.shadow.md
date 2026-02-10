# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/zoneinfo/
@generated: 2026-02-09T18:16:06Z

## Purpose
This directory contains the core timezone implementation for Python's `zoneinfo` module, providing comprehensive IANA timezone database support with sophisticated caching, DST handling, and POSIX TZ string parsing capabilities. It serves as the primary timezone backend for modern Python datetime operations.

## Key Components

### Core Classes
- **`ZoneInfo`**: Primary timezone class implementing the `tzinfo` interface with advanced two-tier caching (weak references + LRU cache)
- **`_ttinfo`**: Immutable timezone transition info containers storing UTC offset, DST offset, and timezone names
- **`_TZStr`**: Handles algorithmic DST transitions via POSIX TZ string rules for zones with complex recurring patterns
- **`_DayOffset`** & **`_CalendarOffset`**: Specialized classes for different DST transition rule types (Julian days vs. calendar-based rules)

### Architecture Overview
The module implements a hybrid approach supporting both:
1. **File-based timezone data**: Direct parsing of IANA tzdata files with pre-computed transition tables
2. **Algorithmic rules**: POSIX TZ string parsing for zones with mathematical DST patterns

### Public API Surface
**Primary Entry Points:**
- `ZoneInfo(key)`: Main factory method with automatic caching
- `ZoneInfo.no_cache(key)`: Creates uncached instances for specialized use cases  
- `ZoneInfo.from_file(file, key)`: Direct file-based instantiation

**Standard tzinfo Interface:**
- `utcoffset()`, `dst()`, `tzname()`: Basic timezone info methods
- `fromutc()`: Complex UTC-to-local conversion with DST transition handling

### Internal Organization & Data Flow

**Caching Strategy**: Two-tier system optimizes memory usage:
1. `WeakValueDictionary` for automatic cleanup of unused zones
2. `OrderedDict` LRU cache (size 8) for frequently accessed zones

**DST Transition Handling**: 
- Uses binary search on dual timestamp arrays (`_trans_utc`, `_trans_local`) for efficient lookups
- Implements sophisticated "fold" detection for ambiguous times during DST transitions
- Maintains separate local timestamp arrays for different fold interpretations

**Data Structures**:
- `_trans_utc`: UTC transition timestamps for precise calculations
- `_trans_local`: Local transition timestamps with fold disambiguation
- `_ttinfos`: Array of timezone info objects for each transition period
- `_tti_before`/`_tz_after`: Handle periods before first/after last transitions

### Key Patterns & Conventions

**Performance Optimizations**:
- Cached timedelta factory (`_load_timedelta`) with 512-item LRU cache
- Slots-based classes for memory efficiency
- Fixed-offset detection for simplified calculations
- Binary search algorithms for O(log n) transition lookups

**Error Handling**: Robust parsing with fallbacks for malformed TZ strings and comprehensive validation of timezone data files.

**Immutability**: Core data structures are immutable after construction, enabling safe caching and thread safety.

The module serves as a critical foundation for Python's datetime ecosystem, bridging the gap between low-level timezone data and high-level datetime operations while maintaining excellent performance characteristics through intelligent caching and optimization strategies.