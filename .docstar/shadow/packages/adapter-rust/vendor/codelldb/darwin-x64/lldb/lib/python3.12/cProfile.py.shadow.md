# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/cProfile.py
@source-hash: c4c3edb84862431d
@generated: 2026-02-09T18:09:29Z

**Primary Purpose**: Python interface for the 'lsprof' profiler, providing a high-level API compatible with the standard `profile` module for performance profiling of Python code.

**Key Components**:

- **Module Functions** (L17-25):
  - `run(statement, filename=None, sort=-1)` (L17): Profiles a statement string using default globals/locals
  - `runctx(statement, globals, locals, filename=None, sort=-1)` (L20): Profiles a statement with specified execution context
  - Both delegate to `_pyprofile._Utils(Profile)` and inherit docstrings from `_pyprofile`

- **Profile Class** (L29-121): Main profiler class inheriting from `_lsprof.Profiler`
  - Constructor accepts timer, timeunit, subcalls, and builtins parameters
  - **Statistics Methods**:
    - `print_stats(sort=-1)` (L42): Prints formatted profiling results using `pstats`
    - `dump_stats(file)` (L46): Serializes stats to file using `marshal`
    - `create_stats()` (L52): Disables profiler and snapshots current statistics
    - `snapshot_stats()` (L56): Converts raw profiler data into `pstats`-compatible format
  - **Execution Methods**:
    - `run(cmd)` (L94): Profiles command string in `__main__` context
    - `runctx(cmd, globals, locals)` (L99): Profiles command with custom context
    - `runcall(func, *args, **kw)` (L108): Profiles single function call
  - **Context Manager** (L115-120): Implements `__enter__`/`__exit__` for `with` statement usage

- **Utility Functions**:
  - `label(code)` (L124-128): Converts code objects to tuple format for statistics keys
  - `main()` (L132-191): Command-line interface with option parsing for profiling scripts/modules

**Dependencies**:
- `_lsprof`: C extension providing core profiling functionality
- `profile` (as `_pyprofile`): Base profiling utilities and documentation
- `pstats`: Statistics formatting and analysis
- `marshal`: Binary serialization for stats persistence
- Standard library: `importlib.machinery`, `io`, `os`, `sys`, `runpy`, `optparse`

**Architecture Patterns**:
- **Inheritance**: `Profile` extends `_lsprof.Profiler` with convenience methods
- **Delegation**: Module-level functions delegate to `_pyprofile._Utils`
- **Context Management**: Profile objects can be used in `with` statements
- **Command-line Interface**: Full CLI with module/script profiling capabilities

**Critical Data Flow**:
1. Raw profiler entries from `getstats()` contain call counts, times, and call relationships
2. `snapshot_stats()` transforms entries into dict format: `{func: (cc, nc, tt, ct, callers)}`
3. Stats format compatible with `pstats.Stats` for analysis and reporting
4. Function labels use filename, line number, and name for identification

**Key Constraints**:
- Statistics creation requires profiler to be disabled first
- File operations use binary mode for marshal serialization  
- Command-line interface modifies `sys.argv` and `sys.path` for target execution
- Exception handling for `BrokenPipeError` prevents shutdown warnings