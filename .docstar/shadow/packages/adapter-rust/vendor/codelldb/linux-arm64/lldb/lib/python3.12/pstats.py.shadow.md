# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/pstats.py
@source-hash: 476a7f4298d02d74
@generated: 2026-02-09T18:09:28Z

## Primary Purpose
Python profiling statistics analysis and reporting module. Provides classes for loading, manipulating, and displaying performance profiling data from cProfile or profile modules.

## Key Classes & Functions

### SortKey (L36-56)
String enum defining standard sorting keys for profiling data:
- TIME/tottime: internal function time
- CUMULATIVE/cumtime: cumulative time including callees
- CALLS/ncalls: call count
- FILENAME/module: file name
- LINE: line number
- NAME: function name
- Custom __new__ method supports multiple aliases per sort key

### FunctionProfile (L58-67)
Dataclass representing individual function profiling metrics:
- ncalls: call count (str format)
- tottime: time spent in function alone
- percall_tottime: per-call time
- cumtime: cumulative time including callees
- percall_cumtime: per-call cumulative time
- file_name, line_number: location info

### StatsProfile (L68-73)
Container dataclass for complete profiling results:
- total_tt: total execution time
- func_profiles: Dict mapping function names to FunctionProfile instances

### Stats (L74-519)
Main class for profiling data analysis and reporting:

**Initialization & Data Loading:**
- __init__(L108-116): Accepts profile files, Stats objects, or profiler instances
- load_stats(L137-157): Loads data from files (marshal format) or profiler objects
- add(L169-193): Combines multiple profiling datasets

**Data Processing:**
- sort_stats(L235-272): Sorts functions by specified criteria using SortKey enum or strings
- strip_dirs(L279-306): Removes directory paths from filenames
- reverse_order(L274-277): Reverses current sort order
- calc_callees(L308-319): Builds caller->callee relationship mapping

**Report Generation:**
- print_stats(L412-433): Main statistics report with function timing data
- print_callers(L450-459): Shows which functions called each function
- print_callees(L435-448): Shows which functions each function called
- get_stats_profile(L353-386): Returns structured StatsProfile object

**Internal Data Structure:**
- self.stats: Dict mapping (filename, line, funcname) tuples to (cc, nc, tt, ct, callers) tuples
- cc: primitive calls, nc: total calls, tt: total time, ct: cumulative time
- callers: Dict of calling functions

### TupleComp (L520-540)
Comparison utility for sorting tuples by multiple criteria with configurable direction (ascending/descending).

### ProfileBrowser (L618-762)
Interactive command-line interface for exploring profiling data:
- Commands: read, add, sort, stats, callers, callees, strip, reverse
- Supports command completion and help system
- Argument parsing for integers, floats (percentages), and regex patterns

## Utility Functions

**Function Name Processing (L545-561):**
- func_strip_path(): Removes directory from function tuple
- func_get_function_name(): Extracts function name
- func_std_string(): Formats function for display

**Statistics Aggregation (L569-598):**
- add_func_stats(): Combines two function stat tuples
- add_callers(): Merges caller dictionaries
- count_calls(): Sums call counts from caller data

**Formatting:**
- f8(L604-605): Formats floats to 8-character width with 3 decimal places

## Key Dependencies
- marshal: Binary serialization for profile data persistence
- enum: SortKey enumeration support
- dataclasses: FunctionProfile and StatsProfile definitions
- cmd: Interactive browser interface
- re: Regular expression filtering support

## Architecture Notes
- Designed as "friend" class to Profile/cProfile modules
- Supports both cProfile (tuple format) and profile (numeric format) caller data
- Method chaining pattern: most methods return self for fluent interface
- Extensible sorting system with abbreviation support
- Memory-efficient lazy calculation of callees relationships