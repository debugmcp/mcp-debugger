# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/trace.py
@source-hash: cbed87376cb326ad
@generated: 2026-02-09T18:07:29Z

## Purpose
Python execution tracing and code coverage analysis module. Provides line-by-line execution counting, function call tracking, and coverage reporting for Python programs and modules.

## Key Classes

### `_Ignore` (L69-117)
Manages filtering of modules and directories to exclude from tracing. Uses pattern matching on module names and path prefixes to determine which code should be ignored during trace collection.

### `CoverageResults` (L154-326)
Aggregates and reports coverage data collected during execution.
- Manages execution counts per (filename, lineno) pair
- Tracks function calls and caller relationships
- Generates annotated source files showing coverage gaps (L296-326)
- Supports merging results from multiple runs via pickle serialization
- Key method: `write_results()` (L205-295) outputs coverage reports with optional summary statistics

### `Trace` (L387-599)
Main tracing engine that hooks into Python's execution via `sys.settrace()`.
- Configurable modes: line counting, execution tracing, function tracking, caller tracking
- Dynamic trace handler selection based on configuration (L421-436)
- Core execution methods: `run()` (L438), `runctx()` (L443), `runfunc()` (L456)
- Multiple trace handlers for different collection modes:
  - `globaltrace_lt()` (L528) + `localtrace_count()` (L587) for line counting
  - `globaltrace_trackcallers()` (L508) for call relationship tracking
  - `globaltrace_countfuncs()` (L519) for function execution tracking

## Key Functions

### Module name resolution
- `_modname()` (L119-124): Extracts simple module name from file path
- `_fullmodname()` (L126-152): Derives full dotted module name using sys.path matching

### Executable line detection
- `_find_executable_linenos()` (L373-385): Identifies code lines vs docstrings/comments
- `_find_lines()` (L338-348): Recursively extracts line numbers from code objects
- `_find_strings()` (L350-371): Locates string literals and docstrings to exclude from coverage

### CLI interface
- `main()` (L601-746): Comprehensive command-line interface with argument parsing for all tracing modes

## Dependencies
- Standard library: `sys`, `threading`, `dis`, `tokenize`, `linecache`, `pickle`
- Uses `sys.settrace()` and `threading.settrace()` for execution monitoring
- Integrates with `runpy` for module execution support

## Architecture Notes
- Trace handlers are dynamically assigned based on configuration to optimize performance
- Uses garbage collection introspection (`gc.get_referrers()`) to identify class methods (L482-502)
- Thread-safe tracing support via `threading.settrace()`
- Supports both programmatic API and command-line usage
- Coverage data persistence via pickle format for incremental analysis

## Constants
- `PRAGMA_NOCOVER = "#pragma NO COVER"` (L67): Special comment to exclude lines from coverage