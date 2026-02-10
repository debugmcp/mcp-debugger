# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/trace.py
@source-hash: cbed87376cb326ad
@generated: 2026-02-09T18:08:14Z

This is Python's standard library `trace` module - a comprehensive tool for execution tracing, line counting, and code coverage analysis.

## Primary Purpose
Provides runtime tracing and coverage measurement capabilities for Python programs through `sys.settrace()` hooks. Can operate as both a command-line utility and programmatic API.

## Core Classes

**`_Ignore` (L69-117)**: Filtering system that determines which modules/directories to exclude from tracing based on module names and file paths. Maintains memoized ignore decisions in `_ignore` dict.

**`CoverageResults` (L154-326)**: Container and processor for coverage data. Stores:
- `counts`: (filename, lineno) → execution count mapping  
- `calledfuncs`: Set of called functions
- `callers`: Caller/callee relationship tracking
- Methods for merging results, generating coverage reports, and persisting data via pickle

**`Trace` (L387-599)**: Main tracing engine with configurable trace handlers:
- `globaltrace_*` methods: Entry point handlers for different tracing modes
- `localtrace_*` methods: Line-by-line execution handlers  
- Dynamically assigns handlers based on constructor flags (count, trace, countfuncs, countcallers)

## Key Functions

**`_modname()` (L119-124)**: Extracts module name from file path
**`_fullmodname()` (L126-152)**: Resolves full module name considering sys.path
**`_find_executable_linenos()` (L373-385)**: Identifies executable lines by compiling code and analyzing bytecode
**`_find_strings()` (L350-371)**: Locates docstring positions using tokenization
**`main()` (L601-746)**: Command-line interface with argparse handling

## Architecture Patterns

- **Strategy Pattern**: Multiple trace handler implementations selected at runtime
- **Template Method**: Common tracing flow with specialized handlers
- **Memoization**: Caching in `_Ignore._ignore` and `Trace._caller_cache` 
- **Factory Pattern**: Handler selection in `Trace.__init__()` based on flags

## Critical Dependencies
- `sys.settrace()`/`threading.settrace()` for trace hooks
- `dis` module for bytecode analysis  
- `tokenize` for source code parsing
- `gc.get_referrers()` for class name resolution (L484-502)

## Usage Modes
1. **Line tracing**: Print each executed line
2. **Coverage counting**: Track line execution counts
3. **Function tracking**: Record called functions
4. **Call tracking**: Monitor caller/callee relationships
5. **Report generation**: Produce coverage reports from stored data

## Key Invariants
- Trace handlers must return appropriate continuation values
- Coverage data uses (filename, lineno) tuples as keys
- Ignore patterns are normalized and cached for performance
- All tracing disabled when `donothing=1`