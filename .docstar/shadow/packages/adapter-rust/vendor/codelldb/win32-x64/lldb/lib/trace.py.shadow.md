# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/trace.py
@source-hash: cbed87376cb326ad
@generated: 2026-02-09T18:14:21Z

**Primary Purpose**: Python execution tracing and code coverage analysis tool that can trace program execution line-by-line, count execution frequencies, and track function calls.

**Core Classes**:

- **`_Ignore` (L69-117)**: Manages filtering logic for modules/directories to exclude from tracing. Uses module names and directory paths to determine what should be ignored during execution analysis.

- **`CoverageResults` (L154-326)**: Handles coverage data storage, merging, and report generation. Maintains three key data structures:
  - `counts`: Maps (filename, lineno) → execution count
  - `calledfuncs`: Tracks which functions were executed  
  - `callers`: Records caller/called relationships
  Key methods include `update()` (L187) for merging results and `write_results()` (L205) for generating coverage reports.

- **`Trace` (L387-599)**: Main tracing engine that instruments Python execution. Configurable for different tracing modes:
  - Line counting via `localtrace_count()` (L587)
  - Line tracing via `localtrace_trace()` (L570) 
  - Combined tracing/counting via `localtrace_trace_and_count()` (L551)
  - Function call tracking via `globaltrace_trackcallers()` (L508)
  Uses `sys.settrace()` to hook into Python's execution model.

**Key Functions**:

- **`_modname()` (L119)**: Extracts module name from file path
- **`_fullmodname()` (L126)**: Determines full module name including package hierarchy
- **`_find_executable_linenos()` (L373)**: Analyzes code to identify executable lines for coverage reporting
- **`_find_strings()` (L350)**: Locates string literals (typically docstrings) to exclude from coverage
- **`main()` (L601-748)**: CLI interface with comprehensive argument parsing

**Architecture Patterns**:
- Strategy pattern for different tracing modes (counting, tracing, function tracking)
- Template method pattern in trace handlers
- Delegation pattern where `Trace` delegates to `CoverageResults` for output

**Key Dependencies**:
- `sys.settrace()` for execution instrumentation
- `dis`, `inspect`, `gc` modules for code analysis
- `tokenize` for source code parsing
- `pickle` for data persistence

**Critical Invariants**:
- Tracing must be properly cleaned up via `sys.settrace(None)` in finally blocks
- Coverage data structures use (filename, lineno) tuples as consistent keys
- Module filtering respects both exact matches and submodule patterns

**Threading**: Uses `threading.settrace()` (L447) for multi-threaded tracing support

**Command Line Interface**: Supports execution tracing (`-t`), line counting (`-c`), function listing (`-l`), and call tracking (`-T`) with comprehensive filtering options.