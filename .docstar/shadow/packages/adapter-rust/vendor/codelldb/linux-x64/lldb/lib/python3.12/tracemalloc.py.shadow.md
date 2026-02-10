# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/tracemalloc.py
@source-hash: c2cc84a05b824df7
@generated: 2026-02-09T18:10:19Z

## Purpose and Responsibility

This is Python's tracemalloc module providing memory allocation tracing functionality. It wraps C-extension functions from `_tracemalloc` to offer high-level APIs for capturing, analyzing, and comparing memory allocation patterns. The module enables developers to track where Python objects are allocated and compare memory usage between different points in time.

## Key Classes and Functions

### Data Classes

**Statistic (L30-68)**: Represents memory allocation statistics for a specific traceback location. Contains `traceback`, `size`, and `count` fields. Implements comparison/hashing for sorting and provides formatted string representation with human-readable sizes.

**StatisticDiff (L70-118)**: Represents differences in memory allocations between two snapshots. Extends Statistic with `size_diff` and `count_diff` fields. Sort key prioritizes absolute size differences for identifying biggest changes.

**Frame (L141-177)**: Wrapper around filename/line number tuples from C extension. Provides `filename` and `lineno` properties with comparison/hashing support. Uses `@total_ordering` decorator for full comparison operations.

**Traceback (L179-255)**: Sequence of Frame instances representing call stack. Frames are reversed from C extension order (oldest to newest). Supports slicing, contains checking, and provides `format()` method for pretty-printing with source code lines via `linecache`.

**Trace (L272-309)**: Represents a single memory block allocation trace. Contains `domain`, `size`, and `traceback` properties. Domain identifies allocation context (e.g., Python heap vs C extensions).

### Collection Classes

**_Traces (L311-336)**: Internal sequence wrapper around raw trace tuples from C extension. Provides indexing/slicing that returns Trace instances and implements standard sequence operations.

**Snapshot (L415-549)**: Main API class for memory allocation snapshots. Contains filtered trace collection and analysis methods:
- `filter_traces()` (L452): Creates filtered snapshots using Filter/DomainFilter instances
- `statistics()` (L528): Groups traces by traceback/filename/lineno with optional cumulative mode
- `compare_to()` (L538): Compares with another snapshot to identify allocation differences
- `dump()/load()` (L426-439): Pickle-based serialization

### Filter Classes

**BaseFilter (L345-351)**: Abstract base for trace filtering with `inclusive` flag.

**Filter (L353-399)**: Filters traces by filename patterns, line numbers, domains. Supports `all_frames` mode to check entire call stack vs just top frame.

**DomainFilter (L401-413)**: Simple domain-based filtering for allocation contexts.

## Key Functions

**_format_size() (L13-28)**: Utility for human-readable byte formatting (B/KiB/MiB/GiB/TiB) with optional +/- signs for differences.

**get_object_traceback() (L257-270)**: Public API to get allocation traceback for any Python object.

**take_snapshot() (L551-560)**: Main entry point to capture current memory allocation state.

**_compare_grouped_stats() (L120-138)**: Internal function computing StatisticDiff instances between snapshot groups.

## Dependencies and Architecture

- **C Extension Integration**: Imports core functionality from `_tracemalloc` module
- **Standard Library**: Uses `collections.abc`, `fnmatch`, `linecache`, `pickle` for filtering, source display, serialization
- **Design Pattern**: Wrapper architecture around C extension with Python-friendly APIs
- **Memory Efficiency**: Uses `__slots__` throughout for reduced memory overhead

## Critical Constraints

- Tracemalloc must be enabled (`is_tracing()`) before taking snapshots
- Frame ordering is reversed from C extension (oldest-to-newest vs newest-to-oldest)
- Cumulative statistics only supported for filename/lineno grouping, not full tracebacks
- Filter matching uses XOR logic with inclusive flag for proper include/exclude behavior