# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/trace.py
@source-hash: cbed87376cb326ad
@generated: 2026-02-09T18:09:21Z

**Primary Purpose:** Python execution tracing and code coverage analysis module, providing line-by-line execution tracking, function call monitoring, and coverage reporting capabilities.

## Core Classes

### _Ignore (L69-118)
Internal filtering class for excluding modules/directories from tracing. Maintains sets of ignored modules (`_mods`) and normalized directory paths (`_dirs`). Key method `names()` (L76-117) determines if a module should be ignored based on exact matches, submodule relationships, or directory containment.

### CoverageResults (L154-326)
Coverage data container and report generator. Stores execution counts (`counts`), called functions (`calledfuncs`), and caller relationships (`callers`). Supports merging results from multiple runs via `update()` (L187-203) and pickle-based persistence. Main output method `write_results()` (L205-294) generates annotated source files with coverage markers and optional summary statistics.

### Trace (L387-599)
Main tracing orchestrator with configurable execution monitoring modes. Constructor (L388-436) sets up trace handlers based on flags:
- Line counting: `localtrace_count()` (L587-593)
- Line tracing: `localtrace_trace()` (L570-585) 
- Combined: `localtrace_trace_and_count()` (L551-568)
- Function tracking: `globaltrace_countfuncs()` (L519-526)
- Call tracking: `globaltrace_trackcallers()` (L508-517)

Execution methods: `run()` (L438-441), `runctx()` (L443-454), `runfunc()` (L456-465).

## Key Utilities

**Module name resolution:**
- `_modname()` (L119-124): Extracts simple module name from file path
- `_fullmodname()` (L126-152): Resolves full dotted module name using sys.path

**Executable line detection:**
- `_find_executable_linenos()` (L373-385): Main entry point, compiles source and finds executable lines
- `_find_lines()` (L338-348): Recursively extracts line numbers from code objects using `dis.findlinestarts()`
- `_find_strings()` (L350-371): Identifies string literal lines (docstrings) to exclude from coverage

## Command Line Interface

`main()` (L601-746) provides comprehensive CLI using argparse:
- **Primary modes:** `--count`, `--trace`, `--listfuncs`, `--trackcalls`, `--report`
- **Filtering:** `--ignore-module`, `--ignore-dir` with variable expansion
- **Output control:** `--file`, `--coverdir`, `--missing`, `--summary`
- **Execution:** Supports both script files and module execution (`--module`)

## Key Dependencies
- `sys.settrace()` for execution monitoring
- `threading.settrace()` for thread-local tracing
- `linecache` for source line retrieval
- `pickle` for results persistence
- `dis` module for bytecode line number extraction
- `tokenize` for string literal detection and encoding

## Constants
- `PRAGMA_NOCOVER = "#pragma NO COVER"` (L67): Marker to exclude lines from coverage analysis

## Architecture Notes
- Thread-safe tracing support via threading module integration
- Memoization in `pathtobasename` and `_caller_cache` for performance
- Class method detection using garbage collector introspection (L484-502)
- Configurable timing display using `monotonic()` clock