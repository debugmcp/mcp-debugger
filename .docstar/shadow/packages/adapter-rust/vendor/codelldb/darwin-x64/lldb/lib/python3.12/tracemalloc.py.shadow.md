# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/tracemalloc.py
@source-hash: c2cc84a05b824df7
@generated: 2026-02-09T18:08:19Z

## Purpose
Python's tracemalloc module Python layer - provides high-level interfaces for memory allocation tracking and snapshot analysis. Wraps C extension `_tracemalloc` with user-friendly classes for statistics, filtering, and comparison.

## Key Components

### Utility Functions
- `_format_size(size, sign)` (L13-27): Formats byte sizes into human-readable units (B, KiB, MiB, etc.) with optional sign prefix
- `_normalize_filename(filename)` (L338-342): Normalizes file paths by converting .pyc to .py extensions
- `_compare_grouped_stats(old_group, new_group)` (L120-137): Compares statistics between two snapshots, returning StatisticDiff instances
- `get_object_traceback(obj)` (L257-269): Retrieves allocation traceback for a Python object, wrapping C function
- `take_snapshot()` (L551-560): Creates memory allocation snapshot, requires tracing to be active

### Core Data Classes

**Statistic** (L30-68): Represents memory allocation statistics for a specific traceback
- Stores traceback, total size, and allocation count
- Implements sorting by size, then count, then traceback
- Provides formatted string output with average allocation size

**StatisticDiff** (L70-118): Represents difference between two Statistic instances
- Tracks current values and deltas (size_diff, count_diff)
- Sorts by absolute size difference for change analysis
- Shows both current state and changes in string representation

**Frame** (L141-177): Single stack frame with filename and line number
- Immutable wrapper around (filename, lineno) tuple
- Implements total ordering and hashing for use in collections

**Traceback** (L179-255): Sequence of Frame instances from oldest to newest
- Reverses frame order from C extension (newest-to-oldest → oldest-to-newest)
- Supports slicing and formatting with source code lookup
- Tracks total frame count for truncated tracebacks

**Trace** (L272-309): Individual memory allocation record
- Contains domain ID, size, and traceback information
- Wraps raw C trace tuple with property access

### Filtering System

**BaseFilter** (L345-351): Abstract base for trace filtering
- `inclusive` flag determines include/exclude behavior
- Subclasses implement `_match(trace)` method

**Filter** (L353-399): File-based filtering with pattern matching
- Supports filename patterns (fnmatch), line number filtering
- `all_frames` mode matches any frame vs. just the top frame
- Domain filtering for memory allocation domains

**DomainFilter** (L401-413): Simple domain-based filtering
- Matches traces by memory domain ID only

### Snapshot Management

**Snapshot** (L415-549): Memory allocation snapshot with analysis capabilities
- `filter_traces(filters)` (L452-475): Applies filter list to create new snapshot
- `statistics(key_type, cumulative)` (L528-536): Groups allocations by traceback/filename/lineno
- `compare_to(old_snapshot, key_type, cumulative)` (L538-548): Generates diff statistics
- `dump(filename)`/`load(filename)` (L426-439): Pickle-based persistence
- `_group_by(key_type, cumulative)` (L477-526): Core grouping logic with cumulative option

**_Traces** (L311-336): Sequence wrapper for raw trace tuples from C extension
- Lazy-wraps traces in Trace objects on access
- Implements standard sequence protocol

## Dependencies
- C extension `_tracemalloc`: Core tracing functionality and data collection
- `collections.abc.Sequence`: Base class for sequence types
- `linecache`: Source code retrieval for traceback formatting
- `fnmatch`: Pattern matching for filename filtering
- `pickle`: Snapshot serialization/deserialization

## Architecture Notes
- Clean separation between C extension (performance) and Python layer (usability)
- Immutable data structures with efficient comparison and hashing
- Flexible filtering system supporting complex trace selection criteria
- Statistics aggregation supports both point-in-time and cumulative analysis
- Frame ordering standardized to Python convention (oldest-to-newest)