# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/timeit.py
@source-hash: d47d9deb6be0136d
@generated: 2026-02-09T18:07:28Z

## Primary Purpose
Performance measurement library for Python code snippets. Provides precise timing with common measurement traps avoided through garbage collection control and statistical best practices.

## Core Classes

**Timer (L86-232)** - Main timing class that compiles and executes code snippets in controlled environments
- `__init__(L104-137)` - Constructs timer with stmt/setup strings or callables, compiles into executable template
- `timeit(L166-184)` - Executes statement `number` times with GC disabled, returns total time
- `repeat(L186-210)` - Runs timeit() multiple times, returns list of measurements
- `autorange(L212-231)` - Auto-determines loop count to achieve ≥0.2 second total time
- `print_exc(L139-164)` - Enhanced traceback display for timed code errors

## Core Functions

**timeit(L234-237)** - Convenience wrapper creating Timer and calling timeit()
**repeat(L240-243)** - Convenience wrapper creating Timer and calling repeat()
**main(L246-377)** - Command-line interface with argument parsing and result formatting
**reindent(L81-83)** - Helper for proper code indentation in templates

## Key Constants & Templates

**template (L69-78)** - Code template string used to generate timing functions
- Requires specific indentation: setup=4 spaces, stmt=8 spaces
**default_timer (L62)** - Points to `time.perf_counter` for high-resolution timing
**default_number/repeat (L60-61)** - Default execution counts (1M loops, 5 repeats)

## Dependencies
- `gc` - Garbage collection control during timing
- `itertools` - Loop iteration via `repeat()`
- `time` - Timer functions (`perf_counter`, `process_time`)
- `sys`, `getopt`, `os` - Command-line and system utilities

## Architecture Patterns

**Dynamic Code Generation**: Statements compiled into template functions for minimal timing overhead
**GC Isolation**: Garbage collection disabled during measurements to reduce timing variance
**Statistical Guidance**: Emphasizes minimum timing as most reliable measurement
**Flexible Input**: Accepts both string code and callable objects

## Critical Constraints

- Template indentation must be preserved (L66-68 comment)
- Setup code executed once, statement code executed in loop
- Measurements include loop overhead but exclude setup time
- Best practice: use minimum of repeated measurements, not average