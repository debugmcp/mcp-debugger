# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/timeit.py
@source-hash: d47d9deb6be0136d
@generated: 2026-02-09T18:10:15Z

## Purpose
Python's standard `timeit` module for measuring execution time of small code snippets with high precision. Provides both programmatic API and command-line interface. Part of LLDB Python distribution for debugging/profiling workflows.

## Key Components

### Timer Class (L86-232)
Core timing engine that compiles user code into optimized timing loops.

**Constructor (L104-137)**: Accepts statement to time, setup code, timer function, and globals namespace. Validates inputs (string or callable), compiles into execution template using `template` (L69-78), and creates `inner` function for actual timing.

**timeit() (L166-184)**: Executes statement `number` times (default 1M), disables garbage collection during timing for accuracy, returns elapsed time as float seconds.

**repeat() (L186-210)**: Calls `timeit()` multiple times, returns list of timing results. Recommends using `min()` of results as most reliable measurement.

**autorange() (L212-231)**: Automatically determines appropriate number of iterations using sequence 1, 2, 5, 10, 20, 50... until total time ≥ 0.2 seconds.

**print_exc() (L139-164)**: Enhanced traceback printing that shows source lines from compiled template by injecting into `linecache`.

### Module Functions (L234-244)
- `timeit()` (L234-237): Convenience wrapper creating Timer and calling timeit()
- `repeat()` (L240-243): Convenience wrapper creating Timer and calling repeat()

### Command Line Interface (L246-377)
**main() (L246-377)**: Full CLI implementation supporting:
- `-n/--number N`: iteration count
- `-r/--repeat N`: repetition count  
- `-s/--setup S`: setup statements
- `-p/--process`: use `process_time()` vs `perf_counter()`
- `-v/--verbose`: detailed output with precision control
- `-u/--unit`: output time unit (nsec, usec, msec, sec)

Includes auto-ranging (L320-336), result formatting (L344-356), and reliability warning if worst/best ratio > 4x (L370-376).

## Key Constants & Utilities
- `default_timer` (L62): Aliased to `time.perf_counter` for high-resolution timing
- `template` (L69-78): String template for compiled timing functions with precise indentation requirements
- `reindent()` (L81-83): Helper for proper code indentation in template
- `dummy_src_name` (L59): Fake filename for compiled code
- `units` dict (L282): Time unit conversion factors

## Architecture
Uses code compilation strategy: user statements are embedded into timing template, compiled to bytecode, and executed in controlled namespace. This minimizes timing overhead compared to eval-based approaches. Garbage collection is disabled during measurements for consistent results.

## Dependencies
- `gc`, `itertools`, `sys`, `time`: Core timing infrastructure  
- `getopt`: Command-line parsing
- `linecache`, `traceback`: Enhanced error reporting
- `os`, `warnings`: CLI utilities