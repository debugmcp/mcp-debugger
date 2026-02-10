# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/pstats.py
@source-hash: 476a7f4298d02d74
@generated: 2026-02-09T18:10:02Z

Python profiling statistics analysis and reporting module. Provides tools for loading, analyzing, and presenting profile data from Python's `profile` and `cProfile` modules.

## Core Classes

**SortKey (L36-56)** - StrEnum defining sort options for profile reports. Uses custom `__new__` to support multiple aliases per sort key (e.g., 'time'/'tottime', 'calls'/'ncalls').

**FunctionProfile (L58-67)** - Dataclass holding function-level profiling metrics: call counts, timing data (total/per-call), file location. Hashable for use in collections.

**StatsProfile (L68-73)** - Container dataclass with total execution time and dictionary mapping function names to FunctionProfile instances.

**Stats (L74-519)** - Primary class for profile data manipulation and reporting. Core responsibilities:
- Loading profile data from files or Profile objects (L137-157)
- Combining multiple profile runs via `add()` method (L169-193) 
- Sorting by various criteria using `sort_stats()` (L235-272)
- Generating formatted reports: `print_stats()`, `print_callers()`, `print_callees()` (L412-459)
- Path manipulation with `strip_dirs()` (L279-306)
- Data export with `dump_stats()` (L195-198)

Key attributes:
- `stats`: Dict mapping function tuples to (cc, nc, tt, ct, callers) 
- `fcn_list`: Ordered list of functions after sorting
- `total_tt/total_calls/prim_calls`: Aggregate statistics

**TupleComp (L520-540)** - Generic tuple comparison utility for custom sorting. Takes list of (index, direction) pairs to define sort precedence.

**ProfileBrowser (L618-763)** - Interactive command-line interface for exploring profile data. Built on `cmd.Cmd`, provides commands like 'sort', 'stats', 'callers', etc.

## Utility Functions

**Function name handling (L545-561)**:
- `func_strip_path()`: Remove directory paths from function identifiers
- `func_get_function_name()`: Extract function name from tuple
- `func_std_string()`: Format function for display

**Statistics aggregation (L569-591)**:
- `add_func_stats()`: Combine stats from two profile entries
- `add_callers()`: Merge caller dictionaries, handling both tuple and scalar formats

**Formatting (L604-605)**:
- `f8()`: Format floats to 8.3 precision for consistent output

## Key Patterns

Functions are represented as 3-tuples: (filename, line_number, function_name). Statistics stored as 5-tuples: (primitive_calls, total_calls, total_time, cumulative_time, callers_dict).

The module supports both old `profile` format (scalar caller values) and new `cProfile` format (tuple caller values) for backward compatibility.

Sort system uses expandable abbreviations - partial matches are resolved to full sort keys via `get_sort_arg_defs()` (L218-233).

Chaining pattern enabled - most methods return `self` for fluent interface: `Stats().sort_stats('time').print_stats(10)`.