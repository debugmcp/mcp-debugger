# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/tracemalloc.py
@source-hash: c2cc84a05b824df7
@generated: 2026-02-09T18:14:22Z

**Primary Purpose**: Pure Python implementation of the tracemalloc module's high-level API for memory allocation tracing, providing user-friendly classes and utilities that wrap the low-level C extension.

**Key Classes and Functions**:

- `_format_size(size, sign)` (L13-28): Formats memory sizes with appropriate units (B, KiB, MiB, GiB, TiB), handling both signed and unsigned display
- `Statistic` (L30-68): Memory allocation statistics for a specific traceback, storing size/count with comparison and formatting methods
- `StatisticDiff` (L70-118): Difference statistics between two snapshots, tracking both current values and deltas
- `Frame` (L141-176): Single stack frame with filename/lineno properties, implements ordering and hashing
- `Traceback` (L179-254): Sequence of frames from oldest to newest, with formatting capabilities and slice access
- `Trace` (L272-309): Memory block trace containing domain, size, and traceback information
- `_Traces` (L311-336): Sequence wrapper for raw trace tuples from C extension
- `Filter` (L353-399): Filename pattern-based trace filtering with lineno/domain/frame matching options
- `DomainFilter` (L401-413): Simple domain-based trace filtering
- `Snapshot` (L415-548): Main class for memory snapshots with filtering, statistics, and comparison capabilities

**Core Methods**:
- `Snapshot.statistics(key_type, cumulative)` (L528-536): Groups traces by traceback/filename/lineno
- `Snapshot.compare_to(old_snapshot, key_type, cumulative)` (L538-548): Generates diff statistics between snapshots
- `Snapshot.filter_traces(filters)` (L452-475): Applies include/exclude filters to create filtered snapshot
- `get_object_traceback(obj)` (L257-269): Retrieves allocation traceback for specific Python object
- `take_snapshot()` (L551-560): Creates snapshot from current tracing state

**Dependencies**: 
- Imports core functionality from `_tracemalloc` C extension (L9-10)
- Uses `linecache` for source code retrieval in traceback formatting
- Relies on `pickle` for snapshot serialization

**Architectural Patterns**:
- Wrapper pattern: Python classes wrap C extension tuples for user-friendly API
- Sequence protocol: Traceback and _Traces implement collections.abc.Sequence
- Total ordering: Frame and Traceback use @total_ordering decorator for comparison
- Factory methods: Static load/dump methods on Snapshot class

**Critical Invariants**:
- Frame tuples from C extension are reversed in Traceback constructor (L193) - C returns newest-to-oldest, API expects oldest-to-newest
- All filename comparisons use normalized paths via `_normalize_filename()` (L338-342)
- Statistics sorting uses `_sort_key()` methods for consistent ordering
- Filter inclusive/exclusive logic uses XOR operations for boolean logic (L377, L412)