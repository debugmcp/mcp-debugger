# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/tracemalloc.py
@source-hash: c2cc84a05b824df7
@generated: 2026-02-09T18:09:31Z

## Purpose
Python tracemalloc module providing memory allocation tracing and analysis. Extends the C implementation (`_tracemalloc`) with high-level classes for memory profiling, trace analysis, and snapshot comparison. Part of Python's standard library for debugging memory usage.

## Core Classes

### `Frame` (L141-177)
Represents a single frame in a call stack traceback. Wraps a tuple of (filename, lineno) with properties for easy access. Implements ordering and hashing for use in collections. Uses `__slots__` for memory efficiency.

### `Traceback` (L180-254) 
Sequence of Frame instances representing a complete call stack, sorted from oldest to most recent frame. Key features:
- Reverses frame order from C implementation (L193)
- Implements Sequence protocol with slice support (L203-207)
- `format()` method (L236-254) produces human-readable traceback output
- Tracks `total_nframe` for truncated tracebacks

### `Trace` (L272-309)
Represents a single memory allocation trace containing domain, size, and traceback. Wraps tuple from C layer: (domain, size, traceback_tuple). Provides property access to components and formatted string output.

### `_Traces` (L311-336)
Sequence wrapper around raw trace tuples from C implementation. Provides indexed access to Trace objects while maintaining efficient storage of raw tuples.

### `Statistic` (L30-68)
Aggregated statistics for memory allocations grouped by traceback. Contains:
- `traceback`: The call stack
- `size`: Total bytes allocated
- `count`: Number of allocations
- Custom `_sort_key()` for ranking by size/count (L66-67)

### `StatisticDiff` (L70-118)
Comparison between two statistics showing memory allocation changes. Tracks both current values and differences (size_diff, count_diff). Sort key prioritizes absolute size differences (L114-117).

## Filter Classes

### `BaseFilter` (L345-351)
Abstract base for trace filtering with `inclusive` flag and abstract `_match()` method.

### `Filter` (L353-399)
Concrete filter implementation supporting:
- Filename pattern matching with wildcards
- Optional line number filtering
- `all_frames` mode for matching any frame vs. just first frame
- Optional domain filtering
- Complex logic combining traceback and domain matching (L390-398)

### `DomainFilter` (L401-413)
Simple domain-based filter using XOR logic for inclusive/exclusive behavior (L412).

## Core Operations

### `Snapshot` (L415-549)
Main interface for memory trace analysis:
- `filter_traces()` (L452-475): Creates filtered snapshot using include/exclude filter lists
- `statistics()` (L528-536): Groups traces by traceback/filename/lineno with optional cumulative mode
- `compare_to()` (L538-548): Compares with another snapshot to show allocation differences
- `_group_by()` (L477-526): Complex grouping logic handling both normal and cumulative statistics
- `dump()/load()` (L426-439): Pickle-based persistence

### Utility Functions
- `_format_size()` (L13-27): Human-readable byte formatting with units (B, KiB, MiB, etc.)
- `_normalize_filename()` (L338-342): Normalizes paths and removes .pyc extension
- `_compare_grouped_stats()` (L120-137): Computes StatisticDiff objects between snapshot groups
- `get_object_traceback()` (L257-269): Retrieves allocation traceback for any Python object
- `take_snapshot()` (L551-560): Creates new snapshot if tracing is active

## Dependencies
- C extension `_tracemalloc` for low-level tracing functionality
- Standard library: collections.abc, functools, fnmatch, linecache, os.path, pickle

## Key Patterns
- Extensive use of `__slots__` for memory efficiency in data classes
- Consistent tuple wrapping pattern: C tuples → Python objects with property access
- Filter chain architecture with include/exclude separation
- Statistical aggregation with multiple grouping modes (traceback/filename/lineno)
- Snapshot comparison workflow for memory leak detection