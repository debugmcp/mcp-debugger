# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/pstats.py
@source-hash: 476a7f4298d02d74
@generated: 2026-02-09T18:13:28Z

Python profiling statistics analysis and reporting module. This is the standard library's `pstats` module for processing and displaying profiling data from the `profile` or `cProfile` modules.

## Core Classes

**SortKey (L36-56)**: StrEnum defining sort criteria for profile statistics. Uses `@_simple_enum` decorator to support multiple string values per enum member (e.g., 'calls'/'ncalls', 'time'/'tottime'). Custom `__new__` method maps all alias values to single enum instances.

**FunctionProfile (L58-67)**: Dataclass representing profile data for a single function. Contains call counts (ncalls), timing data (tottime, cumtime), per-call averages (percall_tottime, percall_cumtime), and location info (file_name, line_number). Uses `unsafe_hash=True` for hashability.

**StatsProfile (L68-73)**: Dataclass aggregating total execution time and mapping of function names to FunctionProfile instances. Container for structured profile data extraction.

**Stats (L74-519)**: Main class for loading, processing, and reporting profiling data. Core functionality includes:

- **Initialization (L108-136)**: Accepts multiple profile sources (files, Profile objects). Uses `marshal.load()` for binary profile data files. Calculates aggregate statistics via `get_top_level_stats()`.

- **Data Management**: 
  - `load_stats()` (L137-158): Handles various input types (strings as filenames, objects with `create_stats()` method)
  - `add()` (L169-194): Merges multiple profile datasets, combining statistics via `add_func_stats()`
  - `dump_stats()` (L195-199): Serializes data using marshal

- **Sorting & Filtering**:
  - `sort_stats()` (L235-273): Multi-key sorting using `sort_arg_dict_default` lookup table. Supports both string keys and SortKey enums. Creates sorted function list via `TupleComp` comparator.
  - `strip_dirs()` (L279-307): Removes path prefixes from filenames for cleaner display

- **Reporting Methods**:
  - `print_stats()` (L412-434): Main statistical report with timing data
  - `print_callees()` (L435-449): Shows functions called by each function  
  - `print_callers()` (L450-460): Shows functions that called each function
  - `get_stats_profile()` (L353-387): Returns structured StatsProfile object

**TupleComp (L520-540)**: Generic tuple comparison class for multi-criteria sorting. Takes list of (index, direction) pairs and provides `compare()` method compatible with `functools.cmp_to_key()`.

**ProfileBrowser (L618-763)**: Interactive command-line browser for profile data. Inherits from `cmd.Cmd` and provides commands like `read`, `sort`, `stats`, `callees`, `callers`, `strip`, etc.

## Key Data Structures

Profile statistics stored as nested dictionaries where:
- Keys: function tuples `(filename, line_number, function_name)`
- Values: tuples `(cc, nc, tt, ct, callers)` where:
  - cc: primitive call count
  - nc: total call count  
  - tt: total time in function (excluding subcalls)
  - ct: cumulative time (including subcalls)
  - callers: dict mapping caller functions to call statistics

## Utility Functions

- `func_strip_path()` (L545-547): Removes directory path from function tuples
- `func_std_string()` (L552-561): Formats function tuples for display
- `add_func_stats()` (L569-574): Merges statistics from two profile entries
- `f8()` (L604-605): Formats floating-point numbers to 8.3f format

## Dependencies

Standard library imports: sys, os, time, marshal, re, enum, functools, dataclasses, typing. Optional readline for enhanced command-line interaction.

## Usage Pattern

Typical usage: `Stats('profile.prof').strip_dirs().sort_stats('time').print_stats(10)` - method chaining pattern for fluent API.