# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/cProfile.py
@source-hash: c4c3edb84862431d
@generated: 2026-02-09T18:08:37Z

## cProfile Module - Python C-based Profiler Interface

**Purpose**: Python's high-performance statistical profiler interface built on the C extension `_lsprof`. Provides deterministic profiling with low overhead for measuring function call counts, execution times, and caller/callee relationships.

### Public Interface (L7)
- `run()` - Profile a statement string
- `runctx()` - Profile with custom globals/locals
- `Profile` - Main profiler class

### Simple Interface Functions (L17-25)
- **`run(statement, filename=None, sort=-1)` (L17)**: Executes statement under profiler, delegates to `_pyprofile._Utils`
- **`runctx(statement, globals, locals, filename=None, sort=-1)` (L20)**: Context-aware profiling with custom namespaces
- Documentation copied from `_pyprofile` module for API compatibility (L24-25)

### Core Profiler Class
**`Profile(_lsprof.Profiler)` (L29-121)**: Inherits from C extension, adds convenience methods and backward compatibility

#### Key Methods:
- **`print_stats(sort=-1)` (L42)**: Pretty-prints profiling results via `pstats`
- **`dump_stats(file)` (L46)**: Serializes stats to binary file using `marshal`
- **`create_stats()` (L52)**: Disables profiler and snapshots current data
- **`snapshot_stats()` (L56-89)**: Converts raw `_lsprof` data to `pstats`-compatible format
  - Builds `self.stats` dict with function signatures as keys
  - Values: `(cc, nc, tt, ct, callers)` tuples for call counts and timings
  - Handles subcall information and caller relationships
- **`run(cmd)` (L94)**: Profiles string in `__main__` namespace
- **`runctx(cmd, globals, locals)` (L99)**: Profiles with custom execution context
- **`runcall(func, *args, **kw)` (L108)**: Profiles single function call
- **Context manager support** (L115-120): `__enter__`/`__exit__` for `with` statements

### Utility Functions
**`label(code)` (L124-128)**: Creates function identifiers for stats
- Built-in functions: `('~', 0, code_string)`
- Regular functions: `(filename, line_number, function_name)`

### Command Line Interface
**`main()` (L132-191)**: Full CLI implementation with `optparse`
- Options: `-o` (output file), `-s` (sort order), `-m` (module mode)
- Handles both script files and module profiling via `runpy`
- Sets up proper `__main__` module spec for execution context
- Graceful `BrokenPipeError` handling for pipe operations

### Dependencies
- **`_lsprof`**: C extension providing core profiling functionality
- **`profile` as `_pyprofile`**: Fallback/compatibility layer
- **`pstats`**: Statistics formatting and display
- **`marshal`**: Binary serialization for stats persistence
- **`runpy`**: Module execution support
- **`importlib.machinery`**: Module spec creation

### Architecture Notes
- Minimal wrapper around high-performance C profiler
- Maintains compatibility with older `profile` module API
- Stats format designed for `pstats` consumption
- Supports both programmatic use and command-line execution
- Context manager pattern for automatic enable/disable