# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/cProfile.py
@source-hash: c4c3edb84862431d
@generated: 2026-02-09T18:09:29Z

**Primary Purpose**: Python interface for the high-performance 'lsprof' profiler, providing a drop-in replacement for the standard `profile` module with C-based performance improvements.

**Key Components**:

- **Simple Interface Functions (L17-25)**:
  - `run(statement, filename=None, sort=-1)` (L17): Profiles a code statement string
  - `runctx(statement, globals, locals, filename=None, sort=-1)` (L20): Profiles code with explicit global/local namespaces
  - Both delegate to `_pyprofile._Utils(Profile)` for compatibility

- **Profile Class (L29-121)**: Main profiler class inheriting from `_lsprof.Profiler`
  - **Statistics Management**:
    - `create_stats()` (L52): Disables profiler and snapshots current statistics
    - `snapshot_stats()` (L56): Converts raw profiler data into pstats-compatible format
    - `print_stats(sort=-1)` (L42): Outputs formatted statistics via pstats module
    - `dump_stats(file)` (L46): Serializes statistics to file using marshal
  
  - **Execution Methods**:
    - `run(cmd)` (L94): Profiles code string in __main__ namespace
    - `runctx(cmd, globals, locals)` (L99): Profiles code with custom namespaces
    - `runcall(func, *args, **kw)` (L108): Profiles single function call
  
  - **Context Manager Support (L115-120)**: Enables `with Profile()` syntax

- **Utility Functions**:
  - `label(code)` (L124): Converts code objects to tuple identifiers for statistics tracking
  - `main()` (L132-191): Command-line interface with options for output file, sorting, and module execution

**Key Dependencies**:
- `_lsprof`: C extension providing core profiling functionality
- `profile` (`_pyprofile`): Standard library module for compatibility layer
- `pstats`: Statistics formatting and display
- `marshal`: Binary serialization for statistics persistence

**Data Flow Architecture**:
1. Raw profiling data collected by `_lsprof.Profiler` base class
2. `snapshot_stats()` transforms data into nested dictionary structure compatible with pstats
3. Statistics format: `{func_label: (cc, nc, tt, ct, callers_dict)}`
   - cc: call count excluding recursive calls
   - nc: total call count including recursive calls  
   - tt: total time spent in function excluding subcalls
   - ct: cumulative time including subcalls

**Critical Invariants**:
- Profiler must be explicitly disabled after use to capture accurate statistics
- Statistics snapshot creates immutable view of current profiling state
- Label format ensures consistent sorting (built-ins use '~' prefix to sort last)