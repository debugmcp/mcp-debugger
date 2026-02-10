# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/cProfile.py
@source-hash: c4c3edb84862431d
@generated: 2026-02-09T18:12:50Z

## Primary Purpose
Python interface module for the 'lsprof' C extension profiler, providing a high-level API compatible with the standard `profile` module for performance profiling of Python code.

## Key Components

### Public API Functions (L17-25)
- `run(statement, filename=None, sort=-1)` (L17-18): Profiles a string statement using default globals
- `runctx(statement, globals, locals, filename=None, sort=-1)` (L20-22): Profiles a string statement with custom namespace contexts
- Both delegate to `_pyprofile._Utils(Profile)` and inherit docstrings from the standard profile module

### Core Class: Profile (L29-121)
Extends `_lsprof.Profiler` C extension with Python convenience methods:

**Statistics Management:**
- `print_stats(sort=-1)` (L42-44): Outputs formatted profiling results using pstats
- `dump_stats(file)` (L46-50): Serializes stats to binary file using marshal
- `create_stats()` (L52-54): Disables profiler and snapshots current statistics
- `snapshot_stats()` (L56-89): Complex method converting raw C profiler data into pstats-compatible format with call graph information

**Execution Profiling:**
- `run(cmd)` (L94-97): Profiles string in main module context
- `runctx(cmd, globals, locals)` (L99-105): Profiles string with custom contexts, handles enable/disable
- `runcall(func, /, *args, **kw)` (L108-113): Profiles single function call with arguments

**Context Manager Support:**
- `__enter__()` (L115-117) and `__exit__()` (L119-120): Enable/disable profiling in with-statement blocks

### Utility Functions
- `label(code)` (L124-128): Converts code objects to pstats-compatible identifiers, handling both built-ins (strings) and regular code objects
- `main()` (L132-191): Command-line interface supporting module/script profiling with output options

## Dependencies
- `_lsprof`: C extension providing core profiling functionality
- `profile` as `_pyprofile`: Standard library profiler for utility functions
- `pstats`, `marshal`: For statistics formatting and serialization
- `importlib.machinery`, `runpy`: For module execution in main()

## Key Patterns
- **Delegation Pattern**: Simple functions delegate to _pyprofile utilities while using this module's Profile class
- **Template Method**: snapshot_stats() implements complex two-pass algorithm to build call graph statistics
- **Context Manager**: Profile class supports with-statement for automatic profiler lifecycle management
- **Command-line Interface**: Comprehensive CLI with module vs script execution modes

## Critical Data Structures
- `self.stats`: Dictionary mapping function labels to tuples of (cc, nc, tt, ct, callers) statistics
- Call count tracking: `nc` (total calls), `cc` (non-recursive calls), `tt` (inline time), `ct` (cumulative time)
- Caller relationship mapping via `callersdicts` keyed by code object ID