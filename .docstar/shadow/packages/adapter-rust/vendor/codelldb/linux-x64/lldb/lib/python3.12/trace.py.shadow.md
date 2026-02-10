# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/trace.py
@source-hash: cbed87376cb326ad
@generated: 2026-02-09T18:10:15Z

## Python Code Coverage and Execution Tracing Module

This is Python's standard library `trace` module, providing comprehensive code coverage analysis and execution tracing capabilities. Located within the LLDB/CodeLLDB debugging environment, it enables profiling Python code execution patterns.

### Core Classes

**_Ignore (L69-117)**: Filtering mechanism for excluding modules/directories from tracing. Maintains sets of ignored modules (`_mods`) and directory paths (`_dirs`). Key method `names()` (L76-117) determines whether to ignore a module based on name matching and path prefix checking.

**CoverageResults (L154-326)**: Aggregates and reports coverage data from trace execution. Stores:
- `counts` - maps (filename, lineno) to execution count
- `calledfuncs` - tracks called functions  
- `callers` - tracks caller/called relationships

Core methods:
- `update()` (L187-203): Merges results from another CoverageResults instance
- `write_results()` (L205-294): Generates coverage reports in .cover files with hit counts and missing line annotations
- `write_results_file()` (L296-326): Writes individual coverage file with line-by-line execution counts

**Trace (L387-599)**: Main tracing engine with configurable modes. Constructor accepts flags for counting, tracing, function tracking, and caller tracking. Dynamically assigns trace handlers based on configuration:
- `globaltrace_lt()` (L528-549): Entry point handler, applies ignore filters
- `localtrace_trace_and_count()` (L551-568): Traces and counts line execution
- `localtrace_count()` (L587-593): Count-only mode
- `globaltrace_countfuncs()` (L519-526): Function call tracking
- `globaltrace_trackcallers()` (L508-517): Caller relationship tracking

### Key Functions

**_modname()** (L119-124): Extracts module name from file path
**_fullmodname()** (L126-152): Derives full module name including package hierarchy using sys.path
**_find_executable_linenos()** (L373-385): Identifies executable lines by compiling code and analyzing bytecode
**_find_lines()** (L338-348): Recursively extracts line numbers from code objects
**_find_strings()** (L350-371): Locates string literals and docstrings to exclude from coverage

### Main Entry Point

**main()** (L601-745): Command-line interface with argparse handling multiple modes:
- `-c/--count`: Line execution counting
- `-t/--trace`: Line-by-line execution tracing  
- `-l/--listfuncs`: Function call tracking
- `-T/--trackcalls`: Caller relationship tracking
- `-r/--report`: Generate reports from existing data

### Architecture Notes

- Uses `sys.settrace()` and `threading.settrace()` for hooking execution
- Supports both module execution (`--module` flag with runpy) and script execution
- Implements caching for performance (`pathtobasename`, `_caller_cache`)
- Uses pickle for data persistence between runs
- Integrates with tokenizer for pragma-based coverage exclusion (`#pragma NO COVER`)
- Employs garbage collection introspection for class method detection (L484-502)

### Constants
- `PRAGMA_NOCOVER` (L67): Marker for excluding lines from coverage analysis