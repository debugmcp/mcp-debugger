# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/cProfile.py
@source-hash: c4c3edb84862431d
@generated: 2026-02-09T18:07:09Z

## cProfile.py - Python Performance Profiler Interface

**Primary Purpose:** Provides a high-level Python interface to the `_lsprof` C extension profiler, offering both simple function-based and class-based profiling APIs compatible with the standard `profile` module.

### Key Functions

- **`run(statement, filename=None, sort=-1)` (L17-18)**: Simple interface to profile a statement string using default globals/locals
- **`runctx(statement, globals, locals, filename=None, sort=-1)` (L20-22)**: Profile a statement with explicit execution context
- **`label(code)` (L124-128)**: Utility function that converts code objects to standardized tuples for profiling output - handles both built-in functions (returns `('~', 0, code)`) and regular code objects (returns `(filename, lineno, funcname)`)
- **`main()` (L132-191)**: Command-line interface handler supporting module profiling (`-m`), output file specification (`-o`), and sort options (`-s`)

### Key Classes

- **`Profile(_lsprof.Profiler)` (L29-121)**: Main profiler class extending the C extension with convenient methods
  - **`print_stats(sort=-1)` (L42-44)**: Outputs formatted profiling results using `pstats`
  - **`dump_stats(file)` (L46-50)**: Serializes profiling data to file using `marshal`
  - **`create_stats()` (L52-54)**: Disables profiler and snapshots current statistics
  - **`snapshot_stats()` (L56-89)**: Core method that transforms raw profiler data into pstats-compatible format, handling call counts, timing data, and caller relationships
  - **`run(cmd)` (L94-97)**: Profile string in `__main__` context
  - **`runctx(cmd, globals, locals)` (L99-105)**: Profile string with explicit context
  - **`runcall(func, *args, **kw)` (L108-113)**: Profile single function call
  - Context manager methods `__enter__/__exit__` (L115-120) for `with` statement usage

### Dependencies

- **`_lsprof`**: C extension providing core profiling functionality
- **`profile` as `_pyprofile`**: Standard library profiler for utility functions and documentation
- **`pstats`**: Statistics formatting and display (imported locally)
- **`marshal`**: Binary serialization for stats output
- **`importlib.machinery`**: Module specification handling in main()
- **`runpy`**: Module execution support

### Architecture & Patterns

- **Delegation Pattern**: Simple functions `run()`/`runctx()` delegate to `_pyprofile._Utils(Profile)` for consistent interface
- **Template Method**: `Profile` extends `_lsprof.Profiler` with convenience methods while inheriting core functionality
- **Data Transformation**: `snapshot_stats()` converts C extension data structures into Python dictionaries compatible with `pstats` format
- **Context Management**: Supports both manual enable/disable and automatic context manager usage

### Critical Data Structures

- **`self.stats`**: Dictionary mapping function labels to tuples `(cc, nc, tt, ct, callers)` where:
  - `cc`: actual call count (excluding recursive)
  - `nc`: total call count (including recursive) 
  - `tt`: total inline time
  - `ct`: cumulative time
  - `callers`: dict of calling functions with their timing data

### Command Line Interface

Supports profiling scripts (`python -m cProfile script.py`) or modules (`python -m cProfile -m module_name`) with output redirection and sorting options. Handles module execution context properly including `__spec__` setup.