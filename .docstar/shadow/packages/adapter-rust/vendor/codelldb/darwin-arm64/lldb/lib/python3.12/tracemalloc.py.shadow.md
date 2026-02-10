# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/tracemalloc.py
@source-hash: c2cc84a05b824df7
@generated: 2026-02-09T18:07:31Z

**Primary Purpose:**
Python tracemalloc module implementation providing memory allocation tracing, snapshot management, and statistical analysis capabilities. This is part of Python's standard library for tracking memory usage patterns and debugging memory issues.

**Core Dependencies:**
- Imports C extension `_tracemalloc` for low-level tracing operations (L9-10)
- Uses standard library modules: collections.abc, functools, fnmatch, linecache, os.path, pickle (L1-6)

**Key Classes and Functions:**

**Utility Functions:**
- `_format_size()` (L13-27): Formats byte sizes into human-readable units (B, KiB, MiB, GiB, TiB) with appropriate precision
- `_normalize_filename()` (L338-342): Normalizes filenames by converting case and handling .pyc extensions
- `_compare_grouped_stats()` (L120-137): Compares statistics between old and new snapshot groups, producing difference statistics

**Memory Statistics Classes:**
- `Statistic` (L30-68): Represents memory allocation statistics for a specific traceback, storing traceback, size, and count. Includes formatting methods and sort key based on size/count/traceback
- `StatisticDiff` (L70-118): Represents differences between two statistics, storing current values plus difference deltas for size and count comparisons

**Traceback Management:**
- `Frame` (L141-177): Represents a single stack frame with filename and line number properties. Implements total ordering and hashing
- `Traceback` (L179-255): Sequence of Frame instances representing a call stack, ordered from oldest to most recent. Provides formatting methods with configurable limits and ordering

**Memory Trace Classes:**
- `Trace` (L272-309): Represents a single memory allocation trace containing domain, size, and traceback information
- `_Traces` (L311-336): Sequence wrapper for trace tuples, providing indexed access to Trace objects

**Filtering System:**
- `BaseFilter` (L345-351): Abstract base class for trace filtering with inclusive/exclusive behavior
- `Filter` (L353-399): File-based filter supporting filename patterns, line numbers, frame matching modes, and domain filtering
- `DomainFilter` (L401-413): Simple domain-based filter for memory allocation domains

**Core Snapshot Management:**
- `Snapshot` (L415-548): Main class for memory allocation snapshots containing:
  - Trace collection and traceback limit storage
  - Persistence via pickle dump/load methods (L426-439)  
  - Trace filtering with include/exclude filter lists (L441-475)
  - Statistical grouping by traceback/filename/lineno with cumulative options (L477-526)
  - Statistics generation and snapshot comparison (L528-548)

**Public API Functions:**
- `get_object_traceback()` (L257-269): Retrieves allocation traceback for a specific Python object
- `take_snapshot()` (L551-560): Creates snapshot of current memory allocation state

**Architectural Patterns:**
- Heavy use of `__slots__` for memory efficiency in data classes
- Total ordering implementation for Frame and Traceback classes
- Sequence protocol implementation for collection classes
- Filter chain pattern with inclusive/exclusive semantics
- Statistical aggregation with multiple grouping strategies (traceback, filename, lineno)
- Pickle-based serialization for snapshot persistence

**Key Invariants:**
- Traceback frames are reversed from C extension format (most-recent-first → oldest-first)
- Statistics sorting prioritizes size, then count, then traceback for consistent ordering
- Filter matching uses XOR logic to handle inclusive/exclusive behavior consistently
- Cumulative statistics only supported for filename/lineno grouping modes